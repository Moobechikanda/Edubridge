import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  Download,
  Send,
  FileText,
  Users,
} from "lucide-react";

type SubmissionRow = {
  student_id: string;
  full_name: string;
  submission: any | null;
  status: string;
};

export const Route = createFileRoute("/_authenticated/teacher/assignments/$assignmentId")({
  component: AssignmentGrading,
});

function AssignmentGrading() {
  const { assignmentId } = Route.useParams();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [gradingRow, setGradingRow] = useState<SubmissionRow | null>(null);

  const { data: assignment } = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*, classes(id, name, subject, teacher_id)")
        .eq("id", assignmentId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["assignment-stats", assignmentId],
    enabled: !!assignment,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_assignment_stats", {
        _assignment_id: assignmentId,
        _class_id: (assignment as any)?.class_id,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as any;
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["assignment-roster", assignmentId],
    enabled: !!assignment,
    queryFn: async () => {
      const classId = (assignment as any).class_id;
      const { data: enr } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("class_id", classId);
      const ids = (enr ?? []).map((e) => e.student_id);
      if (ids.length === 0) return [];
      const [{ data: profs }, { data: subs }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", ids),
        supabase.from("submissions").select("*").eq("assignment_id", assignmentId),
      ]);
      const subMap = new Map((subs ?? []).map((s) => [s.student_id, s]));
      const profMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return ids.map((id) => {
        const sub = subMap.get(id);
        let status = "not_attempted";
        if (sub) {
          if (sub.graded_at) status = "completed";
          else if (sub.submitted_at) {
            const dueDate = (assignment as any)?.due_date;
            if (dueDate && new Date(sub.submitted_at) > new Date(dueDate)) status = "late";
            else status = "in_progress";
          }
        }
        return {
          student_id: id,
          full_name: profMap.get(id) ?? "—",
          submission: sub,
          status,
        };
      });
    },
  });

  const filteredRows = useMemo(() => {
    let result = rows;
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => r.full_name.toLowerCase().includes(q));
    }
    return result;
  }, [rows, statusFilter, searchQuery]);

  if (!assignment)
    return <div className="container mx-auto px-4 py-10 text-muted-foreground">Loading…</div>;

  const cls = (assignment as any).classes;

  return (
    <div className="container mx-auto px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/teacher/classes/$classId" params={{ classId: cls?.id }}>
          <ArrowLeft className="h-4 w-4" /> Back to class
        </Link>
      </Button>

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{assignment.title}</h1>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {(assignment.assignment_type ?? "homework").toUpperCase()}
            </span>
            <span>{cls?.name}</span>
            {cls?.subject && <span>· {cls.subject}</span>}
            <span>· {assignment.points} pts</span>
            {assignment.due_date && (
              <span className="text-destructive">· Due {new Date(assignment.due_date).toLocaleString()}</span>
            )}
          </p>
          {assignment.description && (
            <Card className="p-4 mt-3 text-sm whitespace-pre-wrap">{assignment.description}</Card>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 mb-8">
          <StatCard label="Total Students" value={stats.total_students ?? 0} icon={Users} />
          <StatCard label="Attempted" value={stats.attempted ?? 0} highlight />
          <StatCard label="Completed" value={stats.completed ?? 0} color="text-green-600" />
          <StatCard label="In Progress" value={stats.in_progress ?? 0} color="text-amber-600" />
          <StatCard label="Not Attempted" value={stats.not_attempted ?? 0} color="text-muted-foreground" />
          <StatCard label="Missed" value={stats.missed ?? 0} color="text-destructive" />
          <StatCard label="Late" value={stats.late ?? 0} color="text-orange-600" />
          <StatCard label="Pending Marking" value={stats.pending_marking ?? 0} color="text-amber-600" />
          <StatCard label="Marked" value={stats.marked ?? 0} color="text-green-600" />
          <StatCard label="Avg Score" value={stats.avg_score != null ? `${Number(stats.avg_score).toFixed(1)}` : "—"} />
          <StatCard label="Highest" value={stats.highest_score != null ? Number(stats.highest_score).toFixed(1) : "—"} />
          <StatCard label="Lowest" value={stats.lowest_score != null ? Number(stats.lowest_score).toFixed(1) : "—"} />
        </div>
      )}

      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name…"
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 mr-1" />
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="not_attempted">Not Attempted</SelectItem>
              <SelectItem value="missed">Missed</SelectItem>
              <SelectItem value="late">Late</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Showing {filteredRows.length} of {rows.length} students
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started / Submitted</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Feedback</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No students match your filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((r) => (
                <TableRow key={r.student_id}>
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.submission?.submitted_at
                      ? new Date(r.submission.submitted_at).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.submission?.grade != null ? (
                      <span className="font-medium">
                        {Number(r.submission.grade)} / {assignment.points}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {r.submission?.feedback ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      asChild
                      size="sm"
                      variant="secondary"
                    >
                      <Link to="/teacher/assignments/$assignmentId" params={{ assignmentId }} search={{ student: r.student_id }}>
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {gradingRow && (
        <GradingDialog
          row={gradingRow}
          maxPoints={assignment.points}
          onClose={() => setGradingRow(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["assignment-roster", assignmentId] });
            qc.invalidateQueries({ queryKey: ["assignment-stats", assignmentId] });
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  highlight,
  color,
}: {
  label: string;
  value: string | number;
  icon?: any;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <Card className={`p-4 ${highlight ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className={`text-xs font-medium ${color ?? "text-muted-foreground"}`}>{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${color ?? ""}`}>{value}</div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    completed: { label: "Completed", className: "bg-green-500/10 text-green-700 dark:text-green-400" },
    in_progress: { label: "In Progress", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    not_attempted: { label: "Not Attempted", className: "bg-muted text-muted-foreground" },
    missed: { label: "Missed", className: "bg-destructive/10 text-destructive" },
    late: { label: "Late", className: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  };
  const s = map[status] ?? map.not_attempted;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

function GradingDialog({
  row,
  maxPoints,
  onClose,
  onSaved,
}: {
  row: SubmissionRow;
  maxPoints: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const sub = row.submission;
  const [grade, setGrade] = useState(sub?.grade?.toString() ?? "");
  const [feedback, setFeedback] = useState(sub?.feedback ?? "");

  useEffect(() => {
    setGrade(sub?.grade?.toString() ?? "");
    setFeedback(sub?.feedback ?? "");
  }, [sub?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!sub) throw new Error("No submission yet");
      const g = grade === "" ? null : Number(grade);
      if (g !== null && (isNaN(g) || g < 0 || g > maxPoints))
        throw new Error(`Grade must be 0–${maxPoints}`);
      const { error } = await supabase
        .from("submissions")
        .update({
          grade: g,
          feedback: feedback.trim() || null,
          graded_at: g !== null ? new Date().toISOString() : null,
        })
        .eq("id", sub.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Feedback saved");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{row.full_name} — Submission</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-auto">
          {sub?.content && (
            <div>
              <Label className="text-xs text-muted-foreground">Submission</Label>
              <Card className="p-3 mt-1 text-sm whitespace-pre-wrap bg-muted/50">{sub.content}</Card>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="grade" className="text-xs">
                Grade / {maxPoints}
              </Label>
              <Input
                id="grade"
                type="number"
                min={0}
                max={maxPoints}
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="feedback" className="text-xs">
                Feedback
              </Label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
