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
import { Plus, Pencil, Trash2, School } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";

export const Route = createFileRoute("/_authenticated/admin/schools")({
  component: () => (
    <RoleGuard allow={["admin"]}>
      <AdminSchools />
    </RoleGuard>
  ),
});

type SchoolRow = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
};

function AdminSchools() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolRow | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ["admin-schools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as SchoolRow[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      const payload = {
        name: name.trim(),
        code: code.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("schools").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("schools").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "School updated" : "School created");
      qc.invalidateQueries({ queryKey: ["admin-schools"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setOpen(false);
      setEditing(null);
      setName(""); setCode(""); setAddress(""); setPhone(""); setEmail("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schools").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("School deleted");
      qc.invalidateQueries({ queryKey: ["admin-schools"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openDialog = (s?: SchoolRow) => {
    if (s) {
      setEditing(s);
      setName(s.name);
      setCode(s.code ?? "");
      setAddress(s.address ?? "");
      setPhone(s.phone ?? "");
      setEmail(s.email ?? "");
    } else {
      setEditing(null);
      setName(""); setCode(""); setAddress(""); setPhone(""); setEmail("");
    }
    setOpen(true);
  };

  return (
    <PortalShell title="Schools" subtitle="Manage schools in your EduBridge instance.">
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New school
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit school" : "New school"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Code (optional)</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone (optional)</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Address (optional)</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} />
              </div>
              <div className="space-y-1.5">
                <Label>Email (optional)</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
      ) : schools.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <School className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          No schools yet. Create one to get started.
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Code</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Phone</th>
                <th className="w-24 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {schools.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.code ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.email ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.phone ?? "—"}</td>
                  <td className="px-4 py-3 flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openDialog(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={s.id === currentUser?.id || remove.isPending}
                      onClick={() => {
                        if (confirm(`Delete "${s.name}"? This cannot be undone.`))
                          remove.mutate(s.id);
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