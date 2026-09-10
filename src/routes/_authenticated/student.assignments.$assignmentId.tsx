import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/student/assignments/$assignmentId")({
  component: AssignmentDetail,
});

function AssignmentDetail() {
  const { assignmentId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState("");

  const { data: assignment } = useQuery({
    queryKey: ["s-assignment", assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*, classes(id, name)")
        .eq("id", assignmentId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: sub } = useQuery({
    queryKey: ["s-submission", assignmentId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("submissions")
        .select("*")
        .eq("assignment_id", assignmentId)
        .eq("student_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    setContent(sub?.content ?? "");
  }, [sub?.id]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!content.trim()) throw new Error("Add your answer first");
      if (sub) {
        if (sub.graded_at) throw new Error("Already graded — cannot resubmit");
        const { error } = await supabase
          .from("submissions")
          .update({ content: content.trim(), submitted_at: new Date().toISOString() })
          .eq("id", sub.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("submissions").insert({
          assignment_id: assignmentId,
          student_id: user!.id,
          content: content.trim(),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Submitted");
      qc.invalidateQueries({ queryKey: ["s-submission", assignmentId] });
      qc.invalidateQueries({ queryKey: ["student-assignments"] });
      qc.invalidateQueries({ queryKey: ["student-overview"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Submit failed"),
  });

  if (!assignment)
    return <div className="container mx-auto px-4 py-10 text-muted-foreground">Loading…</div>;

  const graded = !!sub?.graded_at;

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/student/assignments">
          <ArrowLeft className="h-4 w-4" /> All assignments
        </Link>
      </Button>
      <h1 className="text-3xl font-bold tracking-tight">{assignment.title}</h1>
      <p className="text-muted-foreground mt-1">
        {(assignment as any).classes?.name} · {assignment.points} points
        {assignment.due_date && ` · Due ${new Date(assignment.due_date).toLocaleString()}`}
      </p>
      {assignment.description && (
        <Card className="p-4 mt-4 text-sm whitespace-pre-wrap">{assignment.description}</Card>
      )}

      {graded && (
        <Card className="p-4 mt-6 border-primary/40 bg-primary/5">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Grade: {Number(sub!.grade)} / {assignment.points}
          </div>
          {sub!.feedback && (
            <div className="mt-3">
              <div className="text-xs uppercase text-muted-foreground tracking-wide">Teacher feedback</div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{sub!.feedback}</p>
            </div>
          )}
        </Card>
      )}

      <div className="mt-6 space-y-3">
        <Label htmlFor="answer">Your submission</Label>
        <Textarea
          id="answer"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          maxLength={5000}
          disabled={graded}
          placeholder="Write your answer here…"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {sub
              ? graded
                ? "This submission has been graded."
                : `Submitted ${new Date(sub.submitted_at).toLocaleString()}`
              : "Not submitted yet"}
          </div>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending || graded}>
            {submit.isPending ? "Saving…" : sub ? "Update submission" : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}
