-- ============================================================
-- Phase 1: Relational schema — schools, academic years, terms
-- ============================================================

-- Schools
CREATE TABLE IF NOT EXISTS public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  address text,
  phone text,
  email text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_schools_updated BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users view schools"
  ON public.schools FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage schools"
  ON public.schools FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Academic years
CREATE TABLE IF NOT EXISTS public.academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, name)
);

CREATE TRIGGER trg_academic_years_updated BEFORE UPDATE ON public.academic_years
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users view academic years"
  ON public.academic_years FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage academic years"
  ON public.academic_years FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Terms / semesters
CREATE TABLE IF NOT EXISTS public.terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(academic_year_id, name)
);

CREATE TRIGGER trg_terms_updated BEFORE UPDATE ON public.terms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users view terms"
  ON public.terms FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage terms"
  ON public.terms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Add school_id and academic_year_id to classes (nullable for backward compat)
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL;

-- Add status to enrollments (backward compatible)
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'withdrawn', 'transferred')),
  ADD COLUMN IF NOT EXISTS enrolled_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Teaching assignments (proper teacher-class-subject relation)
CREATE TABLE IF NOT EXISTS public.teaching_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'co_teacher', 'assistant')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, class_id, subject_id, academic_year_id)
);

ALTER TABLE public.teaching_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own assignments"
  ON public.teaching_assignments FOR ALL TO authenticated
  USING (public.is_class_teacher(class_id, auth.uid()))
  WITH CHECK (public.is_class_teacher(class_id, auth.uid()));

CREATE POLICY "Admins manage all assignments"
  ON public.teaching_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Enrolled students view assignments"
  ON public.teaching_assignments FOR SELECT TO authenticated
  USING (public.is_class_student(class_id, auth.uid()));

CREATE POLICY "Linked parents view assignments"
  ON public.teaching_assignments FOR SELECT TO authenticated
  USING (public.is_parent_of_class_student(class_id, auth.uid()));

-- Conversations for threaded messaging
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(creator_id)
);

CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own conversations"
  ON public.conversations FOR SELECT TO authenticated USING (auth.uid() = creator_id);

CREATE POLICY "Users create own conversations"
  ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users update own conversations"
  ON public.conversations FOR UPDATE TO authenticated USING (auth.uid() = creator_id);

CREATE POLICY "Users delete own conversations"
  ON public.conversations FOR DELETE TO authenticated USING (auth.uid() = creator_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_classes_school_id ON public.classes(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_academic_year_id ON public.classes(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_academic_years_school_id ON public.academic_years(school_id);
CREATE INDEX IF NOT EXISTS idx_terms_academic_year_id ON public.terms(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.enrollments(status);
CREATE INDEX IF NOT EXISTS idx_teaching_assignments_teacher ON public.teaching_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teaching_assignments_class ON public.teaching_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_teaching_assignments_subject ON public.teaching_assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_teaching_assignments_year ON public.teaching_assignments(academic_year_id);

-- Set current academic year for existing data
-- (No-op if no schools exist yet; admins will configure later)
