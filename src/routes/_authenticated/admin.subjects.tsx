import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/subjects")({
  component: AdminSubjects,
});

type SubjectRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  min_grade: number | null;
  max_grade: number | null;
};

function AdminSubjects() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectRow | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["admin-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as SubjectRow[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      const payload = { name: name.trim(), code: code.trim() || null, description: description.trim() || null };
      if (editing) {
        const { error } = await supabase.from("subjects").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subjects").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Subject updated" : "Subject created");
      qc.invalidateQueries({ queryKey: ["admin-subjects"] });
      setOpen(false);
      setEditing(null);
      setName("");
      setCode("");
      setDescription("");
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subject deleted");
      qc.invalidateQueries({ queryKey: ["admin-subjects"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  const openDialog = (s?: SubjectRow) => {
    if (s) {
      setEditing(s);
      setName(s.name);
      setCode(s.code ?? "");
      setDescription(s.description ?? "");
    } else {
      setEditing(null);
      setName("");
      setCode("");
      setDescription("");
    }
    setOpen(true);
  };

  return (
    <PortalShell title="Subjects" subtitle="Manage the Zambia curriculum starter subjects and your school's own choices.">
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="h-4 w-4" /> New subject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit subject" : "New subject"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code (optional)</Label>
                <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : subjects.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No subjects yet.</Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Code</th>
                <th className="text-left px-4 py-3 font-medium">Grades</th>
                <th className="text-left px-4 py-3 font-medium">Description</th>
                <th className="w-24 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {subjects.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.code ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {s.min_grade && s.max_grade ? `Grades ${s.min_grade}-${s.max_grade}` : "All grades"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.description ?? "—"}</td>
                  <td className="px-4 py-3 flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openDialog(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </PortalShell>
  );
}
