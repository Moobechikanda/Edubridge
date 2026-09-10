import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Trash2, UserPlus, MailCheck, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/parent/children")({
  validateSearch: (s: Record<string, unknown>): { code?: string } =>
    typeof s.code === "string" ? { code: s.code } : {},
  component: ParentChildren,
});

function ParentChildren() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { code: inviteCode } = useSearch({ from: "/_authenticated/parent/children" });
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const normalizedInvite = inviteCode?.trim().toUpperCase();

  const { data: children = [], isLoading } = useQuery({
    queryKey: ["parent-children", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: links, error } = await supabase
        .from("parent_links")
        .select("id, student_id, created_at")
        .eq("parent_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (links ?? []).map((l) => l.student_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return (links ?? []).map((l) => ({
        link_id: l.id,
        student_id: l.student_id,
        full_name: map.get(l.student_id) ?? "Student",
      }));
    },
  });

  const { data: invitePreview, isLoading: previewLoading } = useQuery({
    queryKey: ["invite-preview", normalizedInvite],
    enabled: !!normalizedInvite,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("preview_student_by_code", { _code: normalizedInvite! });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;
      return row ?? null;
    },
  });

  const alreadyLinked =
    invitePreview && children.some((c) => c.student_id === invitePreview.student_id);

  const linkMutation = useMutation({
    mutationFn: async (raw: string) => {
      const cleaned = raw.trim().toUpperCase();
      if (cleaned.length < 4) throw new Error("Enter a valid code");
      const { error } = await supabase.rpc("link_child_by_code", { _code: cleaned });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Child linked");
      setCode("");
      navigate({ to: "/parent/children", search: {} });
      qc.invalidateQueries({ queryKey: ["parent-children"] });
      qc.invalidateQueries({ queryKey: ["parent-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismissInvite = () => navigate({ to: "/parent/children", search: {} });

  const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/parent/children?code=`;

  return (
    <PortalShell title="My children" subtitle="Link your children's accounts to follow their progress.">
      {normalizedInvite && (
        <Card className="p-6 mb-6 border-primary/40 bg-primary/5">
          <div className="flex items-start gap-3">
            <MailCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold">You've been invited to link a child</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Invite code: <code className="font-mono">{normalizedInvite}</code>
              </p>
              {previewLoading ? (
                <p className="text-sm text-muted-foreground mt-3">Looking up student…</p>
              ) : !invitePreview ? (
                <p className="text-sm text-destructive mt-3">
                  No student matches this code. Double-check the link with your child.
                </p>
              ) : alreadyLinked ? (
                <p className="text-sm text-muted-foreground mt-3">
                  <span className="font-medium text-foreground">{invitePreview.full_name || "This student"}</span>{" "}
                  is already linked to your account.
                </p>
              ) : (
                <p className="text-sm mt-3">
                  Confirm you'd like to link{" "}
                  <span className="font-medium">{invitePreview.full_name || "this student"}</span> to your parent
                  account.
                </p>
              )}
              <div className="flex gap-2 mt-4">
                {invitePreview && !alreadyLinked && (
                  <Button
                    onClick={() => linkMutation.mutate(normalizedInvite)}
                    disabled={linkMutation.isPending}
                  >
                    {linkMutation.isPending ? "Linking…" : "Confirm and link"}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={dismissInvite}>
                  <X className="h-4 w-4 mr-1" /> Dismiss
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6 mb-6">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <UserPlus className="h-4 w-4" /> Link a child by code
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Ask your child to share their 6-character parent code (found on their student profile), or open the
          invite link they sent you.
        </p>
        <form
          className="flex flex-col sm:flex-row gap-3 sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            linkMutation.mutate(code);
          }}
        >
          <div className="flex-1">
            <Label htmlFor="code">Parent code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. A1B2C3"
              maxLength={12}
              className="font-mono uppercase"
            />
          </div>
          <Button type="submit" disabled={linkMutation.isPending}>
            {linkMutation.isPending ? "Linking…" : "Link child"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-3">
          Invite link format: <code className="font-mono">{inviteUrl}CODE</code>
        </p>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Linked children</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : children.length === 0 ? (
          <p className="text-sm text-muted-foreground">No children linked yet.</p>
        ) : (
          <ul className="divide-y">
            {children.map((c) => (
              <li key={c.link_id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.full_name}</div>
                  <Link
                    to="/parent/children/$studentId"
                    params={{ studentId: c.student_id }}
                    className="text-sm text-primary hover:underline"
                  >
                    View progress →
                  </Link>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Unlink ${c.full_name}?`)) {
                      supabase.from("parent_links").delete().eq("id", c.link_id).then(({ error }) => {
                        if (error) toast.error(error.message);
                        else {
                          toast.success("Child unlinked");
                          qc.invalidateQueries({ queryKey: ["parent-children"] });
                          qc.invalidateQueries({ queryKey: ["parent-overview"] });
                        }
                      });
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PortalShell>
  );
}
