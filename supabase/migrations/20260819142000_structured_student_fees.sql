-- Structured student fees module

create table if not exists public.student_fees (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  amount numeric(12, 2) not null check (amount >= 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  currency text not null default 'ZMW',
  due_date date not null,
  status text not null default 'outstanding',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_fees_status_check check (status in ('outstanding', 'partially_paid', 'paid', 'waived')),
  constraint student_fees_paid_lte_total check (amount_paid <= amount)
);

create index if not exists student_fees_student_idx on public.student_fees (student_id);
create index if not exists student_fees_status_idx on public.student_fees (status);
create index if not exists student_fees_due_date_idx on public.student_fees (due_date);

create trigger trg_student_fees_updated
before update on public.student_fees
for each row execute function public.set_updated_at();

alter table public.student_fees enable row level security;

drop policy if exists "Admins manage student fees" on public.student_fees;
create policy "Admins manage student fees"
on public.student_fees
for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Parents view linked child fees" on public.student_fees;
create policy "Parents view linked child fees"
on public.student_fees
for select to authenticated
using (public.is_linked_parent(auth.uid(), student_id));

drop policy if exists "Students view own fees" on public.student_fees;
create policy "Students view own fees"
on public.student_fees
for select to authenticated
using (student_id = auth.uid());
