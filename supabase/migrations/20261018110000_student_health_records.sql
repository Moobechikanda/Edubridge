CREATE TABLE public.student_health_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recorded_by uuid NOT NULL REFERENCES public.profiles(id),
  category text NOT NULL DEFAULT 'General',
  title text NOT NULL,
  details text NOT NULL,
  recorded_at date NOT NULL DEFAULT CURRENT_DATE,
  follow_up_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX student_health_records_student_date_idx
  ON public.student_health_records (student_id, recorded_at DESC);

ALTER TABLE public.student_health_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage student health records"
  ON public.student_health_records
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND recorded_by = auth.uid()
  );

CREATE POLICY "Linked parents view student health records"
  ON public.student_health_records
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'parent')
    AND public.is_linked_parent(auth.uid(), student_id)
  );
