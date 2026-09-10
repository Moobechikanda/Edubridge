
-- ============ school_announcements ============
CREATE TABLE public.school_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('news','assignment','assessment','meeting','general')),
  title text NOT NULL,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  posted_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_announcements TO authenticated;
GRANT ALL ON public.school_announcements TO service_role;
ALTER TABLE public.school_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated views school news"
  ON public.school_announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage school news"
  ON public.school_announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') AND posted_by = auth.uid());

-- ============ assessments ============
CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  title text NOT NULL,
  coverage text,
  scheduled_at timestamptz NOT NULL,
  points integer NOT NULL DEFAULT 100,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assessments_class_idx ON public.assessments(class_id, scheduled_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage assessments in own classes"
  ON public.assessments FOR ALL TO authenticated
  USING (public.is_class_teacher(class_id, auth.uid()))
  WITH CHECK (public.is_class_teacher(class_id, auth.uid()));
CREATE POLICY "Enrolled students view assessments"
  ON public.assessments FOR SELECT TO authenticated
  USING (public.is_class_student(class_id, auth.uid()));
CREATE POLICY "Linked parents view assessments"
  ON public.assessments FOR SELECT TO authenticated
  USING (public.is_parent_of_class_student(class_id, auth.uid()));
CREATE POLICY "Admins view all assessments"
  ON public.assessments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ============ meetings ============
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  location text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated views meetings"
  ON public.meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage meetings"
  ON public.meetings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') AND created_by = auth.uid());

-- ============ rankings RPC (full leaderboard) ============
CREATE OR REPLACE FUNCTION public.get_class_rankings(_class_id uuid)
RETURNS TABLE(student_id uuid, full_name text, total_points numeric, graded_count bigint, rank bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH allowed AS (
    SELECT 1
    WHERE public.is_class_teacher(_class_id, auth.uid())
       OR public.is_class_student(_class_id, auth.uid())
       OR public.is_parent_of_class_student(_class_id, auth.uid())
       OR public.has_role(auth.uid(), 'admin')
  ),
  scored AS (
    SELECT e.student_id,
           p.full_name,
           COALESCE(SUM(s.grade),0)::numeric AS total_points,
           COUNT(s.grade) AS graded_count
    FROM public.enrollments e
    JOIN public.profiles p ON p.id = e.student_id
    LEFT JOIN public.assignments a ON a.class_id = e.class_id
    LEFT JOIN public.submissions s ON s.assignment_id = a.id AND s.student_id = e.student_id
    WHERE e.class_id = _class_id AND EXISTS (SELECT 1 FROM allowed)
    GROUP BY e.student_id, p.full_name
  )
  SELECT student_id, full_name, total_points, graded_count,
         RANK() OVER (ORDER BY total_points DESC) AS rank
  FROM scored
  ORDER BY rank, full_name;
$$;
REVOKE ALL ON FUNCTION public.get_class_rankings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_class_rankings(uuid) TO authenticated;

-- ============ notification triggers ============

-- school announcements -> everyone signed in
CREATE OR REPLACE FUNCTION public.notify_on_school_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT p.id, 'school', NEW.title, left(NEW.body,200), '/news'
  FROM public.profiles p
  WHERE public.notif_pref(p.id, 'announcements');

  INSERT INTO public.notification_audit_log (user_id, kind, source_id, delivered, reason)
  SELECT p.id, 'school', NEW.id,
         public.notif_pref(p.id,'announcements'),
         CASE WHEN public.notif_pref(p.id,'announcements') THEN 'opt-in' ELSE 'opt-out' END
  FROM public.profiles p;
  RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.notify_on_school_announcement() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_notify_school_announcement
  AFTER INSERT ON public.school_announcements
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_school_announcement();

-- meetings -> everyone signed in
CREATE OR REPLACE FUNCTION public.notify_on_meeting()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT p.id, 'meeting', 'Meeting: ' || NEW.title,
         to_char(NEW.scheduled_at,'Mon DD, HH24:MI') || COALESCE(' · '||NEW.location,''),
         '/news'
  FROM public.profiles p
  WHERE public.notif_pref(p.id, 'announcements');

  INSERT INTO public.notification_audit_log (user_id, kind, source_id, delivered, reason)
  SELECT p.id, 'meeting', NEW.id,
         public.notif_pref(p.id,'announcements'),
         CASE WHEN public.notif_pref(p.id,'announcements') THEN 'opt-in' ELSE 'opt-out' END
  FROM public.profiles p;
  RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.notify_on_meeting() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_notify_meeting
  AFTER INSERT ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_meeting();

-- assessments -> enrolled students + linked parents
CREATE OR REPLACE FUNCTION public.notify_on_assessment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT e.student_id, 'assessment',
         'Upcoming assessment: ' || NEW.title,
         'On ' || to_char(NEW.scheduled_at,'Mon DD'),
         '/student'
  FROM public.enrollments e
  WHERE e.class_id = NEW.class_id AND public.notif_pref(e.student_id,'announcements');

  INSERT INTO public.notification_audit_log (user_id, kind, source_id, delivered, reason)
  SELECT e.student_id, 'assessment', NEW.id,
         public.notif_pref(e.student_id,'announcements'),
         CASE WHEN public.notif_pref(e.student_id,'announcements') THEN 'opt-in' ELSE 'opt-out' END
  FROM public.enrollments e WHERE e.class_id = NEW.class_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT DISTINCT l.parent_id, 'assessment',
         'Upcoming assessment: ' || NEW.title,
         'On ' || to_char(NEW.scheduled_at,'Mon DD'),
         '/news'
  FROM public.enrollments e
  JOIN public.parent_links l ON l.student_id = e.student_id
  WHERE e.class_id = NEW.class_id AND public.notif_pref(l.parent_id,'announcements');

  INSERT INTO public.notification_audit_log (user_id, kind, source_id, delivered, reason)
  SELECT DISTINCT l.parent_id, 'assessment', NEW.id,
         public.notif_pref(l.parent_id,'announcements'),
         CASE WHEN public.notif_pref(l.parent_id,'announcements') THEN 'opt-in' ELSE 'opt-out' END
  FROM public.enrollments e
  JOIN public.parent_links l ON l.student_id = e.student_id
  WHERE e.class_id = NEW.class_id;

  RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.notify_on_assessment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_notify_assessment
  AFTER INSERT ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_assessment();
