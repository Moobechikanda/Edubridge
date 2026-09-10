
-- 1. parent_code on profiles
alter table public.profiles
  add column if not exists parent_code text unique
  default upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));

-- Backfill any existing null parent_codes
update public.profiles
set parent_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6))
where parent_code is null;

alter table public.profiles alter column parent_code set not null;

-- 2. parent_links
create table if not exists public.parent_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null,
  student_id uuid not null,
  created_at timestamptz not null default now(),
  unique (parent_id, student_id)
);

alter table public.parent_links enable row level security;

create policy "Parents view own links"
on public.parent_links for select to authenticated
using (parent_id = auth.uid() or student_id = auth.uid());

create policy "Parents insert own links"
on public.parent_links for insert to authenticated
with check (parent_id = auth.uid() and public.has_role(auth.uid(), 'parent'));

create policy "Parents delete own links"
on public.parent_links for delete to authenticated
using (parent_id = auth.uid());

-- Helper: is this user a linked parent of this student
create or replace function public.is_linked_parent(_parent_id uuid, _student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.parent_links where parent_id = _parent_id and student_id = _student_id)
$$;

revoke all on function public.is_linked_parent(uuid, uuid) from public;
grant execute on function public.is_linked_parent(uuid, uuid) to authenticated;

-- 3. Resolve student by parent_code (security definer so parents can look up without reading other profiles)
create or replace function public.link_child_by_code(_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _student uuid;
begin
  if not public.has_role(auth.uid(), 'parent') then
    raise exception 'Only parents can link children';
  end if;

  select p.id into _student
  from public.profiles p
  join public.user_roles r on r.user_id = p.id and r.role = 'student'
  where upper(p.parent_code) = upper(_code);

  if _student is null then
    raise exception 'No student found for that code';
  end if;

  insert into public.parent_links (parent_id, student_id)
  values (auth.uid(), _student)
  on conflict do nothing;

  return _student;
end;
$$;

revoke all on function public.link_child_by_code(text) from public;
grant execute on function public.link_child_by_code(text) to authenticated;

-- Extend profile/assignment/submission/enrollment visibility for linked parents
create policy "Linked parents view child profiles"
on public.profiles for select to authenticated
using (public.is_linked_parent(auth.uid(), id));

create policy "Linked parents view child enrollments"
on public.enrollments for select to authenticated
using (public.is_linked_parent(auth.uid(), student_id));

create policy "Linked parents view child submissions"
on public.submissions for select to authenticated
using (public.is_linked_parent(auth.uid(), student_id));

-- Parents need to see classes their children are enrolled in
create or replace function public.is_parent_of_class_student(_class_id uuid, _parent_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.enrollments e
    join public.parent_links l on l.student_id = e.student_id
    where e.class_id = _class_id and l.parent_id = _parent_id
  )
$$;
revoke all on function public.is_parent_of_class_student(uuid, uuid) from public;
grant execute on function public.is_parent_of_class_student(uuid, uuid) to authenticated;

create policy "Linked parents view child classes"
on public.classes for select to authenticated
using (public.is_parent_of_class_student(id, auth.uid()));

create policy "Linked parents view child assignments"
on public.assignments for select to authenticated
using (public.is_parent_of_class_student(class_id, auth.uid()));

-- 4. announcements
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists announcements_class_idx on public.announcements(class_id, created_at desc);

alter table public.announcements enable row level security;

create policy "Teachers manage class announcements"
on public.announcements for all to authenticated
using (public.is_class_teacher(class_id, auth.uid()))
with check (public.is_class_teacher(class_id, auth.uid()) and teacher_id = auth.uid());

create policy "Enrolled students view announcements"
on public.announcements for select to authenticated
using (public.is_class_student(class_id, auth.uid()));

create policy "Linked parents view announcements"
on public.announcements for select to authenticated
using (public.is_parent_of_class_student(class_id, auth.uid()));
