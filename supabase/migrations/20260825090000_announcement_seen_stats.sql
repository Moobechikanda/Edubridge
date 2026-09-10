-- Let teachers see how many recipients (enrolled students + their linked parents)
-- have read each of their class announcements, without exposing individual read
-- rows for people outside the class (announcement_reads RLS stays as-is).
create or replace function public.get_announcement_seen_stats(_announcement_id uuid)
returns table (seen_count bigint, total_recipients bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _class_id uuid;
begin
  select class_id into _class_id from public.announcements where id = _announcement_id;
  if _class_id is null or not public.is_class_teacher(_class_id, auth.uid()) then
    raise exception 'Not authorized';
  end if;

  return query
  with recipients as (
    select e.student_id as user_id from public.enrollments e where e.class_id = _class_id
    union
    select l.parent_id as user_id
    from public.enrollments e
    join public.parent_links l on l.student_id = e.student_id
    where e.class_id = _class_id
  )
  select
    (select count(*) from public.announcement_reads r
       where r.announcement_id = _announcement_id and r.user_id in (select user_id from recipients)),
    (select count(*) from recipients);
end;
$$;

revoke all on function public.get_announcement_seen_stats(uuid) from public;
grant execute on function public.get_announcement_seen_stats(uuid) to authenticated;
