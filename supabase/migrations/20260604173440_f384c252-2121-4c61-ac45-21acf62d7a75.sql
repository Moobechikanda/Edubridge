
-- ===================== MEETING RSVPs =====================
CREATE TABLE public.meeting_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('yes','no','maybe')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_rsvps TO authenticated;
GRANT ALL ON public.meeting_rsvps TO service_role;
ALTER TABLE public.meeting_rsvps ENABLE ROW LEVEL SECURITY;

-- Users manage their own RSVP
CREATE POLICY "users manage own rsvp" ON public.meeting_rsvps
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- Admins & teachers can read all RSVPs (to see who's coming)
CREATE POLICY "staff read rsvps" ON public.meeting_rsvps
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher')
  );

CREATE TRIGGER trg_meeting_rsvps_updated BEFORE UPDATE ON public.meeting_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===================== ASSESSMENT SCORES =====================
CREATE TABLE public.assessment_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  score numeric NOT NULL CHECK (score >= 0),
  feedback text,
  graded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_scores TO authenticated;
GRANT ALL ON public.assessment_scores TO service_role;
ALTER TABLE public.assessment_scores ENABLE ROW LEVEL SECURITY;

-- Teacher of the class can manage scores
CREATE POLICY "teacher manage scores" ON public.assessment_scores
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.assessments a
            JOIN public.classes c ON c.id = a.class_id
            WHERE a.id = assessment_id AND c.teacher_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.assessments a
            JOIN public.classes c ON c.id = a.class_id
            WHERE a.id = assessment_id AND c.teacher_id = auth.uid())
  );
-- Student sees own; parent sees linked child's; admin sees all
CREATE POLICY "student read own score" ON public.assessment_scores
  FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "parent read child score" ON public.assessment_scores
  FOR SELECT TO authenticated USING (public.is_linked_parent(auth.uid(), student_id));
CREATE POLICY "admin read all scores" ON public.assessment_scores
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_assessment_scores_updated BEFORE UPDATE ON public.assessment_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notify student + parents when an assessment score is posted/updated, respecting 'grades' pref
CREATE OR REPLACE FUNCTION public.notify_on_assessment_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _title text; _pref boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.score IS NOT DISTINCT FROM NEW.score THEN RETURN NEW; END IF;
  SELECT 'Assessment score: ' || a.title INTO _title FROM public.assessments a WHERE a.id = NEW.assessment_id;

  _pref := public.notif_pref(NEW.student_id, 'grades');
  IF _pref THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.student_id, 'grade', COALESCE(_title,'Assessment score'), 'Score: ' || NEW.score::text, '/student');
  END IF;
  INSERT INTO public.notification_audit_log (user_id, kind, source_id, delivered, reason)
  VALUES (NEW.student_id, 'assessment_score', NEW.assessment_id, _pref,
          CASE WHEN _pref THEN 'opt-in' ELSE 'opt-out' END);

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT l.parent_id, 'grade', COALESCE(_title,'Assessment score'),
         'Score: ' || NEW.score::text, '/parent/children/' || NEW.student_id::text
  FROM public.parent_links l
  WHERE l.student_id = NEW.student_id AND public.notif_pref(l.parent_id,'grades');

  INSERT INTO public.notification_audit_log (user_id, kind, source_id, delivered, reason)
  SELECT l.parent_id, 'assessment_score', NEW.assessment_id,
         public.notif_pref(l.parent_id,'grades'),
         CASE WHEN public.notif_pref(l.parent_id,'grades') THEN 'opt-in' ELSE 'opt-out' END
  FROM public.parent_links l WHERE l.student_id = NEW.student_id;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_assessment_score
AFTER INSERT OR UPDATE OF score ON public.assessment_scores
FOR EACH ROW EXECUTE FUNCTION public.notify_on_assessment_score();

-- ===================== UPDATED RANKINGS (include assessment_scores) =====================
CREATE OR REPLACE FUNCTION public.get_class_rankings(_class_id uuid)
RETURNS TABLE(student_id uuid, full_name text, total_points numeric, graded_count bigint, rank bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH allowed AS (
    SELECT 1 WHERE public.is_class_teacher(_class_id, auth.uid())
       OR public.is_class_student(_class_id, auth.uid())
       OR public.is_parent_of_class_student(_class_id, auth.uid())
       OR public.has_role(auth.uid(), 'admin')
  ),
  assignment_pts AS (
    SELECT e.student_id,
           COALESCE(SUM(s.grade),0)::numeric AS pts,
           COUNT(s.grade) AS cnt
    FROM public.enrollments e
    LEFT JOIN public.assignments a ON a.class_id = e.class_id
    LEFT JOIN public.submissions s ON s.assignment_id = a.id AND s.student_id = e.student_id
    WHERE e.class_id = _class_id
    GROUP BY e.student_id
  ),
  assessment_pts AS (
    SELECT e.student_id,
           COALESCE(SUM(asc2.score),0)::numeric AS pts,
           COUNT(asc2.score) AS cnt
    FROM public.enrollments e
    LEFT JOIN public.assessments ass ON ass.class_id = e.class_id
    LEFT JOIN public.assessment_scores asc2 ON asc2.assessment_id = ass.id AND asc2.student_id = e.student_id
    WHERE e.class_id = _class_id
    GROUP BY e.student_id
  ),
  scored AS (
    SELECT e.student_id, p.full_name,
           (COALESCE(ap.pts,0) + COALESCE(xp.pts,0))::numeric AS total_points,
           (COALESCE(ap.cnt,0) + COALESCE(xp.cnt,0))::bigint AS graded_count
    FROM public.enrollments e
    JOIN public.profiles p ON p.id = e.student_id
    LEFT JOIN assignment_pts ap ON ap.student_id = e.student_id
    LEFT JOIN assessment_pts xp ON xp.student_id = e.student_id
    WHERE e.class_id = _class_id AND EXISTS (SELECT 1 FROM allowed)
  )
  SELECT student_id, full_name, total_points, graded_count,
         RANK() OVER (ORDER BY total_points DESC) AS rank
  FROM scored ORDER BY rank, full_name;
$$;

-- ===================== RSVP helper RPC =====================
CREATE OR REPLACE FUNCTION public.rsvp_meeting(_meeting_id uuid, _status text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _status NOT IN ('yes','no','maybe') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  INSERT INTO public.meeting_rsvps (meeting_id, user_id, status, note)
  VALUES (_meeting_id, auth.uid(), _status, _note)
  ON CONFLICT (meeting_id, user_id) DO UPDATE
    SET status = EXCLUDED.status, note = EXCLUDED.note, updated_at = now();
END; $$;
REVOKE ALL ON FUNCTION public.rsvp_meeting(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rsvp_meeting(uuid,text,text) TO authenticated;

-- ===================== Meeting attendee list (teachers/admins) =====================
CREATE OR REPLACE FUNCTION public.get_meeting_attendees(_meeting_id uuid)
RETURNS TABLE(user_id uuid, full_name text, status text, note text, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.user_id, p.full_name, r.status, r.note, r.updated_at
  FROM public.meeting_rsvps r
  JOIN public.profiles p ON p.id = r.user_id
  WHERE r.meeting_id = _meeting_id
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher'))
  ORDER BY r.status, p.full_name;
$$;
REVOKE ALL ON FUNCTION public.get_meeting_attendees(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_meeting_attendees(uuid) TO authenticated;
