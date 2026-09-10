CREATE POLICY "Teachers manage own school news"
ON public.school_announcements
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'teacher') AND posted_by = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'teacher') AND posted_by = auth.uid());

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('teacher','admin')
  )
$$;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

CREATE POLICY "Staff profiles visible to all authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_staff(id));

CREATE OR REPLACE FUNCTION public.is_parent_of_my_student(_parent_id uuid, _teacher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1
    from public.parent_links l
    join public.enrollments e on e.student_id = l.student_id
    join public.classes c on c.id = e.class_id
    where l.parent_id = _parent_id and c.teacher_id = _teacher_id
  )
$$;

REVOKE ALL ON FUNCTION public.is_parent_of_my_student(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_parent_of_my_student(uuid, uuid) TO authenticated;

CREATE POLICY "Teachers view parents of their students"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_parent_of_my_student(id, auth.uid()));