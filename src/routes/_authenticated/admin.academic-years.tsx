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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Calendar } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";

export const Route = createFileRoute("/_authenticated/admin/academic-years")({
  component: () => (
    <RoleGuard allow={["admin"]}>
      <AdminAcademicYears />
    </RoleGuard>
  ),
});

type AcademicYearRow = {
  id: string;
  school_id: string;
  name: string;
  code: string | null;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
};

function AdminAcademicYears() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicYearRow | null>(null);
  const [schoolId, setSchoolId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);

  const { data: schools = [], isLoading: schoolsLoading } = useQuery({
    queryKey: ["admin-schools"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: years = [], isLoading } = useQuery({
    queryKey: ["admin-academic-years"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_years")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as AcademicYearRow[];
    },
  });

  const schoolMap = new Map(schools.map((s) => [s.id, s.name]));

  const save = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Select a school");
      if (!name.trim()) throw new Error("Name is required");
      if (!startDate) throw new Error("Start date is required");
      if (!endDate) throw new Error("End date is required");
      const payload = {
        school_id: schoolId,
        name: name.trim(),
        code: code.trim() || null,
        start_date: startDate,
        end_date: endDate,
        is_current: isCurrent,
      };
      if (editing) {
        const { error } = await supabase.from("academic_years").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("academic_years").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Academic year updated" : "Academic year created");
      qc.invalidateQueries({ queryKey: ["admin-academic-years"] });
      setOpen(false);
      setEditing(null);
      setSchoolId(""); setName(""); setCode(""); setStartDate(""); setEndDate(""); setIsCurrent(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("academic_years").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Academic year deleted");
      qc.invalidateQueries({ queryKey: ["admin-academic-years"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openDialog = (y?: AcademicYearRow) => {
    if (y) {
      setEditing(y);
      setSchoolId(y.school_id);
      setName(y.name);
      setCode(y.code ?? "");
      setStartDate(y.start_date);
      setEndDate(y.end_date);
      setIsCurrent(y.is_current);
    } else {
      setEditing(null);
      setSchoolId(schools[0]?.id ?? "");
      setName(""); setCode(""); setStartDate(""); setEndDate(""); setIsCurrent(false);
    }
    setOpen(true);
  };

  return (
    <PortalShell title="Academic years" subtitle="Define academic years and associate them with schools.">
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New academic year
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit academic year" : "New academic year"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>School</Label>
                {schoolsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading schools…</p>
                ) : (
                  <Select value={schoolId} onValueChange={setSchoolId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a school" />
                    </SelectTrigger>
                    <SelectContent>
                      {schools.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label>Code (optional)</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>End date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isCurrent}
                  onChange={(e) => setIsCurrent(e.target.checked)}
                  className="h-4 w-4"
                />
                Current academic year
              </label>
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
      ) : years.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          No academic years yet. Create one to get started.
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">School</th>
                <th className="text-left px-4 py-3 font-medium">Period</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="w-24 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {years.map((y) => (
                <tr key={y.id}>
                  <td className="px-4 py-3 font-medium">{y.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{schoolMap.get(y.school_id) ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(y.start_date).toLocaleDateString()} — {new Date(y.end_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {y.is_current ? (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        Current
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Past / Future</span>
                    )}
                  </td>
                  <td className="px-4 py-3 flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openDialog(y)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (confirm(`Delete "${y.name}"? This cannot be undone.`))
                          remove.mutate(y.id);
                      }}
                    >
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