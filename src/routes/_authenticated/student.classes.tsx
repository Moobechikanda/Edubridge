import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BookOpen, LogOut, Copy, IdCard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/student/classes")({
  validateSearch: (s: Record<string, unknown>): { join?: string } =>
    typeof s.join === "string" ? { join: s.join } : {},
  component: StudentClasses,
});

/** Accepts a raw code, an EduBridge invite link, or any pasted URL containing a code. */
function extractJoinCode(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const fromQuery =
        url.searchParams.get("join") ??
        url.searchParams.get("code") ??
        url.searchParams.get("cjc"); // Google Classroom invite param
      if (fromQuery) return fromQuery.trim().toUpperCase();
      const last = url.pathname.split("/").filter(Boolean).pop();
      return (last ?? "").trim().toUpperCase();
    } catch {
      return raw.toUpperCase();
    }
  }
  return raw.toUpperCase().replace(/\s+/g, "");
}

type EnrolledClass = {
  enrollment_id: string;
  id: string;
  name: string;
  subject: string | null;
  description: string | null;
  teacher_name: string | null;
};

type PendingInfo = { pending: number; overdue: number };

function StudentClasses() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { join: joinParam } = useSearch({ from: "/_authenticated/student/classes" });
  const [code, setCode] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["student-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("parent_code")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (joinParam) setCode(extractJoinCode(joinParam));
  }, [joinParam]);

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["student-classes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: enr, error } = await supabase
        .from("enrollments")
        .select("id, class_id, classes(id, name, subject, description, teacher_id)")
        .eq("student_id", user!.id);
      if (error) throw error;
      const teacherIds = Array.from(
        new Set((enr ?? []).map((e: any) => e.classes?.teacher_id).filter(Boolean)),
      );
      const profMap = new Map<string, string>();
      if (teacherIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", teacherIds);
        (profs ?? []).forEach((p) => profMap.set(p.id, p.full_name ?? ""));
      }
      return (enr ?? []).map((e: any) => ({
        enrollment_id: e.id,
        id: e.classes?.id,
        name: e.classes?.name,
        subject: e.classes?.subject,
        description: e.classes?.description,
        teacher_name: profMap.get(e.classes?.teacher_id) ?? null,
      })) as EnrolledClass[];
    },
  });

  const classIds = classes.map((c) => c.id).filter(Boolean);

  const { data: pendingByClass = {} } = useQuery({
    queryKey: ["student-classes-pending", user?.id, classIds.join(",")],
    enabled: !!user && classIds.length > 0,
    queryFn: async () => {
      const { data: assignments } = await supabase
        .from("assignments")
        .select("id, class_id, due_date")
        .in("class_id", classIds);
      const assignmentIds = (assignments ?? []).map((a) => a.id);
      const { data: subs } = assignmentIds.length
        ? await supabase
            .from("submissions")
            .select("assignment_id")
            .eq("student_id", user!.id)
            .in("assignment_id", assignmentIds)
        : { data: [] as { assignment_id: string }[] };
      const submittedIds = new Set((subs ?? []).map((s) => s.assignment_id));
      const now = Date.now();
      const result: Record<string, PendingInfo> = {};
      for (const a of assignments ?? []) {
        if (submittedIds.has(a.id)) continue;
        const info = result[a.class_id] ?? { pending: 0, overdue: 0 };
        info.pending += 1;
        if (a.due_date && new Date(a.due_date).getTime() < now) info.overdue += 1;
        result[a.class_id] = info;
      }
      return result;
    },
  });

  const join = useMutation({
    mutationFn: async () => {
      const trimmed = extractJoinCode(code);
      if (!trimmed) throw new Error("Enter a join code or paste an invite link");
      const { error } = await supabase.rpc("join_class_by_code", { _code: trimmed });
      if (error) throw new Error(error.message ?? "Could not join");
    },
    onSuccess: () => {
      toast.success("Joined class");
      setCode("");
      qc.invalidateQueries({ queryKey: ["student-classes"] });
      qc.invalidateQueries({ queryKey: ["student-overview"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not join"),
  });

  const leave = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase.from("enrollments").delete().eq("id", enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Left class");
      qc.invalidateQueries({ queryKey: ["student-classes"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">My classes</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Join a class with the code your teacher shares.
      </p>

      {profile?.parent_code && (
        <Card className="mt-6 p-4 flex items-center justify-between gap-3 flex-wrap bg-accent/40">
          <div className="flex items-start gap-3">
            <IdCard className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Your student ID (parent code)</div>
              <div className="text-xs text-muted-foreground">
                Automatically created for you. Share it with your parent or guardian so they can link to
                your account and follow your progress.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="font-mono font-semibold text-lg tracking-wider px-3 py-1 rounded bg-background border">
              {profile.parent_code}
            </code>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Copy student ID"
              onClick={() => {
                navigator.clipboard.writeText(profile.parent_code!);
                toast.success("Student ID copied");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/parent/children?code=${profile.parent_code}`,
                );
                toast.success("Parent invite link copied");
              }}
            >
              Copy parent invite link
            </Button>
          </div>
        </Card>
      )}

      <Card className="mt-6 p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-2 flex-1 min-w-[220px]">
            <Label htmlFor="code">Join code or invite link</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. AB12CD or paste an invite link"
              className="font-mono"
            />
          </div>
          <Button onClick={() => join.mutate()} disabled={join.isPending}>
            {join.isPending ? "Joining…" : "Join class"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          The code is created by your teacher when they set up the class here — it is not a Zoom or Google
          Meet code. You can paste an EduBridge invite link, or a Google Classroom invite link (we read the
          class code from it) and we'll pull the code out for you.
        </p>
      </Card>

      <h2 className="font-semibold mt-8 mb-3">Enrolled ({classes.length})</h2>
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : classes.length === 0 ? (
        <Card className="p-10 text-center">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="mt-3 text-muted-foreground text-sm">
            You're not enrolled in any classes yet.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...classes]
            .sort((a, b) => (a.subject ?? "").localeCompare(b.subject ?? "") || a.name.localeCompare(b.name))
            .map((c) => {
              const info = pendingByClass[c.id];
              return (
                <Card key={c.enrollment_id} className="p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      {c.subject && <div className="text-sm text-muted-foreground">{c.subject}</div>}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Leave "${c.name}"?`)) leave.mutate(c.enrollment_id);
                      }}
                      aria-label="Leave class"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                  {c.description && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{c.description}</p>
                  )}
                  <div className="mt-3">
                    {info && info.pending > 0 ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                          info.overdue > 0
                            ? "bg-destructive/10 text-destructive"
                            : "bg-accent text-accent-foreground",
                        )}
                      >
                        {info.pending} pending {info.pending === 1 ? "task" : "tasks"}
                        {info.overdue > 0 ? ` · ${info.overdue} overdue` : ""}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        All caught up
                      </span>
                    )}
                  </div>
                  {c.teacher_name && (
                    <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                      Teacher: <span className="text-foreground">{c.teacher_name}</span>
                    </div>
                  )}
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}
