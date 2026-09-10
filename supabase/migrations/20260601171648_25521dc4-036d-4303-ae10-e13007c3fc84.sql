
-- Notification preferences
CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY,
  announcements boolean NOT NULL DEFAULT true,
  grades boolean NOT NULL DEFAULT true,
  messages boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification prefs"
  ON public.notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Helper to check pref (defaults to true if no row)
CREATE OR REPLACE FUNCTION public.notif_pref(_user_id uuid, _kind text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    CASE _kind
      WHEN 'announcements' THEN (SELECT announcements FROM public.notification_preferences WHERE user_id = _user_id)
      WHEN 'grades' THEN (SELECT grades FROM public.notification_preferences WHERE user_id = _user_id)
      WHEN 'messages' THEN (SELECT messages FROM public.notification_preferences WHERE user_id = _user_id)
      ELSE true
    END, true)
$$;

-- Replace triggers to respect preferences
CREATE OR REPLACE FUNCTION public.notify_on_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  select e.student_id, 'announcement', new.title, left(new.body, 200), '/student'
  from public.enrollments e
  where e.class_id = new.class_id
    and public.notif_pref(e.student_id, 'announcements');

  insert into public.notifications (user_id, type, title, body, link)
  select distinct l.parent_id, 'announcement', new.title, left(new.body, 200), '/parent/announcements'
  from public.enrollments e
  join public.parent_links l on l.student_id = e.student_id
  where e.class_id = new.class_id
    and public.notif_pref(l.parent_id, 'announcements');
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_grade()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _title text;
begin
  if new.grade is null then return new; end if;
  if old.grade is not distinct from new.grade then return new; end if;
  select 'Grade posted: ' || a.title into _title from public.assignments a where a.id = new.assignment_id;

  if public.notif_pref(new.student_id, 'grades') then
    insert into public.notifications (user_id, type, title, body, link)
    values (new.student_id, 'grade', coalesce(_title, 'New grade'),
            'Score: ' || new.grade::text, '/student/assignments/' || new.assignment_id::text);
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  select l.parent_id, 'grade', coalesce(_title, 'New grade'),
         'Score: ' || new.grade::text, '/parent/children/' || new.student_id::text
  from public.parent_links l
  where l.student_id = new.student_id
    and public.notif_pref(l.parent_id, 'grades');
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if public.notif_pref(new.recipient_id, 'messages') then
    insert into public.notifications (user_id, type, title, body, link)
    values (new.recipient_id, 'message', 'New message', left(new.body, 140), '/messages');
  end if;
  return new;
end;
$$;
