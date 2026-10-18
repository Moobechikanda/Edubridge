import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Contact2, RotateCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/parent/children/$studentId")({
  component: ChildProgress,
});

function ChildProgress() {
  const { studentId } = Route.useParams();

  const { data: profile, isError: profileError } = useQuery({
    queryKey: ["child-profile", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, contact_email, contact_phone, contact_whatsapp, contact_socials")
        .eq("id", studentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const {
    data: enrollments = [],
    isLoading: enrollmentsLoading,
    isError: enrollmentsError,
    refetch: refetchEnrollments,
  } = useQuery({
    queryKey: ["child-enrollments", studentId],
    queryFn: async () => {
      const { data: enr, error: enrollmentError } = await supabase
        .from("enrollments")
        .select("class_id, classes(id, name, subject, teacher_id)")
        .eq("student_id", studentId);
      if (enrollmentError) throw enrollmentError;

      const teacherIds = Array.from(
        new Set((enr ?? []).map((e) => e.classes?.teacher_id).filter(Boolean)),
      );
      const { data: teachers, error: teacherError } = teacherIds.length
        ? await supabase
            .from("profiles")
            .select(
              "id, full_name, contact_email, contact_phone, contact_whatsapp, contact_socials",
            )
            .in("id", teacherIds)
        : { data: [], error: null };
      if (teacherError) throw teacherError;
      const teacherMap = new Map((teachers ?? []).map((t) => [t.id, t]));

      return (enr ?? []).map((e) => ({
        ...e,
        teacher: teacherMap.get(e.classes?.teacher_id),
      }));
    },
  });

  const classIds = enrollments.map((enrollment) => enrollment.class_id);

  const {
    data: assessments = [],
    isLoading: assessmentsLoading,
    isError: assessmentsError,
    refetch: refetchAssessments,
  } = useQuery({
    queryKey: ["parent-child-assessments", studentId, classIds.join(",")],
    enabled: classIds.length > 0,
    queryFn: async () => {
      const { data: assessmentRows, error: assessmentError } = await supabase
        .from("assessments")
        .select("id, title, points, scheduled_at, class_id")
        .in("class_id", classIds)
        .order("scheduled_at", { ascending: false });
      if (assessmentError) throw assessmentError;

      const assessmentIds = (assessmentRows ?? []).map((assessment) => assessment.id);
      if (assessmentIds.length === 0) return [];

      const { data: scoreRows, error: scoreError } = await supabase
        .from("assessment_scores")
        .select("assessment_id, score, feedback")
        .eq("student_id", studentId)
        .in("assessment_id", assessmentIds);
      if (scoreError) throw scoreError;

      const scoreMap = new Map((scoreRows ?? []).map((score) => [score.assessment_id, score]));
      return (assessmentRows ?? []).map((assessment) => ({
        ...assessment,
        score: scoreMap.get(assessment.id) ?? null,
      }));
    },
  });

  const {
    data: healthRecords = [],
    isLoading: healthRecordsLoading,
    isError: healthRecordsError,
    refetch: refetchHealthRecords,
  } = useQuery({
    queryKey: ["parent-child-health-records", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_health_records")
        .select("id, category, title, details, recorded_at, follow_up_date")
        .eq("student_id", studentId)
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const {
    data: assignments = [],
    isLoading: assignmentsLoading,
    isError: assignmentsError,
    refetch: refetchAssignments,
  } = useQuery({
    queryKey: ["child-assignments", studentId, enrollments.map((e) => e.class_id).join(",")],
    enabled: enrollments.length > 0,
    queryFn: async () => {
      const classIds = enrollments.map((e) => e.class_id);
      const { data: assigns, error: assignmentsError } = await supabase
        .from("assignments")
        .select("id, title, assignment_type, due_date, points, class_id, classes(name)")
        .in("class_id", classIds)
        .order("due_date", { ascending: false, nullsFirst: false });
      if (assignmentsError) throw assignmentsError;
      const ids = (assigns ?? []).map((a) => a.id);
      if (ids.length === 0) return [];
      const { data: subs, error: submissionsError } = await supabase
        .from("submissions")
        .select("assignment_id, grade, submitted_at, graded_at, feedback")
        .eq("student_id", studentId)
        .in("assignment_id", ids);
      if (submissionsError) throw submissionsError;
      const subMap = new Map((subs ?? []).map((s) => [s.assignment_id, s]));
      return (assigns ?? []).map((a) => ({ ...a, submission: subMap.get(a.id) }));
    },
  });

  const graded = assignments.filter((a) => a.submission?.grade != null);
  const avg = graded.length
    ? graded.reduce((sum, a) => sum + (Number(a.submission!.grade) / a.points) * 100, 0) /
      graded.length
    : null;

  return (
    <PortalShell
      title={profile?.full_name ?? "Child"}
      subtitle="Progress across all classes and assignments."
    >
      <Link
        to="/parent/children"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to children
      </Link>

      {profileError && (
        <Card className="mb-6 p-5" role="alert">
          <p className="text-sm text-destructive">Could not load this student&apos;s profile.</p>
        </Card>
      )}

      {enrollmentsError && (
        <Card className="mb-6 p-5" role="alert">
          <p className="text-sm text-destructive">Could not load this student&apos;s classes.</p>
          <Button variant="outline" size="sm" onClick={() => refetchEnrollments()} className="mt-3">
            <RotateCw className="mr-2 h-4 w-4" /> Try again
          </Button>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Enrolled classes</div>
          <div className="text-2xl font-semibold mt-1">{enrollments.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Assignments</div>
          <div className="text-2xl font-semibold mt-1">{assignments.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Average score</div>
          <div className="text-2xl font-semibold mt-1">
            {avg != null ? `${avg.toFixed(1)}%` : "—"}
          </div>
        </Card>
      </div>

      {(profile?.contact_email ||
        profile?.contact_phone ||
        profile?.contact_whatsapp ||
        profile?.contact_socials) && (
        <Card className="p-6 mb-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Contact2 className="h-4 w-4" /> Contact information
          </h2>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {profile?.contact_email && (
              <div>
                <span className="text-muted-foreground">Email: </span>
                {profile.contact_email}
              </div>
            )}
            {profile?.contact_phone && (
              <div>
                <span className="text-muted-foreground">Phone: </span>
                {profile.contact_phone}
              </div>
            )}
            {profile?.contact_whatsapp && (
              <div>
                <span className="text-muted-foreground">WhatsApp: </span>
                {profile.contact_whatsapp}
              </div>
            )}
            {profile?.contact_socials && (
              <div>
                <span className="text-muted-foreground">Social: </span>
                {profile.contact_socials}
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="p-6 mb-6">
        <h2 className="font-semibold mb-4">Health records</h2>
        {healthRecordsLoading ? (
          <p className="text-sm text-muted-foreground" role="status">
            Loading health records…
          </p>
        ) : healthRecordsError ? (
          <div>
            <p className="text-sm text-destructive">Could not load health records.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchHealthRecords()}
              className="mt-3"
            >
              <RotateCw className="mr-2 h-4 w-4" /> Try again
            </Button>
          </div>
        ) : healthRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground">No health records have been added.</p>
        ) : (
          <ul className="divide-y">
            {healthRecords.map((record) => (
              <li key={record.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{record.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{record.category}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(`${record.recorded_at}T00:00:00`).toLocaleDateString()}
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{record.details}</p>
                {record.follow_up_date && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Follow-up: {new Date(`${record.follow_up_date}T00:00:00`).toLocaleDateString()}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6 mb-6">
        <h2 className="font-semibold mb-4">Assessment feed</h2>
        {enrollmentsLoading || assessmentsLoading ? (
          <p className="text-sm text-muted-foreground" role="status">
            Loading assessments…
          </p>
        ) : assessmentsError ? (
          <div>
            <p className="text-sm text-destructive">Could not load assessment results.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchAssessments()}
              className="mt-3"
            >
              <RotateCw className="mr-2 h-4 w-4" /> Try again
            </Button>
          </div>
        ) : assessments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assessments have been scheduled yet.</p>
        ) : (
          <ul className="divide-y">
            {assessments.map((assessment) => {
              const enrollment = enrollments.find((item) => item.class_id === assessment.class_id);
              const assessmentClass = enrollment?.classes;
              const scorePercent =
                assessment.score && assessment.points > 0
                  ? ((Number(assessment.score.score) / assessment.points) * 100).toFixed(1)
                  : null;

              return (
                <li key={assessment.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{assessment.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {assessmentClass?.subject || assessmentClass?.name || "Class"}
                        {assessmentClass?.subject && assessmentClass?.name
                          ? ` · ${assessmentClass.name}`
                          : ""}
                        {` · ${new Date(assessment.scheduled_at).toLocaleDateString()}`}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Teacher: {enrollment?.teacher?.full_name || "Not available"}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">
                      {assessment.score
                        ? `${assessment.score.score} / ${assessment.points}${scorePercent ? ` (${scorePercent}%)` : ""}`
                        : `Not graded · out of ${assessment.points}`}
                    </div>
                  </div>
                  {assessment.score?.feedback && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {assessment.score.feedback}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-6 mb-6">
        <h2 className="font-semibold mb-4">Classes</h2>
        {enrollmentsLoading ? (
          <p className="text-sm text-muted-foreground" role="status">
            Loading classes…
          </p>
        ) : enrollmentsError ? (
          <p className="text-sm text-destructive">Classes could not be loaded.</p>
        ) : enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enrolled in any classes yet.</p>
        ) : (
          <ul className="divide-y">
            {enrollments.map((e) => (
              <li key={e.class_id} className="py-3">
                <div className="font-medium">{e.classes?.name}</div>
                {e.classes?.subject && (
                  <div className="text-sm text-muted-foreground">{e.classes.subject}</div>
                )}
                <div className="mt-1 text-xs text-muted-foreground">
                  Teacher: {e.teacher?.full_name || "Not available"}
                </div>
                {(e.teacher?.contact_email ||
                  e.teacher?.contact_phone ||
                  e.teacher?.contact_whatsapp) && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {e.teacher?.contact_email || ""}
                    {e.teacher?.contact_phone ? ` · ${e.teacher.contact_phone}` : ""}
                    {e.teacher?.contact_whatsapp ? ` · WhatsApp ${e.teacher.contact_whatsapp}` : ""}
                  </div>
                )}
                {e.classes?.teacher_id && (
                  <div className="mt-2">
                    <Link
                      to="/messages"
                      search={{ contact: e.classes.teacher_id }}
                      className="text-sm text-primary hover:underline"
                    >
                      Message this teacher
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Recent assignments</h2>
        {assignmentsLoading ? (
          <p className="text-sm text-muted-foreground" role="status">
            Loading assignments…
          </p>
        ) : assignmentsError ? (
          <div>
            <p className="text-sm text-destructive">Could not load assignments.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchAssignments()}
              className="mt-3"
            >
              <RotateCw className="mr-2 h-4 w-4" /> Try again
            </Button>
          </div>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assignments yet.</p>
        ) : (
          <ul className="divide-y">
            {assignments.slice(0, 20).map((a) => {
              const s = a.submission;
              const status =
                s?.grade != null
                  ? `Graded: ${s.grade}/${a.points}`
                  : s
                    ? "Submitted"
                    : "Not submitted";
              return (
                <li key={a.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {(a.assignment_type ?? "homework").toUpperCase()} · {a.classes?.name}
                      {a.due_date && ` · Due ${new Date(a.due_date).toLocaleDateString()}`}
                    </div>
                    {s?.feedback && <div className="text-sm mt-1 italic">"{s.feedback}"</div>}
                  </div>
                  <div className="text-sm font-medium">{status}</div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </PortalShell>
  );
}
