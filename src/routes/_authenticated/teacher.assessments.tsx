import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher/assessments")({
  component: TeacherAssessments,
});

function TeacherAssessments() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [coverage, setCoverage] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [points, setPoints] = useState("100");

  const { data: classes = [] } = useQuery({
    queryKey: ["teacher-classes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes").select("id, name").eq("teacher_id", user!.id).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["teacher-assessments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("id, title, coverage, scheduled_at, points, class_id")
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((a) => a.class_id)));
      const [{ data: cls }, { data: enr }] = await Promise.all([
        ids.length
          ? supabase.from("classes").select("id, name").in("id", ids)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        ids.length
          ? supabase.from("enrollments").select("class_id, student_id").in("class_id", ids)
          : Promise.resolve({ data: [] as { class_id: string; student_id: string }[] }),
      ]);
      const nameMap = new Map((cls ?? []).map((c) => [c.id, c.name]));
      const rosterSizeMap = new Map<string, number>();
      for (const e of enr ?? []) {
        rosterSizeMap.set(e.class_id, (rosterSizeMap.get(e.class_id) ?? 0) + 1);
      }

      const assessmentIds = (data ?? []).map((a) => a.id);
      const { data: scores } = assessmentIds.length
        ? await supabase.from("assessment_scores").select("assessment_id").in("assessment_id", assessmentIds)
        : { data: [] as { assessment_id: string }[] };
      const scoredMap = new Map<string, number>();
      for (const s of scores ?? []) {
        scoredMap.set(s.assessment_id, (scoredMap.get(s.assessment_id) ?? 0) + 1);
      }

      const now = Date.now();
      return (data ?? []).map((a) => {
        const roster = rosterSizeMap.get(a.class_id) ?? 0;
        const scored = scoredMap.get(a.id) ?? 0;
        const missed = new Date(a.scheduled_at).getTime() < now ? Math.max(roster - scored, 0) : 0;
        return { ...a, class_name: nameMap.get(a.class_id) ?? "", roster, scored, missed };
      });
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!classId || !title.trim() || !scheduledAt) throw new Error("Class, title, date required");
      const { error } = await supabase.from("assessments").insert({
        class_id: classId,
        title: title.trim(),
        coverage: coverage.trim() || null,
        scheduled_at: new Date(scheduledAt).toISOString(),
        points: Math.max(0, parseInt(points || "0", 10)),
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assessment created");
      setTitle(""); setCoverage(""); setScheduledAt(""); setPoints("100");
      qc.invalidateQueries({ queryKey: ["teacher-assessments"] });
      qc.invalidateQueries({ queryKey: ["assessments-upcoming"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assessments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher-assessments"] }),
  });

  return (
    <PortalShell title="Assessments" subtitle="Schedule assessments and share coverage with students and parents.">
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card className="p-5 space-y-3 h-fit">
          <h3 className="font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> New assessment</h3>
          <div className="space-y-1.5">
            <Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
          </div>
          <div className="space-y-1.5">
            <Label>Coverage / syllabus</Label>
            <Textarea value={coverage} onChange={(e) => setCoverage(e.target.value)} rows={4} maxLength={2000} placeholder="Chapters, topics, sample questions…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date & time</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Points</Label>
              <Input type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} />
            </div>
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create assessment"}
          </Button>
        </Card>

        <div className="space-y-3">
          {items.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">No assessments yet.</Card>
          ) : items.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {a.class_name} · {new Date(a.scheduled_at).toLocaleString()} · {a.points} pts
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {a.scored}/{a.roster} scored
                    </span>
                    {a.missed > 0 && (
                      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                        {a.missed} missed
                      </span>
                    )}
                  </div>
                  {a.coverage && <p className="text-sm mt-2 whitespace-pre-wrap"><span className="font-medium">Coverage: </span>{a.coverage}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/teacher/assessments/$assessmentId" params={{ assessmentId: a.id }}>
                      Enter scores
                    </Link>
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm("Delete?") && remove.mutate(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PortalShell>
  );
}
