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
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";

export const Route = createFileRoute("/_authenticated/admin/terms")({
  component: () => (
    <RoleGuard allow={["admin"]}>
      <AdminTerms />
    </RoleGuard>
  ),
});

type TermRow = {
  id: string;
  academic_year_id: string;
  name: string;
  code: string | null;
  start_date: string;
  end_date: string;
  is_current: boolean;
  sort_order: number;
  created_at: string;
};

function AdminTerms() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TermRow | null>(null);
  const [academicYearId, setAcademicYearId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [sortOrder, setSortOrder] = useState("0");

  const { data: years = [], isLoading: yearsLoading } = useQuery({
    queryKey: ["admin-academic-years"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_years")
        .select("id, name, code")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: terms = [], isLoading } = useQuery({
    queryKey: ["admin-terms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("terms")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as TermRow[];
    },
  });

  const yearMap = new Map(years.map((y) => [y.id, `${y.name} (${y.code ?? ""})`.trim()]));

  const save = useMutation({
    mutationFn: async () => {
      if (!academicYearId) throw new Error("Select an academic year");
      if (!name.trim()) throw new Error("Name is required");
      if (!startDate) throw new Error("Start date is required");
      if (!endDate) throw new Error("End date is required");
      const payload = {
        academic_year_id: academicYearId,
        name: name.trim(),
        code: code.trim() || null,
        start_date: startDate,
        end_date: endDate,
        is_current: isCurrent,
        sort_order: parseInt(sortOrder || "0", 10),
      };
      if (editing) {
        const { error } = await supabase.from("terms").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("terms").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Term updated" : "Term created");
      qc.invalidateQueries({ queryKey: ["admin-terms"] });
      setOpen(false);
      setEditing(null);
      setAcademicYearId(""); setName(""); setCode(""); setStartDate(""); setEndDate(""); setIsCurrent(false); setSortOrder("0");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("terms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Term deleted");
      qc.invalidateQueries({ queryKey: ["admin-terms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openDialog = (t?: TermRow) => {
    if (t) {
      setEditing(t);
      setAcademicYearId(t.academic_year_id);
      setName(t.name);
      setCode(t.code ?? "");
      setStartDate(t.start_date);
      setEndDate(t.end_date);
      setIsCurrent(t.is_current);
      setSortOrder(String(t.sort_order));
    } else {
      setEditing(null);
      setAcademicYearId(years[0]?.id ?? "");
      setName(""); setCode(""); setStartDate(""); setEndDate(""); setIsCurrent(false); setSortOrder("0");
    }
    setOpen(true);
  };

  return (
    <PortalShell title="Terms" subtitle="Manage terms/semesters within academic years.">
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New term
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit term" : "New term"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Academic year</Label>
                {yearsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                  <Select value={academicYearId} onValueChange={setAcademicYearId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select academic year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Sort order</Label>
                  <Input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
                </div>
                <div className="space-y-1.5 flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isCurrent}
                      onChange={(e) => setIsCurrent(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Current term
                  </label>
                </div>
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
      ) : terms.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          No terms yet. Create one to get started.
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Academic year</th>
                <th className="text-left px-4 py-3 font-medium">Period</th>
                <th className="text-left px-4 py-3 font-medium">Order</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="w-24 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {terms.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{yearMap.get(t.academic_year_id) ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(t.start_date).toLocaleDateString()} — {new Date(t.end_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{t.sort_order}</td>
                  <td className="px-4 py-3">
                    {t.is_current ? (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        Current
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openDialog(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (confirm(`Delete "${t.name}"? This cannot be undone.`))
                          remove.mutate(t.id);
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