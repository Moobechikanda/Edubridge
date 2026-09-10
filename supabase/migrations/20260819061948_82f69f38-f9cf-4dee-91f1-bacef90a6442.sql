-- 1. Columns
ALTER TABLE public.school_announcements
  ADD COLUMN IF NOT EXISTS publish_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

ALTER TABLE public.school_announcements
  DROP CONSTRAINT IF EXISTS school_announcements_status_check;
ALTER TABLE public.school_announcements
  ADD CONSTRAINT school_announcements_status_check CHECK (status IN ('pending','approved','rejected'));

UPDATE public.school_announcements SET notified_at = created_at WHERE notified_at IS NULL;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS publish_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;
UPDATE public.announcements SET notified_at = created_at WHERE notified_at IS NULL;

-- 2. Default status: teachers -> pending, admins -> approved
CREATE OR REPLACE FUNCTION public.set_school_announcement_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.has_role(auth.uid(), 'admin') THEN
      NEW.status := COALESCE(NULLIF(NEW.status,''), 'approved');
    ELSE
      NEW.status := 'pending';
      NEW.reviewed_by := NULL;
      NEW.reviewed_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_school_announcement_status ON public.school_announcements;
CREATE TRIGGER trg_school_announcement_status
BEFORE INSERT ON public.school_announcements
FOR EACH ROW EXECUTE FUNCTION public.set_school_announcement_status();

-- 3. Visibility
DROP POLICY IF EXISTS "Anyone authenticated views school news" ON public.school_announcements;
CREATE POLICY "Published school news is visible" ON public.school_announcements
FOR SELECT TO authenticated
USING (
  (status = 'approved' AND publish_at <= now())
  OR posted_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- Admins may moderate any school news
DROP POLICY IF EXISTS "Admins moderate school news" ON public.school_announcements;
CREATE POLICY "Admins moderate school news" ON public.school_announcements
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Class announcements only visible once published
DROP POLICY IF EXISTS "Enrolled students view announcements" ON public.announcements;
CREATE POLICY "Enrolled students view announcements" ON public.announcements
FOR SELECT TO authenticated
USING (public.is_class_student(class_id, auth.uid()) AND publish_at <= now());

DROP POLICY IF EXISTS "Linked parents view announcements" ON public.announcements;
CREATE POLICY "Linked parents view announcements" ON public.announcements
FOR SELECT TO authenticated
USING (public.is_parent_of_class_student(class_id, auth.uid()) AND publish_at <= now());

-- 4. Notify only at publish time
CREATE OR REPLACE FUNCTION public.notify_announcement_row(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.announcements%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.announcements WHERE id = _id;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT e.student_id, 'announcement', r.title, left(r.body, 200), '/student'
  FROM public.enrollments e
  WHERE e.class_id = r.class_id AND public.notif_pref(e.student_id, 'announcements');

  INSERT INTO public.notification_audit_log (user_id, kind, source_id, delivered, reason)
  SELECT e.student_id, 'announcement', r.id, public.notif_pref(e.student_id, 'announcements'),
         CASE WHEN public.notif_pref(e.student_id, 'announcements') THEN 'opt-in' ELSE 'opt-out' END
  FROM public.enrollments e WHERE e.class_id = r.class_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT DISTINCT l.parent_id, 'announcement', r.title, left(r.body, 200), '/parent/announcements'
  FROM public.enrollments e
  JOIN public.parent_links l ON l.student_id = e.student_id
  WHERE e.class_id = r.class_id AND public.notif_pref(l.parent_id, 'announcements');

  INSERT INTO public.notification_audit_log (user_id, kind, source_id, delivered, reason)
  SELECT DISTINCT l.parent_id, 'announcement', r.id, public.notif_pref(l.parent_id, 'announcements'),
         CASE WHEN public.notif_pref(l.parent_id, 'announcements') THEN 'opt-in' ELSE 'opt-out' END
  FROM public.enrollments e
  JOIN public.parent_links l ON l.student_id = e.student_id
  WHERE e.class_id = r.class_id;

  UPDATE public.announcements SET notified_at = now() WHERE id = r.id;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_on_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.publish_at <= now() THEN
    PERFORM public.notify_announcement_row(NEW.id);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_school_announcement_row(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.school_announcements%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.school_announcements WHERE id = _id;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT p.id, 'school', r.title, left(r.body,200), '/news'
  FROM public.profiles p WHERE public.notif_pref(p.id, 'announcements');

  INSERT INTO public.notification_audit_log (user_id, kind, source_id, delivered, reason)
  SELECT p.id, 'school', r.id, public.notif_pref(p.id,'announcements'),
         CASE WHEN public.notif_pref(p.id,'announcements') THEN 'opt-in' ELSE 'opt-out' END
  FROM public.profiles p;

  UPDATE public.school_announcements SET notified_at = now() WHERE id = r.id;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_on_school_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND NEW.publish_at <= now() AND NEW.notified_at IS NULL THEN
    PERFORM public.notify_school_announcement_row(NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_school_announcement_update ON public.school_announcements;
CREATE TRIGGER trg_notify_school_announcement_update
AFTER UPDATE ON public.school_announcements
FOR EACH ROW EXECUTE FUNCTION public.notify_on_school_announcement();

-- 5. Background publisher for scheduled items
CREATE OR REPLACE FUNCTION public.publish_due_announcements()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _n integer := 0;
BEGIN
  FOR _id IN SELECT id FROM public.announcements WHERE notified_at IS NULL AND publish_at <= now() LOOP
    PERFORM public.notify_announcement_row(_id); _n := _n + 1;
  END LOOP;
  FOR _id IN SELECT id FROM public.school_announcements
             WHERE notified_at IS NULL AND status = 'approved' AND publish_at <= now() LOOP
    PERFORM public.notify_school_announcement_row(_id); _n := _n + 1;
  END LOOP;
  RETURN _n;
END; $$;

REVOKE ALL ON FUNCTION public.publish_due_announcements() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_announcement_row(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_school_announcement_row(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_school_announcement_status() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
  PERFORM cron.unschedule('publish-due-announcements');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('publish-due-announcements', '* * * * *', $$SELECT public.publish_due_announcements();$$);