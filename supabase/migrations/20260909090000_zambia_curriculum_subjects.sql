-- Grade-aware curriculum catalogue for Zambian primary and secondary schools.
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS grade_level smallint;

ALTER TABLE public.classes
  DROP CONSTRAINT IF EXISTS classes_grade_level_check;
ALTER TABLE public.classes
  ADD CONSTRAINT classes_grade_level_check CHECK (grade_level BETWEEN 1 AND 12);

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS min_grade smallint,
  ADD COLUMN IF NOT EXISTS max_grade smallint;

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_grade_range_check;
ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_grade_range_check CHECK (
    (min_grade IS NULL AND max_grade IS NULL)
    OR (min_grade BETWEEN 1 AND 12 AND max_grade BETWEEN min_grade AND 12)
  );

INSERT INTO public.subjects (name, code, description, min_grade, max_grade)
VALUES
  ('English', 'ENG-PR', 'Zambia curriculum starter subject', 1, 7),
  ('Zambian Languages', 'ZL-PR', 'Zambia curriculum starter subject', 1, 7),
  ('Mathematics', 'MATH-PR', 'Zambia curriculum starter subject', 1, 7),
  ('Integrated Science', 'IS-PR', 'Zambia curriculum starter subject', 1, 7),
  ('Social Studies', 'SS-PR', 'Zambia curriculum starter subject', 1, 7),
  ('Religious Education', 'RE-PR', 'Zambia curriculum starter subject', 1, 7),
  ('Creative and Technology Studies', 'CTS-PR', 'Zambia curriculum starter subject', 1, 7),
  ('French', 'FRE-PR', 'Zambia curriculum starter subject', 1, 7),
  ('Chinese', 'CHI-PR', 'Zambia curriculum starter subject', 1, 7),
  ('English', 'ENG-JS', 'Zambia curriculum starter subject', 8, 9),
  ('Mathematics', 'MATH-JS', 'Zambia curriculum starter subject', 8, 9),
  ('Integrated Science', 'IS-JS', 'Zambia curriculum starter subject', 8, 9),
  ('Agriculture', 'AGR-JS', 'Zambia curriculum starter subject', 8, 9),
  ('History', 'HIS-JS', 'Zambia curriculum starter subject', 8, 9),
  ('Geography', 'GEO-JS', 'Zambia curriculum starter subject', 8, 9),
  ('Business Studies', 'BST-JS', 'Zambia curriculum starter subject', 8, 9),
  ('Religious Education', 'RE-JS', 'Zambia curriculum starter subject', 8, 9),
  ('Civic Education', 'CE-JS', 'Zambia curriculum starter subject', 8, 9),
  ('Zambian Languages', 'ZL-JS', 'Zambia curriculum starter subject', 8, 9),
  ('French', 'FRE-JS', 'Zambia curriculum starter subject', 8, 9),
  ('Chinese', 'CHI-JS', 'Zambia curriculum starter subject', 8, 9),
  ('Information and Communication Technology', 'ICT-JS', 'Zambia curriculum starter subject', 8, 9),
  ('Design and Technology', 'DT-JS', 'Zambia curriculum starter subject', 8, 9),
  ('Art and Design', 'AD-JS', 'Zambia curriculum starter subject', 8, 9),
  ('Music', 'MUS-JS', 'Zambia curriculum starter subject', 8, 9),
  ('Physical Education', 'PE-JS', 'Zambia curriculum starter subject', 8, 9),
  ('English', 'ENG-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Mathematics', 'MATH-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Biology', 'BIO-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Chemistry', 'CHEM-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Physics', 'PHY-SS', 'Zambia curriculum starter subject', 10, 12),
  ('History', 'HIS-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Geography', 'GEO-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Commerce', 'COM-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Accounts', 'ACC-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Economics', 'ECO-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Literature in English', 'LIT-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Religious Education (2044 / 2046)', 'RE-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Zambian Languages', 'ZL-SS', 'Zambia curriculum starter subject', 10, 12),
  ('French', 'FRE-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Chinese', 'CHI-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Computer Science', 'CS-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Information and Communication Technology', 'ICT-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Design and Technology', 'DT-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Agricultural Science', 'AGR-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Art and Design', 'AD-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Music', 'MUS-SS', 'Zambia curriculum starter subject', 10, 12),
  ('Civic Education', 'CE-SS', 'Zambia curriculum starter subject', 10, 12)
ON CONFLICT (code) DO NOTHING;