import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Contact2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/parent/children/$studentId")({
  component: ChildProgress,
});

function ChildProgress() {
  const { studentId } = Route.useParams();

  const { data: profile } = useQuery({
    queryKey: ["child-profile", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, contact_email, contact_phone, contact_whatsapp, contact_socials")
        .eq("id", studentId)
        .maybeSingle();
      return data;
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["child-enrollments", studentId],
    queryFn: async () => {
      const { data: enr } = await supabase
        .from("enrollments")
        .select("class_id, classes(id, name, subject, teacher_id)")
        .eq("student_id", studentId);

      const teacherIds = Array.from(
        new Set((enr ?? []).map((e) => e.classes?.teacher_id).filter(Boolean)),
      );
      const { data: teachers } = teacherIds.length
        ? await supabase
            .from("profiles")
            .select("id, full_name, contact_email, contact_phone, contact_whatsapp, contact_socials")
            .in("id", teacherIds)
        : { data: [] as any[] };
      const teacherMap = new Map((teachers ?? []).map((t) => [t.id, t]));

      return (enr ?? []).map((e) => ({
        ...e,
        teacher: teacherMap.get(e.classes?.teacher_id),
      }));
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["child-assignments", studentId, enrollments.map((e) => e.class_id).join(",")],
    enabled: enrollments.length > 0,
    queryFn: async () => {
      const classIds = enrollments.map((e) => e.class_id);
      const { data: assigns } = await supabase
        .from("assignments")
        .select("id, title, assignment_type, due_date, points, class_id, classes(name)")
        .in("class_id", classIds)
        .order("due_date", { ascending: false, nullsFirst: false });
      const ids = (assigns ?? []).map((a) => a.id);
      if (ids.length === 0) return [];
      const { data: subs } = await supabase
        .from("submissions")
        .select("assignment_id, grade, submitted_at, graded_at, feedback")
        .eq("student_id", studentId)
        .in("assignment_id", ids);
      const subMap = new Map((subs ?? []).map((s) => [s.assignment_id, s]));
      return (assigns ?? []).map((a) => ({ ...a, submission: subMap.get(a.id) }));
    },
  });

  const graded = assignments.filter((a) => a.submission?.grade != null);
  const avg = graded.length
    ? graded.reduce((sum, a) => sum + (Number(a.submission!.grade) / a.points) * 100, 0) / graded.length
    : null;

  return (
    <PortalShell
      title={profile?.full_name ?? "Child"}
      subtitle="Progress across all classes and assignments."
    >
      <Link to="/parent/children" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to children
      </Link>

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
          <div className="text-2xl font-semibold mt-1">{avg != null ? `${avg.toFixed(1)}%` : "—"}</div>
        </Card>
      </div>

      {(profile?.contact_email || profile?.contact_phone || profile?.contact_whatsapp || profile?.contact_socials) && (
        <Card className="p-6 mb-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Contact2 className="h-4 w-4" /> Contact information
          </h2>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {profile?.contact_email && (
              <div><span className="text-muted-foreground">Email: </span>{profile.contact_email}</div>
            )}
            {profile?.contact_phone && (
              <div><span className="text-muted-foreground">Phone: </span>{profile.contact_phone}</div>
            )}
            {profile?.contact_whatsapp && (
              <div><span className="text-muted-foreground">WhatsApp: </span>{profile.contact_whatsapp}</div>
            )}
            {profile?.contact_socials && (
              <div><span className="text-muted-foreground">Social: </span>{profile.contact_socials}</div>
            )}
          </div>
        </Card>
      )}

      <Card className="p-6 mb-6">
        <h2 className="font-semibold mb-4">Classes</h2>
        {enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enrolled in any classes yet.</p>
        ) : (
          <ul className="divide-y">
            {enrollments.map((e) => (
              <li key={e.class_id} className="py-3">
                <div className="font-medium">{e.classes?.name}</div>
                {e.classes?.subject && <div className="text-sm text-muted-foreground">{e.classes.subject}</div>}
                <div className="mt-1 text-xs text-muted-foreground">
                  Teacher: {e.teacher?.full_name || "Not available"}
                </div>
                {(e.teacher?.contact_email || e.teacher?.contact_phone || e.teacher?.contact_whatsapp) && (
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
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assignments yet.</p>
        ) : (
          <ul className="divide-y">
            {assignments.slice(0, 20).map((a) => {
              const s = a.submission;
              const status = s?.grade != null ? `Graded: ${s.grade}/${a.points}` : s ? "Submitted" : "Not submitted";
              return (
                <li key={a.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {(a.assignment_type ?? "homework").toUpperCase()} · {" "}
                      {a.classes?.name}
                      {a.due_date && ` · Due ${new Date(a.due_date).toLocaleDateString()}`}
                    </div>
                    {s?.feedback && (
                      <div className="text-sm mt-1 italic">"{s.feedback}"</div>
                    )}
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
