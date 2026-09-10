
-- 1. Audit log
CREATE TABLE public.notification_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  source_id uuid,
  delivered boolean NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notification_audit_log TO authenticated;
GRANT ALL ON public.notification_audit_log TO service_role;

ALTER TABLE public.notification_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view audit log"
  ON public.notification_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_notif_audit_created ON public.notification_audit_log (created_at DESC);
CREATE INDEX idx_notif_audit_kind ON public.notification_audit_log (kind);

-- 2. Update notification triggers to log decisions
CREATE OR REPLACE FUNCTION public.notify_on_announcement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  -- Students
  insert into public.notifications (user_id, type, title, body, link)
  select e.student_id, 'announcement', new.title, left(new.body, 200), '/student'
  from public.enrollments e
  where e.class_id = new.class_id
    and public.notif_pref(e.student_id, 'announcements');

  insert into public.notification_audit_log (user_id, kind, source_id, delivered, reason)
  select e.student_id, 'announcement', new.id,
         public.notif_pref(e.student_id, 'announcements'),
         case when public.notif_pref(e.student_id, 'announcements') then 'opt-in' else 'opt-out' end
  from public.enrollments e
  where e.class_id = new.class_id;

  -- Parents
  insert into public.notifications (user_id, type, title, body, link)
  select distinct l.parent_id, 'announcement', new.title, left(new.body, 200), '/parent/announcements'
  from public.enrollments e
  join public.parent_links l on l.student_id = e.student_id
  where e.class_id = new.class_id
    and public.notif_pref(l.parent_id, 'announcements');

  insert into public.notification_audit_log (user_id, kind, source_id, delivered, reason)
  select distinct l.parent_id, 'announcement', new.id,
         public.notif_pref(l.parent_id, 'announcements'),
         case when public.notif_pref(l.parent_id, 'announcements') then 'opt-in' else 'opt-out' end
  from public.enrollments e
  join public.parent_links l on l.student_id = e.student_id
  where e.class_id = new.class_id;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_grade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare _title text; _pref boolean;
begin
  if new.grade is null then return new; end if;
  if old.grade is not distinct from new.grade then return new; end if;
  select 'Grade posted: ' || a.title into _title from public.assignments a where a.id = new.assignment_id;

  _pref := public.notif_pref(new.student_id, 'grades');
  if _pref then
    insert into public.notifications (user_id, type, title, body, link)
    values (new.student_id, 'grade', coalesce(_title, 'New grade'),
            'Score: ' || new.grade::text, '/student/assignments/' || new.assignment_id::text);
  end if;
  insert into public.notification_audit_log (user_id, kind, source_id, delivered, reason)
  values (new.student_id, 'grade', new.assignment_id, _pref,
          case when _pref then 'opt-in' else 'opt-out' end);

  insert into public.notifications (user_id, type, title, body, link)
  select l.parent_id, 'grade', coalesce(_title, 'New grade'),
         'Score: ' || new.grade::text, '/parent/children/' || new.student_id::text
  from public.parent_links l
  where l.student_id = new.student_id
    and public.notif_pref(l.parent_id, 'grades');

  insert into public.notification_audit_log (user_id, kind, source_id, delivered, reason)
  select l.parent_id, 'grade', new.assignment_id,
         public.notif_pref(l.parent_id, 'grades'),
         case when public.notif_pref(l.parent_id, 'grades') then 'opt-in' else 'opt-out' end
  from public.parent_links l
  where l.student_id = new.student_id;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare _pref boolean;
begin
  _pref := public.notif_pref(new.recipient_id, 'messages');
  if _pref then
    insert into public.notifications (user_id, type, title, body, link)
    values (new.recipient_id, 'message', 'New message', left(new.body, 140), '/messages');
  end if;
  insert into public.notification_audit_log (user_id, kind, source_id, delivered, reason)
  values (new.recipient_id, 'message', new.id, _pref,
          case when _pref then 'opt-in' else 'opt-out' end);
  return new;
end;
$function$;

-- 3. Join class by code RPC (replaces broad SELECT on classes)
DROP POLICY IF EXISTS "Authenticated lookup by join code" ON public.classes;

CREATE OR REPLACE FUNCTION public.join_class_by_code(_code text)
RETURNS TABLE(class_id uuid, class_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  _class_id uuid;
  _class_name text;
begin
  if not public.has_role(auth.uid(), 'student') then
    raise exception 'Only students can join classes';
  end if;

  select id, name into _class_id, _class_name
  from public.classes
  where join_code = upper(trim(_code));

  if _class_id is null then
    raise exception 'Invalid join code';
  end if;

  insert into public.enrollments (class_id, student_id)
  values (_class_id, auth.uid())
  on conflict do nothing;

  return query select _class_id, _class_name;
end;
$$;

-- 4. Tighten EXECUTE permissions on SECURITY DEFINER functions

-- Trigger-only functions: no client should call them
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_announcement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_grade() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_pref(uuid, text) FROM PUBLIC, anon, authenticated;

-- RLS helper functions: used inside policies, no need for client EXECUTE
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_class_teacher(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_class_student(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_assignment_teacher(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_linked_parent(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_parent_of_class_student(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- User-callable RPCs: signed-in only
REVOKE ALL ON FUNCTION public.link_child_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_child_by_code(text) TO authenticated;

REVOKE ALL ON FUNCTION public.preview_student_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_student_by_code(text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.join_class_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_class_by_code(text) TO authenticated;
