import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type Status = "yes" | "no" | "maybe";

export function MeetingRsvp({ meetingId }: { meetingId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: rsvp } = useQuery({
    queryKey: ["my-rsvp", meetingId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("meeting_rsvps")
        .select("status")
        .eq("meeting_id", meetingId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const setStatus = useMutation({
    mutationFn: async (status: Status) => {
      const { error } = await supabase.rpc("rsvp_meeting", { _meeting_id: meetingId, _status: status });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("RSVP updated");
      qc.invalidateQueries({ queryKey: ["my-rsvp", meetingId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const current = rsvp?.status as Status | undefined;
  const opts: { v: Status; label: string }[] = [
    { v: "yes", label: "Yes" }, { v: "maybe", label: "Maybe" }, { v: "no", label: "No" },
  ];

  return (
    <div className="flex items-center gap-1.5 mt-3">
      <span className="text-xs text-muted-foreground mr-1">RSVP:</span>
      {opts.map((o) => (
        <Button key={o.v} size="sm" variant={current === o.v ? "default" : "outline"}
          className="h-7 text-xs px-2.5"
          onClick={() => setStatus.mutate(o.v)} disabled={setStatus.isPending}>
          {o.label}
        </Button>
      ))}
    </div>
  );
}
