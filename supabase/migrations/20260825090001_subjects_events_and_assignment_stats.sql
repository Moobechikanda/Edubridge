
-- Subjects table
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_subjects_updated BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated views subjects"
  ON public.subjects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage subjects"
  ON public.subjects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Class-subject join table
CREATE TABLE IF NOT EXISTS public.class_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, subject_id)
);

ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own class subjects"
  ON public.class_subjects FOR ALL TO authenticated
  USING (public.is_class_teacher(class_id, auth.uid()))
  WITH CHECK (public.is_class_teacher(class_id, auth.uid()));

CREATE POLICY "Enrolled students view class subjects"
  ON public.class_subjects FOR SELECT TO authenticated
  USING (public.is_class_student(class_id, auth.uid()));

CREATE POLICY "Linked parents view class subjects"
  ON public.class_subjects FOR SELECT TO authenticated
  USING (public.is_parent_of_class_student(class_id, auth.uid()));

-- Events table
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_type text NOT NULL DEFAULT 'event',
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  location text,
  audience text NOT NULL DEFAULT 'all',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated views events"
  ON public.events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage events"
  ON public.events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Teachers manage own events"
  ON public.events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'teacher') AND created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'teacher') AND created_by = auth.uid());

CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Assignment status helper
CREATE OR REPLACE FUNCTION public.get_assignment_status(_assignment_id uuid, _student_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH sub AS (
    SELECT s.submitted_at, s.graded_at, a.due_date
    FROM public.submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    WHERE s.assignment_id = _assignment_id AND s.student_id = _student_id
  )
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM sub) THEN 'not_attempted'
    WHEN sub.graded_at IS NOT NULL THEN 'completed'
    WHEN sub.due_date IS NOT NULL AND sub.submitted_at > sub.due_date THEN 'late'
    ELSE 'in_progress'
  END
  FROM sub;
$$;

-- Assignment stats for a class (teacher view)
CREATE OR REPLACE FUNCTION public.get_assignment_stats(_assignment_id uuid, _class_id uuid)
RETURNS TABLE(
  total_students bigint,
  attempted bigint,
  completed bigint,
  in_progress bigint,
  not_attempted bigint,
  missed bigint,
  late bigint,
  pending_marking bigint,
  marked bigint,
  avg_score numeric,
  highest_score numeric,
  lowest_score numeric,
  completion_percentage numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH roster AS (
    SELECT student_id FROM public.enrollments WHERE class_id = _class_id
  ),
  subs AS (
    SELECT s.student_id, s.submitted_at, s.graded_at, s.grade, a.due_date
    FROM public.submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    WHERE s.assignment_id = _assignment_id
  ),
  stats AS (
    SELECT
      COUNT(r.student_id) AS total_students,
      COUNT(s.student_id) AS attempted,
      COUNT(s.student_id) FILTER (WHERE s.graded_at IS NOT NULL) AS completed,
      COUNT(s.student_id) FILTER (WHERE s.graded_at IS NULL AND s.submitted_at IS NOT NULL) AS in_progress,
      COUNT(s.student_id) FILTER (WHERE s.submitted_at IS NOT NULL AND s.due_date IS NOT NULL AND s.submitted_at > s.due_date) AS late,
      COUNT(s.student_id) FILTER (WHERE s.grade IS NOT NULL) AS marked,
      COALESCE(AVG(s.grade), 0) AS avg_score,
      COALESCE(MAX(s.grade), 0) AS highest_score,
      COALESCE(MIN(s.grade), 0) AS lowest_score
    FROM roster r
    LEFT JOIN subs s ON s.student_id = r.student_id
  )
  SELECT
    total_students,
    attempted,
    completed,
    in_progress,
    total_students - attempted AS not_attempted,
    CASE WHEN now() > COALESCE((SELECT due_date FROM assignments WHERE id = _assignment_id), now()) THEN total_students - attempted ELSE 0 END AS missed,
    late,
    in_progress - completed AS pending_marking,
    marked,
    avg_score,
    highest_score,
    lowest_score,
    CASE WHEN total_students > 0 THEN ROUND((attempted::numeric / total_students) * 100, 1) ELSE 0 END AS completion_percentage
  FROM stats;
$$;

GRANT EXECUTE ON FUNCTION public.get_assignment_stats(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_assignment_status(uuid, uuid) TO authenticated;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subjects_name ON public.subjects(name);
CREATE INDEX IF NOT EXISTS idx_class_subjects_class ON public.class_subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_subject ON public.class_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_events_start ON public.events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(event_type);
