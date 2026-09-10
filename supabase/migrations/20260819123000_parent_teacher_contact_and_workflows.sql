-- Parent/teacher communication and richer school workflow support

-- 1) Contact fields on profiles (visible through existing profile policies)
alter table public.profiles
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists contact_whatsapp text,
  add column if not exists contact_socials text;

-- 2) Assignment type so teachers can differentiate work from assessments
alter table public.assignments
  add column if not exists assignment_type text not null default 'homework';

alter table public.assignments
  drop constraint if exists assignments_assignment_type_check;

alter table public.assignments
  add constraint assignments_assignment_type_check
  check (assignment_type in ('homework', 'project', 'quiz', 'lab', 'reading', 'other'));

-- 3) Expand school-news categories for parent-focused items like fees/trips/events
alter table public.school_announcements
  drop constraint if exists school_announcements_category_check;

alter table public.school_announcements
  add constraint school_announcements_category_check
  check (
    category in (
      'news',
      'announcement',
      'message',
      'assignment',
      'assessment',
      'meeting',
      'event',
      'trip',
      'fees',
      'general'
    )
  );

-- 4) Enforce relationship-aware direct messaging
create or replace function public.can_message(_sender uuid, _recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with sender_role as (
    select role from public.user_roles where user_id = _sender limit 1
  ),
  recipient_role as (
    select role from public.user_roles where user_id = _recipient limit 1
  )
  select
    _sender <> _recipient
    and (
      public.has_role(_sender, 'admin')
      or public.has_role(_recipient, 'admin')
      or exists (
        select 1
        from sender_role s
        join recipient_role r on true
        where s.role = 'teacher' and r.role = 'student'
          and exists (
            select 1
            from public.classes c
            join public.enrollments e on e.class_id = c.id
            where c.teacher_id = _sender and e.student_id = _recipient
          )
      )
      or exists (
        select 1
        from sender_role s
        join recipient_role r on true
        where s.role = 'student' and r.role = 'teacher'
          and exists (
            select 1
            from public.classes c
            join public.enrollments e on e.class_id = c.id
            where c.teacher_id = _recipient and e.student_id = _sender
          )
      )
      or exists (
        select 1
        from sender_role s
        join recipient_role r on true
        where s.role = 'parent' and r.role = 'teacher'
          and public.is_parent_of_my_student(_sender, _recipient)
      )
      or exists (
        select 1
        from sender_role s
        join recipient_role r on true
        where s.role = 'teacher' and r.role = 'parent'
          and public.is_parent_of_my_student(_recipient, _sender)
      )
      or exists (
        select 1
        from sender_role s
        join recipient_role r on true
        where s.role = 'parent' and r.role = 'student'
          and public.is_linked_parent(_sender, _recipient)
      )
      or exists (
        select 1
        from sender_role s
        join recipient_role r on true
        where s.role = 'student' and r.role = 'parent'
          and public.is_linked_parent(_recipient, _sender)
      )
      or exists (
        select 1
        from sender_role s
        join recipient_role r on true
        where s.role in ('teacher', 'admin') and r.role in ('teacher', 'admin')
      )
    )
$$;

revoke all on function public.can_message(uuid, uuid) from public;
grant execute on function public.can_message(uuid, uuid) to authenticated;

drop policy if exists "Users send messages" on public.messages;
create policy "Users send messages" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.can_message(sender_id, recipient_id)
  );

-- 5) Role-aware contact resolver for the messaging UI
create or replace function public.get_message_contacts()
returns table (
  id uuid,
  full_name text,
  role text,
  related_student_names text,
  related_class_names text,
  contact_email text,
  contact_phone text,
  contact_whatsapp text,
  contact_socials text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _me uuid := auth.uid();
  _role public.app_role;
begin
  select ur.role into _role
  from public.user_roles ur
  where ur.user_id = _me
  limit 1;

  if _role = 'parent' then
    return query
    select
      t.id,
      t.full_name,
      'teacher'::text,
      string_agg(distinct sp.full_name, ', '),
      string_agg(distinct c.name, ', '),
      t.contact_email,
      t.contact_phone,
      t.contact_whatsapp,
      t.contact_socials
    from public.parent_links l
    join public.enrollments e on e.student_id = l.student_id
    join public.classes c on c.id = e.class_id
    join public.profiles t on t.id = c.teacher_id
    left join public.profiles sp on sp.id = l.student_id
    where l.parent_id = _me
    group by t.id, t.full_name, t.contact_email, t.contact_phone, t.contact_whatsapp, t.contact_socials
    order by t.full_name;

  elsif _role = 'teacher' then
    return query
    select
      p.id,
      p.full_name,
      'parent'::text,
      string_agg(distinct sp.full_name, ', '),
      string_agg(distinct c.name, ', '),
      p.contact_email,
      p.contact_phone,
      p.contact_whatsapp,
      p.contact_socials
    from public.classes c
    join public.enrollments e on e.class_id = c.id
    join public.parent_links l on l.student_id = e.student_id
    join public.profiles p on p.id = l.parent_id
    left join public.profiles sp on sp.id = e.student_id
    where c.teacher_id = _me
    group by p.id, p.full_name, p.contact_email, p.contact_phone, p.contact_whatsapp, p.contact_socials
    order by p.full_name;

  elsif _role = 'student' then
    return query
    select
      t.id,
      t.full_name,
      'teacher'::text,
      null::text,
      string_agg(distinct c.name, ', '),
      t.contact_email,
      t.contact_phone,
      t.contact_whatsapp,
      t.contact_socials
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    join public.profiles t on t.id = c.teacher_id
    where e.student_id = _me
    group by t.id, t.full_name, t.contact_email, t.contact_phone, t.contact_whatsapp, t.contact_socials
    order by t.full_name;

  elsif _role = 'admin' then
    return query
    select
      p.id,
      p.full_name,
      coalesce(ur.role::text, 'user'),
      null::text,
      null::text,
      p.contact_email,
      p.contact_phone,
      p.contact_whatsapp,
      p.contact_socials
    from public.profiles p
    left join public.user_roles ur on ur.user_id = p.id
    where p.id <> _me
    order by p.full_name;

  else
    return;
  end if;
end;
$$;

revoke all on function public.get_message_contacts() from public;
grant execute on function public.get_message_contacts() to authenticated;
