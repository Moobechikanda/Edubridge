CREATE OR REPLACE FUNCTION public.preview_student_by_code(_code text)
RETURNS TABLE(student_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name
  FROM public.profiles p
  JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'student'
  WHERE upper(p.student_code) = upper(_code)
     OR upper(p.parent_code) = upper(_code)
  ORDER BY (upper(p.student_code) = upper(_code)) DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.link_child_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'parent') THEN
    RAISE EXCEPTION 'Only parents can link children';
  END IF;

  SELECT p.id INTO _student
  FROM public.profiles p
  JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'student'
  WHERE upper(p.student_code) = upper(_code)
     OR upper(p.parent_code) = upper(_code)
  ORDER BY (upper(p.student_code) = upper(_code)) DESC
  LIMIT 1;

  IF _student IS NULL THEN
    RAISE EXCEPTION 'No student found for that code';
  END IF;

  INSERT INTO public.parent_links (parent_id, student_id)
  VALUES (auth.uid(), _student)
  ON CONFLICT DO NOTHING;

  RETURN _student;
END;
$$;

REVOKE ALL ON FUNCTION public.preview_student_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_student_by_code(text) TO authenticated;
REVOKE ALL ON FUNCTION public.link_child_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_child_by_code(text) TO authenticated;
