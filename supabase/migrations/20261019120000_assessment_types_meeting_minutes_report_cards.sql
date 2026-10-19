-- Add assessment categories and meeting minutes/conclusions.
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS assessment_type text NOT NULL DEFAULT 'test'
  CHECK (assessment_type IN ('test', 'assignment', 'exam'));

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS minutes text,
  ADD COLUMN IF NOT EXISTS conclusions text;

-- Report card files live in a private bucket. Metadata stays in Postgres so
-- RLS can decide which teacher and linked parent may view each file.
CREATE TABLE IF NOT EXISTS public.report_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  term text,
  file_path text NOT NULL UNIQUE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_cards_student_created_idx
  ON public.report_cards (student_id, created_at DESC);

ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.report_cards TO authenticated;

CREATE POLICY "Teachers manage report cards for own classes"
  ON public.report_cards FOR ALL TO authenticated
  USING (public.is_class_teacher(class_id, auth.uid()))
  WITH CHECK (
    public.is_class_teacher(class_id, auth.uid())
    AND uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.class_id = report_cards.class_id
        AND e.student_id = report_cards.student_id
    )
  );

CREATE POLICY "Linked parents view child report cards"
  ON public.report_cards FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'parent')
    AND public.is_linked_parent(auth.uid(), student_id)
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('report-cards', 'report-cards', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf'];

CREATE POLICY "Teachers upload report cards for own classes"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'report-cards'
    AND public.is_class_teacher((storage.foldername(name))[1]::uuid, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.class_id = (storage.foldername(name))[1]::uuid
        AND e.student_id = (storage.foldername(name))[2]::uuid
    )
  );

CREATE POLICY "Parents and teachers read report card files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'report-cards'
    AND (
      public.is_class_teacher((storage.foldername(name))[1]::uuid, auth.uid())
      OR (
        public.has_role(auth.uid(), 'parent')
        AND public.is_linked_parent(auth.uid(), (storage.foldername(name))[2]::uuid)
      )
    )
  );

CREATE POLICY "Teachers delete report cards for own classes"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'report-cards'
    AND public.is_class_teacher((storage.foldername(name))[1]::uuid, auth.uid())
  );
