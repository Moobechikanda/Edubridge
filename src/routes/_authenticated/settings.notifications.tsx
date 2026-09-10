import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  component: NotificationSettings,
});

type Prefs = { announcements: boolean; grades: boolean; messages: boolean };
const DEFAULTS: Prefs = { announcements: true, grades: true, messages: true };

function NotificationSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: prefs = DEFAULTS, isLoading } = useQuery({
    queryKey: ["notif-prefs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("announcements, grades, messages")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data as Prefs | null) ?? DEFAULTS;
    },
  });

  const update = useMutation({
    mutationFn: async (next: Prefs) => {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: user!.id, ...next, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Preferences saved");
      qc.invalidateQueries({ queryKey: ["notif-prefs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (key: keyof Prefs) => (v: boolean) =>
    update.mutate({ ...prefs, [key]: v });

  const rows: { key: keyof Prefs; label: string; desc: string }[] = [
    { key: "announcements", label: "Class announcements", desc: "When a teacher posts an announcement in your class." },
    { key: "grades", label: "Grades", desc: "When a teacher posts or updates a grade." },
    { key: "messages", label: "Direct messages", desc: "When someone sends you a message." },
  ];

  return (
    <PortalShell title="Notification settings" subtitle="Choose which notifications you receive.">
      <Card className="p-2 max-w-2xl">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.key} className="flex items-start justify-between gap-6 p-4">
                <div className="min-w-0">
                  <Label htmlFor={r.key} className="text-base">{r.label}</Label>
                  <p className="text-sm text-muted-foreground mt-1">{r.desc}</p>
                </div>
                <Switch
                  id={r.key}
                  checked={prefs[r.key]}
                  onCheckedChange={toggle(r.key)}
                  disabled={update.isPending}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="max-w-2xl mt-4 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => update.mutate(DEFAULTS)}
          disabled={update.isPending || isLoading}
        >
          <RotateCcw className="h-4 w-4 mr-2" /> Reset to defaults
        </Button>
      </div>
    </PortalShell>
  );
}
