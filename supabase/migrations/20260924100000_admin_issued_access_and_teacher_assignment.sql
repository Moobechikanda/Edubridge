-- Accounts are provisioned by administrators. These identifiers are never
-- exposed through public profile lookups; parents use the existing secure RPC.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS student_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS teacher_qualifications text;

CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change roles';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);

  IF _role = 'student' THEN
    UPDATE public.profiles
    SET student_code = COALESCE(
      student_code,
      upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
    )
    WHERE id = _user_id;
  END IF;
END;
$$;

UPDATE public.profiles p
SET student_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
FROM public.user_roles r
WHERE r.user_id = p.id
  AND r.role = 'student'
  AND p.student_code IS NULL;

CREATE OR REPLACE FUNCTION public.issue_student_code(_student_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can issue student codes';
  END IF;

  IF NOT public.has_role(_student_id, 'student') THEN
    RAISE EXCEPTION 'Codes can only be issued to students';
  END IF;

  _code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  UPDATE public.profiles SET student_code = _code WHERE id = _student_id;
  RETURN _code;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_student_code(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.issue_student_code(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins update managed profile details" ON public.profiles;
CREATE POLICY "Admins update managed profile details"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage classes" ON public.classes;
CREATE POLICY "Admins manage classes"
ON public.classes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Teachers manage own classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers view assigned classes" ON public.classes;
CREATE POLICY "Teachers view assigned classes"
ON public.classes FOR SELECT TO authenticated
USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
