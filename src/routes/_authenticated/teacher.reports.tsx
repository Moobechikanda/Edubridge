import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/teacher/reports")({
  component: TeacherReports,
});

function TeacherReports() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [term, setTerm] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const classesQuery = useQuery({
    queryKey: ["teacher-report-classes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").eq("teacher_id", user!.id).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const studentsQuery = useQuery({
    queryKey: ["teacher-report-students", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data: enrollments, error } = await supabase.from("enrollments").select("student_id").eq("class_id", classId);
      if (error) throw error;
      const ids = (enrollments ?? []).map((row) => row.student_id);
      if (!ids.length) return [];
      const { data, error: profilesError } = await supabase.from("profiles").select("id, full_name").in("id", ids).order("full_name");
      if (profilesError) throw profilesError;
      return data ?? [];
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in again to upload report cards.");
      if (!classId || !studentId || !title.trim() || !file) throw new Error("Choose a class, student, title, and PDF file.");
      if (file.type !== "application/pdf") throw new Error("Report cards must be PDF files.");
      if (file.size > 10 * 1024 * 1024) throw new Error("The PDF must be 10 MB or smaller.");
      const path = `${classId}/${studentId}/${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await supabase.storage.from("report-cards").upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { error: recordError } = await supabase.from("report_cards").insert({
        student_id: studentId,
        class_id: classId,
        title: title.trim(),
        term: term.trim() || null,
        file_path: path,
        uploaded_by: user.id,
      });
      if (recordError) {
        await supabase.storage.from("report-cards").remove([path]);
        throw recordError;
      }
    },
    onSuccess: async () => {
      toast.success("Report card uploaded for the parent to download.");
      setTitle("");
      setTerm("");
      setFile(null);
      const input = document.getElementById("report-pdf") as HTMLInputElement | null;
      if (input) input.value = "";
      await queryClient.invalidateQueries({ queryKey: ["parent-child-report-cards", studentId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <PortalShell title="Report cards" subtitle="Upload a private PDF report card for a student’s linked parent to download.">
      <Card className="max-w-2xl p-6">
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); upload.mutate(); }}>
          <div className="space-y-2">
            <Label htmlFor="report-class">Class</Label>
            <select id="report-class" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={classId} onChange={(event) => { setClassId(event.target.value); setStudentId(""); }} required>
              <option value="">Choose a class</option>
              {(classesQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-student">Student</Label>
            <select id="report-student" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={studentId} onChange={(event) => setStudentId(event.target.value)} disabled={!classId || studentsQuery.isLoading} required>
              <option value="">{studentsQuery.isLoading ? "Loading students…" : "Choose a student"}</option>
              {(studentsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.full_name || "Unnamed student"}</option>)}
            </select>
          </div>
          <div className="space-y-2"><Label htmlFor="report-title">Report title</Label><Input id="report-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Term 2 report card" required /></div>
          <div className="space-y-2"><Label htmlFor="report-term">Term or school year (optional)</Label><Input id="report-term" value={term} onChange={(event) => setTerm(event.target.value)} maxLength={80} placeholder="Term 2, 2026" /></div>
          <div className="space-y-2"><Label htmlFor="report-pdf">PDF file (10 MB maximum)</Label><Input id="report-pdf" type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /></div>
          <Button type="submit" disabled={upload.isPending || classesQuery.isLoading}><FileUp className="mr-2 h-4 w-4" />{upload.isPending ? "Uploading…" : "Upload report card"}</Button>
        </form>
      </Card>
    </PortalShell>
  );
}
