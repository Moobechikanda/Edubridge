import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher/classes")({
  component: TeacherClasses,
});

type ClassRow = {
  id: string;
  name: string;
  subject: string | null;
  grade_level: number | null;
  description: string | null;
  join_code: string;
  created_at: string;
};

function TeacherClasses() {
  const { user } = useAuth();

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["teacher-classes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("teacher_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ClassRow[];
    },
  });

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My classes</h1>
          <p className="text-muted-foreground mt-1 text-sm">Classes assigned to you by the administrator.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : classes.length === 0 ? (
        <Card className="p-10 text-center">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">No classes yet. Create one to get started.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <Card key={c.id} className="p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link
                    to="/teacher/classes/$classId"
                    params={{ classId: c.id }}
                    className="font-semibold hover:underline"
                  >
                    {c.name}
                  </Link>
                  {c.subject && (
                    <div className="text-sm text-muted-foreground">{c.subject}</div>
                  )}
                  {c.grade_level && (
                    <div className="text-sm text-muted-foreground">Grade {c.grade_level}</div>
                  )}
                </div>
              </div>
              {c.description && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{c.description}</p>
              )}
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Join code</div>
                  <div className="font-mono text-sm font-semibold">{c.join_code}</div>
                </div>
                <Button asChild size="sm" variant="secondary">
                  <Link to="/teacher/classes/$classId" params={{ classId: c.id }}>
                    Open
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ClassFormDialog({ initial, onClose }: { initial: ClassRow | null; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [gradeLevel, setGradeLevel] = useState(initial?.grade_level?.toString() ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        subject: subject.trim() || null,
        grade_level: gradeLevel ? Number(gradeLevel) : null,
        description: description.trim() || null,
      };
      if (!payload.name) throw new Error("Name is required");
      if (initial) {
        const { error } = await supabase.from("classes").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("classes")
          .insert({ ...payload, teacher_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial ? "Class updated" : "Class created");
      qc.invalidateQueries({ queryKey: ["teacher-classes"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{initial ? "Edit class" : "New class"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={100} />
        </div>
        <div className="space-y-2">
          <Label>Grade</Label>
          <Select value={gradeLevel} onValueChange={setGradeLevel}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a grade" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((grade) => (
                <SelectItem key={grade} value={grade.toString()}>
                  Grade {grade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
