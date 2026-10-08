import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import { useAuth, type AppRole } from "@/lib/auth";
import { createManagedUser } from "@/lib/admin-users";
import { Trash2, Plus } from "lucide-react";

import { RoleGuard } from "@/components/RoleGuard";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: () => (
    <RoleGuard allow={["admin"]}>
      <AdminUsers />
    </RoleGuard>
  ),
});

const ROLES: AppRole[] = ["student", "teacher", "parent", "admin"];

function AdminUsers() {
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [role, setRole] = useState<AppRole>("student");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profs }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, parent_code, student_code, teacher_qualifications, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as AppRole]));
      return (profs ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? null }));
    },
  });

  const filtered = useMemo(
    () =>
      users.filter((u) =>
        (u.full_name ?? "").toLowerCase().includes(search.toLowerCase()),
      ),
    [users, search],
  );

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: AppRole }) => {
      const { error } = await supabase.rpc("admin_set_role", { _user_id: id, _role: role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_delete_user", { _user_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User removed");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createUser = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !email.trim() || !password.trim()) throw new Error("All fields required");
      if (password.length < 6) throw new Error("Password must be at least 6 characters");
      await createManagedUser({
        data: {
          email: email.trim(),
          password: password.trim(),
          fullName: name.trim(),
          role: role as "student" | "teacher" | "parent",
          qualifications: qualifications.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("User created");
      setName(""); setEmail(""); setPassword(""); setQualifications(""); setRole("student"); setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PortalShell title="User management" subtitle="Create accounts, search users, and change roles.">
      <div className="mb-4 flex flex-wrap gap-2">
        <Card className="p-4 flex-1 min-w-[200px]">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
          />
        </Card>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> Create account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Student name" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@school.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" />
              </div>
              {role === "teacher" && (
                <div className="space-y-1.5">
                  <Label>Qualifications</Label>
                  <Input value={qualifications} onChange={(e) => setQualifications(e.target.value)} placeholder="Subjects, grades, or certifications" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.filter((r) => r !== "admin").map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createUser.mutate()} disabled={createUser.isPending}>
                {createUser.isPending ? "Creating…" : "Create account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No users found.</p>
        ) : (
          <ul className="divide-y">
            {filtered.map((u) => (
              <li key={u.id} className="p-4 flex items-center gap-3 justify-between flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium truncate">{u.full_name || "Unnamed"}</div>
                  <div className="text-xs text-muted-foreground font-mono">{u.id.slice(0, 8)}…</div>
                  {u.role === "student" && u.student_code && (
                    <div className="text-xs text-muted-foreground">Student code: <span className="font-mono font-semibold">{u.student_code}</span></div>
                  )}
                  {u.role === "parent" && u.parent_code && (
                    <div className="text-xs text-muted-foreground">Parent code: <span className="font-mono font-semibold">{u.parent_code}</span></div>
                  )}
                  {u.role === "teacher" && u.teacher_qualifications && (
                    <div className="text-xs text-muted-foreground">Qualifications: {u.teacher_qualifications}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={u.role ?? undefined}
                    onValueChange={(v) => updateRole.mutate({ id: u.id, role: v as AppRole })}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="No role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r} className="capitalize">
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(u.id);
                      toast.success("User ID copied");
                    }}
                  >
                    Copy ID
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={u.id === currentUser?.id || deleteUser.isPending}
                    onClick={() => {
                      if (confirm(`Remove ${u.full_name || "this user"}? This cannot be undone.`)) {
                        deleteUser.mutate(u.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PortalShell>
  );
}
