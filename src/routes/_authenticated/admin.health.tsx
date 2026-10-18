import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { HeartPulse, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/health")({
  component: () => (
    <RoleGuard allow={["admin"]}>
      <AdminHealthRecords />
    </RoleGuard>
  ),
});

const categories = ["General", "Allergy", "Medication", "Medical condition", "Incident", "Other"];

function AdminHealthRecords() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [studentId, setStudentId] = useState("");
  const [category, setCategory] = useState("General");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().slice(0, 10));
  const [followUpDate, setFollowUpDate] = useState("");

  const studentsQuery = useQuery({
    queryKey: ["health-record-students"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");
      if (rolesError) throw rolesError;

      const studentIds = (roles ?? []).map((row) => row.user_id);
      if (studentIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", studentIds)
        .order("full_name");
      if (profilesError) throw profilesError;
      return profiles ?? [];
    },
  });

  const recordsQuery = useQuery({
    queryKey: ["admin-student-health-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_health_records")
        .select("id, student_id, category, title, details, recorded_at, follow_up_date")
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createRecord = useMutation({
    mutationFn: async () => {
      if (!studentId) throw new Error("Choose a student.");
      if (!title.trim()) throw new Error("Enter a title for the record.");
      if (!details.trim()) throw new Error("Enter the health record details.");
      if (!recordedAt) throw new Error("Choose the date for this record.");
      if (!user) throw new Error("Your administrator session has expired. Sign in again.");

      const { error } = await supabase.from("student_health_records").insert({
        student_id: studentId,
        recorded_by: user.id,
        category,
        title: title.trim(),
        details: details.trim(),
        recorded_at: recordedAt,
        follow_up_date: followUpDate || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Student health record added.");
      setCategory("General");
      setTitle("");
      setDetails("");
      setRecordedAt(new Date().toISOString().slice(0, 10));
      setFollowUpDate("");
      await queryClient.invalidateQueries({ queryKey: ["admin-student-health-records"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteRecord = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("student_health_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Health record deleted.");
      await queryClient.invalidateQueries({ queryKey: ["admin-student-health-records"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const studentNames = new Map(
    (studentsQuery.data ?? []).map((student) => [
      student.id,
      student.full_name || "Unnamed student",
    ]),
  );

  return (
    <PortalShell
      title="Student health records"
      subtitle="Add health information for a student. Only administrators and that student's linked parents can view these records."
    >
      <Card className="mb-6 p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <HeartPulse className="h-5 w-5" /> Add a health record
        </h2>

        {studentsQuery.isError ? (
          <div role="alert">
            <p className="text-sm text-destructive">Could not load the student list.</p>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() => studentsQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : (
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              createRecord.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="health-student">Student</Label>
              <select
                id="health-student"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                disabled={studentsQuery.isLoading}
                required
              >
                <option value="">
                  {studentsQuery.isLoading ? "Loading students…" : "Choose a student"}
                </option>
                {(studentsQuery.data ?? []).map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name || "Unnamed student"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="health-category">Category</Label>
              <select
                id="health-category"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="health-title">Title</Label>
              <Input
                id="health-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={160}
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="health-details">Details</Label>
              <Textarea
                id="health-details"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                maxLength={5000}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="health-recorded-at">Record date</Label>
              <Input
                id="health-recorded-at"
                type="date"
                value={recordedAt}
                onChange={(event) => setRecordedAt(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="health-follow-up">Follow-up date (optional)</Label>
              <Input
                id="health-follow-up"
                type="date"
                value={followUpDate}
                onChange={(event) => setFollowUpDate(event.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={createRecord.isPending || studentsQuery.isLoading}>
                {createRecord.isPending ? "Saving…" : "Save health record"}
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b p-5">
          <h2 className="font-semibold">Recent health records</h2>
        </div>
        {recordsQuery.isLoading ? (
          <p className="p-5 text-sm text-muted-foreground" role="status">
            Loading health records…
          </p>
        ) : recordsQuery.isError ? (
          <div className="p-5" role="alert">
            <p className="text-sm text-destructive">Could not load health records.</p>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() => recordsQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : recordsQuery.data?.length ? (
          <ul className="divide-y">
            {recordsQuery.data.map((record) => (
              <li key={record.id} className="flex flex-wrap items-start justify-between gap-3 p-5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{record.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {studentNames.get(record.student_id) || "Student"} · {record.category} ·{" "}
                    {new Date(`${record.recorded_at}T00:00:00`).toLocaleDateString()}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{record.details}</p>
                  {record.follow_up_date && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Follow-up:{" "}
                      {new Date(`${record.follow_up_date}T00:00:00`).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete health record: ${record.title}`}
                  disabled={deleteRecord.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete the health record “${record.title}”?`)) {
                      deleteRecord.mutate(record.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">No health records have been added.</p>
        )}
      </Card>
    </PortalShell>
  );
}
