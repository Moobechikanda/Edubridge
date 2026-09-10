import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Bell, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/parent/announcements")({
  component: ParentAnnouncements,
});

function ParentAnnouncements() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["parent-announcements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, body, created_at, class_id, classes(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: reads = [] } = useQuery({
    queryKey: ["announcement-reads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcement_reads")
        .select("announcement_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const readSet = new Set(reads.map((r) => r.announcement_id));
  const unreadCount = announcements.filter((a) => !readSet.has(a.id)).length;

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user || ids.length === 0) return;
      const rows = ids.map((announcement_id) => ({ announcement_id, user_id: user.id }));
      const { error } = await supabase
        .from("announcement_reads")
        .upsert(rows, { onConflict: "announcement_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcement-reads"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PortalShell title="Announcements" subtitle="Messages from your children's teachers.">
      {announcements.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </div>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => markRead.mutate(announcements.filter((a) => !readSet.has(a.id)).map((a) => a.id))}
              disabled={markRead.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
      ) : announcements.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No announcements yet.
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => {
            const isRead = readSet.has(a.id);
            return (
              <Card key={a.id} className={`p-5 ${isRead ? "" : "border-primary/40 bg-primary/5"}`}>
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    {!isRead && <span className="h-2 w-2 rounded-full bg-primary" />}
                    <h3 className="font-semibold">{a.title}</h3>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mb-2">{a.classes?.name}</div>
                <p className="text-sm whitespace-pre-wrap">{a.body}</p>
                {!isRead && (
                  <div className="mt-3">
                    <Button size="sm" variant="ghost" onClick={() => markRead.mutate([a.id])}>
                      <Check className="h-4 w-4 mr-1" /> Mark as read
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PortalShell>
  );
}
