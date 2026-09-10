
-- MESSAGES
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null,
  recipient_id uuid not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_pair_idx on public.messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc);
create index messages_recipient_idx on public.messages (recipient_id, read_at);
alter table public.messages enable row level security;

create policy "Users view own messages" on public.messages
  for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy "Users send messages" on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid());

create policy "Recipients mark read" on public.messages
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;

create policy "Users view own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "Users update own notifications" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "System inserts notifications" on public.notifications
  for insert to authenticated with check (true);

-- ADMIN: change a user's role
create or replace function public.admin_set_role(_user_id uuid, _role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can change roles';
  end if;
  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles (user_id, role) values (_user_id, _role);
end;
$$;

-- AUTO NOTIFICATIONS: on announcement -> notify enrolled students & linked parents
create or replace function public.notify_on_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  select e.student_id, 'announcement', new.title, left(new.body, 200), '/student'
  from public.enrollments e where e.class_id = new.class_id;

  insert into public.notifications (user_id, type, title, body, link)
  select distinct l.parent_id, 'announcement', new.title, left(new.body, 200), '/parent/announcements'
  from public.enrollments e
  join public.parent_links l on l.student_id = e.student_id
  where e.class_id = new.class_id;
  return new;
end;
$$;
create trigger trg_notify_announcement after insert on public.announcements
  for each row execute function public.notify_on_announcement();

-- AUTO NOTIFICATIONS: on submission graded -> notify student & linked parents
create or replace function public.notify_on_grade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare _title text;
begin
  if new.grade is null then return new; end if;
  if old.grade is not distinct from new.grade then return new; end if;

  select 'Grade posted: ' || a.title into _title from public.assignments a where a.id = new.assignment_id;

  insert into public.notifications (user_id, type, title, body, link)
  values (new.student_id, 'grade', coalesce(_title, 'New grade'),
          'Score: ' || new.grade::text, '/student/assignments/' || new.assignment_id::text);

  insert into public.notifications (user_id, type, title, body, link)
  select l.parent_id, 'grade', coalesce(_title, 'New grade'),
         'Score: ' || new.grade::text, '/parent/children/' || new.student_id::text
  from public.parent_links l where l.student_id = new.student_id;
  return new;
end;
$$;
create trigger trg_notify_grade after update on public.submissions
  for each row execute function public.notify_on_grade();

-- AUTO NOTIFICATIONS: on new message
create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  values (new.recipient_id, 'message', 'New message', left(new.body, 140), '/messages');
  return new;
end;
$$;
create trigger trg_notify_message after insert on public.messages
  for each row execute function public.notify_on_message();
