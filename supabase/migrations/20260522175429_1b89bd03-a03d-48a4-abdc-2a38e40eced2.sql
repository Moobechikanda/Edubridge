CREATE OR REPLACE FUNCTION public.preview_student_by_code(_code text)
RETURNS TABLE(student_id uuid, full_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  select p.id, p.full_name
  from public.profiles p
  join public.user_roles r on r.user_id = p.id and r.role = 'student'
  where upper(p.parent_code) = upper(_code)
  limit 1
$$;