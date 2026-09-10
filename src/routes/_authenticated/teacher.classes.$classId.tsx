import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ArrowLeft, Plus, Trash2, Copy, Megaphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher/classes/$classId")({
  component: ClassDetail,
});

function ClassDetail() {
  const { classId } = Route.useParams();
  const qc = useQueryClient();

  const { data: cls } = useQuery({
    queryKey: ["class", classId],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").eq("id", classId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["class-students", classId],
    queryFn: async () => {
      const { data: enr, error } = await supabase
        .from("enrollments")
        .select("id, student_id, created_at")
        .eq("class_id", classId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (enr ?? []).map((e) => e.student_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return (enr ?? []).map((e) => ({ ...e, full_name: map.get(e.student_id) ?? "—" }));
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["class-assignments", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("class_id", classId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const assignmentIds = assignments.map((a) => a.id);
  const totalStudents = students.length;

  const { data: assignmentStats = {} } = useQuery({
    queryKey: ["class-assignment-stats", classId, assignmentIds.join(",")],
    enabled: assignmentIds.length > 0,
    queryFn: async () => {
      const { data: subs, error } = await supabase
        .from("submissions")
        .select("assignment_id, grade")
        .in("assignment_id", assignmentIds);
      if (error) throw error;
      const stats: Record<string, { attempted: number; graded: number }> = {};
      for (const s of subs ?? []) {
        const entry = stats[s.assignment_id] ?? { attempted: 0, graded: 0 };
        entry.attempted += 1;
        if (s.grade != null) entry.graded += 1;
        stats[s.assignment_id] = entry;
      }
      return stats;
    },
  });

  const removeStudent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("enrollments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Student removed");
      qc.invalidateQueries({ queryKey: ["class-students", classId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Remove failed"),
  });

  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assignment deleted");
      qc.invalidateQueries({ queryKey: ["class-assignments", classId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  if (!cls) return <div className="container mx-auto px-4 py-10 text-muted-foreground">Loading…</div>;

  return (
    <div className="container mx-auto px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/teacher/classes">
          <ArrowLeft className="h-4 w-4" /> All classes
        </Link>
      </Button>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{cls.name}</h1>
          {cls.subject && <p className="text-muted-foreground mt-1">{cls.subject}</p>}
        </div>
        <Card className="p-3 flex items-center gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Join code</div>
            <div className="font-mono font-semibold">{cls.join_code}</div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(cls.join_code);
              toast.success("Copied join code");
            }}
            aria-label="Copy"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </Card>
      </div>

      <Tabs defaultValue="students" className="mt-8">
        <TabsList>
          <TabsTrigger value="students">Students ({students.length})</TabsTrigger>
          <TabsTrigger value="assignments">Assignments ({assignments.length})</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-4">
          <Card className="p-4">
            <div className="mb-3 space-y-2">
              <p className="text-sm text-muted-foreground">
                Students join by entering join code <span className="font-mono font-semibold">{cls.join_code}</span> in their portal.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-xs font-mono px-2 py-1 rounded bg-muted break-all">
                  {typeof window !== "undefined" ? window.location.origin : ""}/student/classes?join={cls.join_code}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/student/classes?join=${cls.join_code}`);
                    toast.success("Invite link copied — share it anywhere (Classroom, WhatsApp, email)");
                  }}
                >
                  <Copy className="h-4 w-4 mr-1" /> Copy invite link
                </Button>
              </div>
            </div>
            {students.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No students enrolled yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Remove ${s.full_name} from this class?`))
                              removeStudent.mutate(s.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <NewAssignmentDialog classId={classId} />
          </div>
          {assignments.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground text-sm">No assignments yet.</Card>
          ) : (
            <div className="grid gap-3">
              {assignments.map((a) => {
                const stats = assignmentStats[a.id] ?? { attempted: 0, graded: 0 };
                const overdue = a.due_date && new Date(a.due_date).getTime() < Date.now();
                const missed = overdue ? Math.max(totalStudents - stats.attempted, 0) : 0;
                const notFinished = Math.max(stats.attempted - stats.graded, 0);
                return (
                  <Card key={a.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <Link
                        to="/teacher/assignments/$assignmentId"
                        params={{ assignmentId: a.id }}
                        className="font-semibold hover:underline"
                      >
                        {a.title}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-1">
                        {a.assignment_type ?? "homework"} · {a.points} pts
                        {a.due_date && ` · Due ${new Date(a.due_date).toLocaleString()}`}
                      </div>
                      {a.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{a.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          {stats.attempted}/{totalStudents} attempted
                        </span>
                        <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                          {stats.graded} graded
                        </span>
                        {notFinished > 0 && (
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                            {notFinished} awaiting grade
                          </span>
                        )}
                        {missed > 0 && (
                          <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                            {missed} missed
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button asChild size="sm" variant="secondary">
                        <Link to="/teacher/assignments/$assignmentId" params={{ assignmentId: a.id }}>
                          Grade
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete "${a.title}"?`)) removeAssignment.mutate(a.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="announcements" className="mt-4">
          <AnnouncementsPanel classId={classId} />
        </TabsContent>
        <TabsContent value="subjects" className="mt-4">
          <SubjectsPanel classId={classId} teacherId={(cls as any).teacher_id} gradeLevel={cls?.grade_level ?? null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AnnouncementsPanel({ classId }: { classId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["class-announcements", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("class_id", classId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: seenStats = {} } = useQuery({
    queryKey: ["class-announcement-seen", classId, items.map((i) => i.id).join(",")],
    enabled: items.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        items.map(async (a) => {
          const { data, error } = await supabase.rpc("get_announcement_seen_stats", {
            _announcement_id: a.id,
          });
          if (error) return [a.id, null] as const;
          const row = Array.isArray(data) ? data[0] : data;
          return [a.id, row] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, { seen_count: number; total_recipients: number } | null>;
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !body.trim()) throw new Error("Title and body are required");
      const { error } = await supabase.from("announcements").insert({
        class_id: classId,
        teacher_id: user!.id,
        title: title.trim(),
        body: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Announcement posted");
      setTitle("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["class-announcements", classId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Post failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["class-announcements", classId] });
    },
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold flex items-center gap-2 mb-3">
          <Megaphone className="h-4 w-4" /> New announcement
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ann-title">Title</Label>
            <Input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ann-body">Message</Label>
            <Textarea id="ann-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={2000} />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => post.mutate()} disabled={post.isPending}>
              {post.isPending ? "Posting…" : "Post announcement"}
            </Button>
          </div>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground text-sm">No announcements yet.</Card>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const stat = seenStats[a.id];
            return (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                  <p className="text-sm mt-2 whitespace-pre-wrap">{a.body}</p>
                  {stat && (
                    <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground mt-2">
                      Seen by {stat.seen_count}/{stat.total_recipients}
                    </span>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Delete this announcement?")) remove.mutate(a.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
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

function NewAssignmentDialog({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignmentType, setAssignmentType] = useState("homework");
  const [dueDate, setDueDate] = useState("");
  const [points, setPoints] = useState("100");

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title is required");
      const { error } = await supabase.from("assignments").insert({
        class_id: classId,
        title: title.trim(),
        assignment_type: assignmentType,
        description: description.trim() || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        points: Math.max(0, parseInt(points || "0", 10)),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assignment created");
      qc.invalidateQueries({ queryKey: ["class-assignments", classId] });
      setOpen(false);
      setTitle("");
      setDescription("");
      setAssignmentType("homework");
      setDueDate("");
      setPoints("100");
    },
    onError: (e: any) => toast.error(e.message ?? "Create failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New assignment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New assignment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="atype">Work type</Label>
            <select
              id="atype"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={assignmentType}
              onChange={(e) => setAssignmentType(e.target.value)}
            >
              <option value="homework">Homework</option>
              <option value="project">Project</option>
              <option value="quiz">Quiz task</option>
              <option value="lab">Lab</option>
              <option value="reading">Reading</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Instructions</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="due">Due date</Label>
              <Input id="due" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pts">Points</Label>
              <Input id="pts" type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubjectsPanel({ classId, teacherId, gradeLevel }: { classId: string; teacherId: string; gradeLevel: number | null }) {
  const qc = useQueryClient();
  const [selectedSubject, setSelectedSubject] = useState("");
  const [open, setOpen] = useState(false);

  const { data: classSubjects = [] } = useQuery({
    queryKey: ["class-subjects", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_subjects")
        .select("*, subjects(id, name, code)")
        .eq("class_id", classId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allSubjects = [] } = useQuery({
    queryKey: ["all-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, code, min_grade, max_grade")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const addSubject = useMutation({
    mutationFn: async () => {
      if (!selectedSubject) throw new Error("Select a subject");
      const { error } = await supabase.from("class_subjects").insert({
        class_id: classId,
        subject_id: selectedSubject,
        teacher_id: teacherId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subject added");
      setOpen(false);
      setSelectedSubject("");
      qc.invalidateQueries({ queryKey: ["class-subjects", classId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Add failed"),
  });

  const removeSubject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("class_subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subject removed");
      qc.invalidateQueries({ queryKey: ["class-subjects", classId] });
    },
  });

  const availableSubjects = allSubjects.filter((subject) => {
    const isAlreadyAssigned = classSubjects.some((classSubject: any) => classSubject.subject_id === subject.id);
    const isForThisGrade = !gradeLevel || !subject.min_grade || !subject.max_grade
      || (subject.min_grade <= gradeLevel && subject.max_grade >= gradeLevel);
    return !isAlreadyAssigned && isForThisGrade;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Subjects ({classSubjects.length})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={availableSubjects.length === 0}>
              <Plus className="h-4 w-4 mr-1" /> Add subject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add subject</DialogTitle>
            </DialogHeader>
            {gradeLevel && (
              <p className="text-sm text-muted-foreground">Showing subjects available for Grade {gradeLevel}.</p>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} {s.code ? `(${s.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => addSubject.mutate()} disabled={addSubject.isPending || !selectedSubject}>
                {addSubject.isPending ? "Adding…" : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {classSubjects.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No subjects assigned yet.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classSubjects.map((cs: any) => (
            <Card key={cs.id} className="p-4 flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{cs.subjects?.name ?? "Unknown"}</div>
                {cs.subjects?.code && (
                  <div className="text-xs text-muted-foreground font-mono">{cs.subjects.code}</div>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Remove ${cs.subjects?.name}?`)) removeSubject.mutate(cs.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
