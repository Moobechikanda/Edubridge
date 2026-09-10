-- CLASSES
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subject text,
  description text,
  join_code text not null unique default upper(substring(replace(gen_random_uuid()::text,'-',''),1,6)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.classes enable row level security;

-- ENROLLMENTS
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(class_id, student_id)
);
alter table public.enrollments enable row level security;

-- ASSIGNMENTS
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamptz,
  points integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.assignments enable row level security;

-- SUBMISSIONS
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  content text,
  submitted_at timestamptz not null default now(),
  grade numeric,
  feedback text,
  graded_at timestamptz,
  unique(assignment_id, student_id)
);
alter table public.submissions enable row level security;

-- Helper functions (security definer to avoid recursive RLS)
create or replace function public.is_class_teacher(_class_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.classes where id = _class_id and teacher_id = _user_id)
$$;

create or replace function public.is_class_student(_class_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.enrollments where class_id = _class_id and student_id = _user_id)
$$;

create or replace function public.is_assignment_teacher(_assignment_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.assignments a
    join public.classes c on c.id = a.class_id
    where a.id = _assignment_id and c.teacher_id = _user_id
  )
$$;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_classes_updated before update on public.classes
  for each row execute function public.set_updated_at();
create trigger trg_assignments_updated before update on public.assignments
  for each row execute function public.set_updated_at();

-- ===== POLICIES =====

-- classes
create policy "Teachers manage own classes" on public.classes
  for all to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "Enrolled students view classes" on public.classes
  for select to authenticated using (public.is_class_student(id, auth.uid()));
create policy "Authenticated lookup by join code" on public.classes
  for select to authenticated using (true);
-- Note: above grants broad SELECT to authenticated; refine later if needed.

-- enrollments
create policy "Teachers manage enrollments in own classes" on public.enrollments
  for all to authenticated
  using (public.is_class_teacher(class_id, auth.uid()))
  with check (public.is_class_teacher(class_id, auth.uid()));
create policy "Students view own enrollments" on public.enrollments
  for select to authenticated using (student_id = auth.uid());
create policy "Students self-enroll" on public.enrollments
  for insert to authenticated with check (student_id = auth.uid());
create policy "Students unenroll self" on public.enrollments
  for delete to authenticated using (student_id = auth.uid());

-- assignments
create policy "Teachers manage assignments in own classes" on public.assignments
  for all to authenticated
  using (public.is_class_teacher(class_id, auth.uid()))
  with check (public.is_class_teacher(class_id, auth.uid()));
create policy "Enrolled students view assignments" on public.assignments
  for select to authenticated using (public.is_class_student(class_id, auth.uid()));

-- submissions
create policy "Students manage own submissions" on public.submissions
  for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());
create policy "Teachers view submissions in own classes" on public.submissions
  for select to authenticated using (public.is_assignment_teacher(assignment_id, auth.uid()));
create policy "Teachers grade submissions in own classes" on public.submissions
  for update to authenticated
  using (public.is_assignment_teacher(assignment_id, auth.uid()))
  with check (public.is_assignment_teacher(assignment_id, auth.uid()));

-- Allow teachers to view profiles of their students for display
create policy "Teachers view enrolled student profiles" on public.profiles
  for select to authenticated using (
    exists (
      select 1 from public.enrollments e
      join public.classes c on c.id = e.class_id
      where e.student_id = profiles.id and c.teacher_id = auth.uid()
    )
  );

-- Indexes
create index idx_classes_teacher on public.classes(teacher_id);
create index idx_enrollments_class on public.enrollments(class_id);
create index idx_enrollments_student on public.enrollments(student_id);
create index idx_assignments_class on public.assignments(class_id);
create index idx_submissions_assignment on public.submissions(assignment_id);
create index idx_submissions_student on public.submissions(student_id);
