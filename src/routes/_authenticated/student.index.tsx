import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ClipboardList, TrendingUp, Clock, Copy, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_authenticated/student/")({
  component: StudentOverview,
});

type SubjectGroup = {
  class_id: string;
  class_name: string;
  subject: string | null;
  teacher_id: string;
  teacher_name: string;
  pending: any[];
  upcoming: any[];
  completed: any[];
};

function StudentOverview() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["student-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("parent_code").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: subjectGroups = [] } = useQuery({
    queryKey: ["student-subjects", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: enr } = await supabase
        .from("enrollments")
        .select("class_id, classes(id, name, subject, teacher_id)")
        .eq("student_id", user!.id);
      const groups: SubjectGroup[] = [];
      for (const e of (enr ?? [])) {
        const cls = (e as any).classes;
        const teacherIds = cls?.teacher_id ? [cls.teacher_id] : [];
        const { data: teachers } = teacherIds.length
          ? await supabase.from("profiles").select("id, full_name").in("id", teacherIds)
          : { data: [] as any[] };
        const teacherName = (teachers ?? [])[0]?.full_name ?? "Not assigned";
        groups.push({
          class_id: cls.id,
          class_name: cls.name,
          subject: cls.subject,
          teacher_id: cls.teacher_id,
          teacher_name: teacherName,
          pending: [],
          upcoming: [],
          completed: [],
        });
      }

      const classIds = groups.map((g) => g.class_id);
      if (classIds.length === 0) return groups;

      const [{ data: assignments }, { data: subs }] = await Promise.all([
        supabase
          .from("assignments")
          .select("id, title, due_date, points, class_id, assignment_type")
          .in("class_id", classIds)
          .order("due_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("submissions")
          .select("assignment_id, grade, graded_at, submitted_at")
          .eq("student_id", user!.id),
      ]);

      const subMap = new Map((subs ?? []).map((s) => [s.assignment_id, s]));
      const now = Date.now();

      for (const a of (assignments ?? [])) {
        const group = groups.find((g) => g.class_id === a.class_id);
        if (!group) continue;
        const sub = subMap.get(a.id);
        const due = a.due_date ? new Date(a.due_date).getTime() : null;
        const isOverdue = !sub && due !== null && due < now;
        const isUpcoming = !sub && due !== null && due > now && due < now + 7 * 86400000;

        if (sub?.graded_at) {
          group.completed.push({ ...a, submission: sub });
        } else if (sub) {
          group.pending.push({ ...a, submission: sub, status: "submitted" });
        } else if (isOverdue) {
          group.pending.push({ ...a, submission: null, status: "overdue" });
        } else if (isUpcoming) {
          group.upcoming.push({ ...a, submission: null });
        } else if (!sub) {
          group.pending.push({ ...a, submission: null, status: "not_submitted" });
        }
      }

      return groups;
    },
  });

  const allCompleted = subjectGroups.flatMap((g) => g.completed);
  const avgGrade = useMemo(() => {
    if (allCompleted.length === 0) return null;
    const total = allCompleted.reduce((acc, a) => {
      const pct = a.submission && a.points ? (Number(a.submission.grade) / a.points) * 100 : 0;
      return acc + pct;
    }, 0);
    return total / allCompleted.length;
  }, [allCompleted]);

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1">Your subjects, teachers, and assignments at a glance.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/student/classes">Join a class</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Stat icon={BookOpen} label="Subjects" value={subjectGroups.length ?? "—"} />
        <Stat icon={ClipboardList} label="Pending work" value={subjectGroups.reduce((a, g) => a + g.pending.length, 0) ?? "—"} />
        <Stat
          icon={TrendingUp}
          label="Average grade"
          value={avgGrade != null ? `${avgGrade.toFixed(1)}%` : "—"}
        />
      </div>

      {profile?.parent_code && (
        <Card className="mb-6 p-4 flex items-center justify-between gap-3 bg-accent/40">
          <div>
            <div className="text-sm font-medium">Share with a parent</div>
            <div className="text-xs text-muted-foreground">
              Give them this code so they can link your account and follow your progress.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="font-mono font-semibold text-lg tracking-wider px-3 py-1 rounded bg-background border">
              {profile.parent_code}
            </code>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(profile.parent_code!);
                toast.success("Parent code copied");
              }}
              aria-label="Copy parent code"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {subjectGroups.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground text-sm">
          You are not enrolled in any subjects yet. Join a class to see your work here.
        </Card>
      ) : (
        <div className="grid gap-6">
          {subjectGroups.map((group) => (
            <Card key={group.class_id} className="p-0 overflow-hidden">
              <div className="p-5 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-lg">{group.subject || group.class_name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {group.class_name} · Teacher: {group.teacher_name}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/student/classes">
                      View class <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="p-5">
                {group.pending.length === 0 && group.upcoming.length === 0 && group.completed.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assignments yet.</p>
                ) : (
                  <div className="space-y-4">
                    {group.pending.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Pending</h3>
                        <div className="space-y-2">
                          {group.pending.slice(0, 5).map((a: any) => (
                            <AssignmentRow key={a.id} a={a} />
                          ))}
                        </div>
                      </div>
                    )}
                    {group.upcoming.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Upcoming</h3>
                        <div className="space-y-2">
                          {group.upcoming.slice(0, 5).map((a: any) => (
                            <AssignmentRow key={a.id} a={a} />
                          ))}
                        </div>
                      </div>
                    )}
                    {group.completed.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Completed</h3>
                        <div className="space-y-2">
                          {group.completed.slice(0, 5).map((a: any) => (
                            <AssignmentRow key={a.id} a={a} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AssignmentRow({ a }: { a: any }) {
  const sub = a.submission;
  const overdue = !sub && a.due_date && new Date(a.due_date).getTime() < Date.now();
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/30">
      <div className="min-w-0 flex-1">
        <Link
          to="/student/assignments/$assignmentId"
          params={{ assignmentId: a.id }}
          className="font-medium hover:underline text-sm truncate block"
        >
          {a.title}
        </Link>
        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
          <span>{(a.assignment_type ?? "homework").toUpperCase()}</span>
          <span>{a.points} pts</span>
          {a.due_date && (
            <span className={overdue ? "text-destructive" : ""}>
              <Clock className="h-3 w-3 inline mr-0.5" />
              {overdue ? "Overdue" : `Due ${new Date(a.due_date).toLocaleDateString()}`}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {sub?.graded_at ? (
          <span className="text-xs font-medium text-green-600 dark:text-green-400">
            {Number(sub.grade)} / {a.points}
          </span>
        ) : sub ? (
          <span className="text-xs text-muted-foreground">Submitted</span>
        ) : (
          <span className={`text-xs font-medium ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
            {overdue ? "Overdue" : "Not submitted"}
          </span>
        )}
        <Button asChild size="sm" variant="secondary">
          <Link to="/student/assignments/$assignmentId" params={{ assignmentId: a.id }}>
            Open
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold mt-1">{value}</div>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
