import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/RoleGuard";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: () => (
    <RoleGuard allow={["admin"]}>
      <AuditLog />
    </RoleGuard>
  ),
});

type Row = {
  id: string;
  user_id: string;
  kind: string;
  delivered: boolean;
  reason: string | null;
  created_at: string;
};

function AuditLog() {
  const [kind, setKind] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const { data: rows = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["notif-audit", kind, status],
    queryFn: async () => {
      let q = supabase
        .from("notification_audit_log")
        .select("id, user_id, kind, delivered, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (kind !== "all") q = q.eq("kind", kind);
      if (status !== "all") q = q.eq("delivered", status === "delivered");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: nameMap = {} } = useQuery({
    queryKey: ["audit-names", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      const m: Record<string, string> = {};
      (data ?? []).forEach((p) => {
        m[p.id] = p.full_name ?? "—";
      });
      return m;
    },
  });

  return (
    <PortalShell
      title="Notification audit log"
      subtitle="Delivery decisions for announcements, grades, and messages."
    >
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Kind" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              <SelectItem value="announcement">Announcements</SelectItem>
              <SelectItem value="grade">Grades</SelectItem>
              <SelectItem value="message">Messages</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All decisions</SelectItem>
              <SelectItem value="delivered">Delivered (opt-in)</SelectItem>
              <SelectItem value="skipped">Skipped (opt-out)</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <span className="text-sm text-muted-foreground ml-auto">
            Showing latest {rows.length}
          </span>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground p-6">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6">No audit entries yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>{nameMap[r.user_id] ?? r.user_id.slice(0, 8)}</TableCell>
                  <TableCell className="capitalize">{r.kind}</TableCell>
                  <TableCell>
                    <Badge variant={r.delivered ? "default" : "secondary"}>
                      {r.delivered ? "Delivered" : "Skipped"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.reason ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </PortalShell>
  );
}
