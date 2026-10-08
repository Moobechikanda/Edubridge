import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PortalShell } from "../_authenticated";
import { RoleGuard } from "@/components/RoleGuard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/classes")({
  component: () => (
    <RoleGuard allow={["admin"]}>
      <AdminClasses />
    </RoleGuard>
  ),
});

function AdminClasses() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [teacherId, setTeacherId] = useState("");

  const { data: teachers = [] } = useQuery({
    queryKey: ["admin-teachers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, teacher_qualifications")
        .in("id", (await supabase.from("user_roles").select("user_id").eq("role", "teacher")).data?.map((r) => r.user_id) ?? [])
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["admin-classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, subject, join_code, teacher_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createClass = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !teacherId) throw new Error("Class name and teacher are required");
      const { error } = await supabase.from("classes").insert({
        name: name.trim(),
        subject: subject.trim() || null,
        teacher_id: teacherId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Class created and teacher assigned");
      setName("");
      setSubject("");
      setTeacherId("");
      qc.invalidateQueries({ queryKey: ["admin-classes"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const teacherName = (id: string) => teachers.find((teacher) => teacher.id === id)?.full_name ?? "Unassigned";

  return (
    <PortalShell title="Classes and assignments" subtitle="Create classes and assign teachers according to their qualifications.">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        <Card className="p-5 space-y-4 h-fit">
          <div className="flex items-center gap-2 font-semibold"><Plus className="h-4 w-4" /> New class</div>
          <div className="space-y-2"><Label htmlFor="class-name">Class name</Label><Input id="class-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Grade 7 Mathematics" /></div>
          <div className="space-y-2"><Label htmlFor="class-subject">Subject</Label><Input id="class-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Mathematics" /></div>
          <div className="space-y-2"><Label>Teacher</Label><Select value={teacherId} onValueChange={setTeacherId}><SelectTrigger><SelectValue placeholder="Choose a qualified teacher" /></SelectTrigger><SelectContent>{teachers.map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.full_name || "Unnamed"}{teacher.teacher_qualifications ? ` · ${teacher.teacher_qualifications}` : ""}</SelectItem>)}</SelectContent></Select></div>
          <Button className="w-full" onClick={() => createClass.mutate()} disabled={createClass.isPending}>{createClass.isPending ? "Creating…" : "Create class"}</Button>
        </Card>
        <Card className="p-0 overflow-hidden">
          {classes.length === 0 ? <div className="p-8 text-center text-muted-foreground"><BookOpen className="mx-auto h-8 w-8" /><p className="mt-2">No classes have been created.</p></div> : <ul className="divide-y">{classes.map((classRow) => <li key={classRow.id} className="p-4 flex items-center justify-between gap-4"><div><div className="font-medium">{classRow.name}</div><div className="text-sm text-muted-foreground">{classRow.subject || "No subject"} · {teacherName(classRow.teacher_id)}</div></div><span className="font-mono text-sm text-muted-foreground">{classRow.join_code}</span></li>)}</ul>}
        </Card>
      </div>
    </PortalShell>
  );
}
