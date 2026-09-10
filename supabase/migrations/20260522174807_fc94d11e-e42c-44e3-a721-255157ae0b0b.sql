-- Track which announcements a user has read
create table public.announcement_reads (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null,
  read_at timestamp with time zone not null default now(),
  unique (announcement_id, user_id)
);

alter table public.announcement_reads enable row level security;

create policy "Users manage own reads"
  on public.announcement_reads for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_announcement_reads_user on public.announcement_reads(user_id);

-- Allow admins to read aggregate counts across core tables
create policy "Admins view all profiles"
  on public.profiles for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins view all classes"
  on public.classes for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins view all announcements"
  on public.announcements for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins view all enrollments"
  on public.enrollments for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins view all user_roles"
  on public.user_roles for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));