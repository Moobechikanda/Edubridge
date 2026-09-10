revoke execute on function public.is_class_teacher(uuid, uuid) from public, anon;
revoke execute on function public.is_class_student(uuid, uuid) from public, anon;
revoke execute on function public.is_assignment_teacher(uuid, uuid) from public, anon;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.is_class_teacher(uuid, uuid) to authenticated;
grant execute on function public.is_class_student(uuid, uuid) to authenticated;
grant execute on function public.is_assignment_teacher(uuid, uuid) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;