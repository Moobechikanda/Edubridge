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
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth, type AppRole } from "@/lib/auth";
import { Trash2 } from "lucide-react";

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

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profs }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, created_at").order("created_at", { ascending: false }),
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

  return (
    <PortalShell title="User management" subtitle="Search users and change their roles.">
      <Card className="p-4 mb-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
        />
      </Card>
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
