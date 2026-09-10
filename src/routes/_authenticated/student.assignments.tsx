import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/student/assignments")({
  component: StudentAssignments,
});

function StudentAssignments() {
  const { user } = useAuth();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["student-assignments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: enr } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", user!.id);
      const classIds = (enr ?? []).map((e) => e.class_id);
      if (classIds.length === 0) return [];

      const [{ data: assignments }, { data: subs }] = await Promise.all([
        supabase
          .from("assignments")
          .select("id, title, due_date, points, class_id, classes(name)")
          .in("class_id", classIds)
          .order("due_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("submissions")
          .select("assignment_id, grade, graded_at, submitted_at")
          .eq("student_id", user!.id),
      ]);
      const subMap = new Map((subs ?? []).map((s) => [s.assignment_id, s]));
      return (assignments ?? []).map((a: any) => ({
        ...a,
        submission: subMap.get(a.id) ?? null,
      }));
    },
  });

  if (isLoading) return <div className="container mx-auto px-4 py-10 text-muted-foreground">Loading…</div>;

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
      <p className="text-muted-foreground mt-1 text-sm">All work across your classes.</p>

      {items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground text-sm mt-6">
          No assignments yet.
        </Card>
      ) : (
        <div className="grid gap-3 mt-6">
          {items.map((a: any) => {
            const sub = a.submission;
            const overdue = !sub && a.due_date && new Date(a.due_date).getTime() < Date.now();
            return (
              <Card key={a.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <Link
                    to="/student/assignments/$assignmentId"
                    params={{ assignmentId: a.id }}
                    className="font-medium hover:underline"
                  >
                    {a.title}
                  </Link>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    <span>{a.classes?.name}</span>
                    <span>{a.points} pts</span>
                    {a.due_date && (
                      <span className={cn(overdue && "text-destructive")}>
                        Due {new Date(a.due_date).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge sub={sub} overdue={!!overdue} maxPoints={a.points} />
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/student/assignments/$assignmentId" params={{ assignmentId: a.id }}>
                      Open
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ sub, overdue, maxPoints }: { sub: any; overdue: boolean; maxPoints: number }) {
  if (sub?.graded_at) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
        <CheckCircle2 className="h-4 w-4" /> {Number(sub.grade)} / {maxPoints}
      </span>
    );
  }
  if (sub) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Clock className="h-4 w-4" /> Submitted
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        overdue ? "text-destructive" : "text-muted-foreground",
      )}
    >
      <AlertCircle className="h-4 w-4" /> {overdue ? "Overdue" : "Not submitted"}
    </span>
  );
}
