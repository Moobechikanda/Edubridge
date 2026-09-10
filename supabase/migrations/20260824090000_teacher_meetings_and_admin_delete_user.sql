-- Allow teachers to schedule and manage their own parent-teacher meetings
drop policy if exists "Teachers manage own meetings" on public.meetings;
create policy "Teachers manage own meetings"
on public.meetings
for all to authenticated
using (public.has_role(auth.uid(), 'teacher') and created_by = auth.uid())
with check (public.has_role(auth.uid(), 'teacher') and created_by = auth.uid());

-- Admin: permanently remove a user account (cascades to profiles/roles/etc.)
create or replace function public.admin_delete_user(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can delete users';
  end if;
  if _user_id = auth.uid() then
    raise exception 'You cannot delete your own account';
  end if;
  delete from auth.users where id = _user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
