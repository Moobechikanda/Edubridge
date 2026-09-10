import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher/assessments/$assessmentId")({
  component: ScoreEntry,
});

type Row = { student_id: string; full_name: string; score: string; feedback: string };

function ScoreEntry() {
  const { assessmentId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: assessment } = useQuery({
    queryKey: ["assessment", assessmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("id, title, points, class_id, scheduled_at")
        .eq("id", assessmentId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: roster = [] } = useQuery({
    queryKey: ["assessment-roster", assessmentId, assessment?.class_id],
    enabled: !!assessment?.class_id,
    queryFn: async () => {
      const { data: enr } = await supabase
        .from("enrollments").select("student_id").eq("class_id", assessment!.class_id);
      const ids = (enr ?? []).map((e) => e.student_id);
      if (!ids.length) return [];
      const [{ data: profs }, { data: scores }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", ids),
        supabase.from("assessment_scores").select("student_id, score, feedback").eq("assessment_id", assessmentId),
      ]);
      const scoreMap = new Map((scores ?? []).map((s) => [s.student_id, s]));
      return (profs ?? []).map((p) => ({
        student_id: p.id,
        full_name: p.full_name ?? "",
        score: scoreMap.get(p.id)?.score?.toString() ?? "",
        feedback: scoreMap.get(p.id)?.feedback ?? "",
      })) as Row[];
    },
  });

  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => { setRows(roster); }, [roster]);

  const save = useMutation({
    mutationFn: async (row: Row) => {
      const score = parseFloat(row.score);
      if (Number.isNaN(score) || score < 0) throw new Error("Invalid score");
      const { error } = await supabase.from("assessment_scores").upsert({
        assessment_id: assessmentId,
        student_id: row.student_id,
        score,
        feedback: row.feedback || null,
        graded_by: user!.id,
      }, { onConflict: "assessment_id,student_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["assessment-roster", assessmentId] });
      qc.invalidateQueries({ queryKey: ["class-rankings", assessment?.class_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <PortalShell title={assessment?.title ?? "Assessment scores"} subtitle={`Out of ${assessment?.points ?? 100} points.`}>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/teacher/assessments"><ArrowLeft className="h-4 w-4" /> Back</Link>
      </Button>
      <Card className="p-0 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No students enrolled.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="w-32">Score</TableHead>
                <TableHead>Feedback</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.student_id}>
                  <TableCell className="font-medium">{r.full_name || "—"}</TableCell>
                  <TableCell>
                    <Input type="number" min={0} max={assessment?.points ?? undefined}
                      value={r.score} onChange={(e) => update(i, { score: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Textarea rows={1} value={r.feedback}
                      onChange={(e) => update(i, { feedback: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="secondary" onClick={() => save.mutate(r)} disabled={save.isPending}>
                      <Save className="h-3.5 w-3.5 mr-1" /> Save
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </PortalShell>
  );
}
