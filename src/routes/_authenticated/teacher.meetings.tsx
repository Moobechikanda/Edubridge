import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ChevronDown, Trash2, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher/meetings")({
  component: TeacherMeetings,
});

function TeacherMeetings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [location, setLocation] = useState("");

  const { data: meetings = [] } = useQuery({
    queryKey: ["teacher-meetings-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings").select("*").order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const schedule = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !scheduledAt) throw new Error("Title and date required");
      const { error } = await supabase.from("meetings").insert({
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        scheduled_at: new Date(scheduledAt).toISOString(),
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meeting scheduled");
      setTitle(""); setDescription(""); setScheduledAt(""); setLocation("");
      qc.invalidateQueries({ queryKey: ["teacher-meetings-all"] });
      qc.invalidateQueries({ queryKey: ["meetings-upcoming"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meeting removed");
      qc.invalidateQueries({ queryKey: ["teacher-meetings-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PortalShell title="Parent–teacher meetings" subtitle="Schedule meetings and see who has RSVPed.">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="p-5 space-y-3 h-fit">
          <h2 className="font-semibold">Schedule meeting</h2>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
          </div>
          <div className="space-y-1.5">
            <Label>Date & time</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room A / Online" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} />
          </div>
          <Button onClick={() => schedule.mutate()} disabled={schedule.isPending}>
            {schedule.isPending ? "Scheduling…" : "Schedule"}
          </Button>
        </Card>

        <div className="space-y-3">
          {meetings.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">No meetings scheduled.</Card>
          ) : meetings.map((m) => (
            <MeetingRow
              key={m.id}
              meeting={m}
              canDelete={m.created_by === user?.id}
              onDelete={() => confirm("Delete this meeting?") && remove.mutate(m.id)}
            />
          ))}
        </div>
      </div>
    </PortalShell>
  );
}

function MeetingRow({ meeting, canDelete, onDelete }: { meeting: any; canDelete: boolean; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: attendees = [] } = useQuery({
    queryKey: ["meeting-attendees", meeting.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_meeting_attendees", { _meeting_id: meeting.id });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!open) return;
    const ch = supabase
      .channel(`rsvps-${meeting.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_rsvps", filter: `meeting_id=eq.${meeting.id}` },
        () => qc.invalidateQueries({ queryKey: ["meeting-attendees", meeting.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open, meeting.id, qc]);

  const counts = attendees.reduce<Record<string, number>>((acc, a: any) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1; return acc;
  }, {});

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">{meeting.title}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {new Date(meeting.scheduled_at).toLocaleString()}
            {meeting.location && ` · ${meeting.location}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            <Users className="h-3.5 w-3.5 mr-1" /> Attendees
            <ChevronDown className={`h-3.5 w-3.5 ml-1 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
          {canDelete && (
            <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete meeting">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-4 border-t pt-3">
          <div className="flex gap-2 text-xs mb-3">
            <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-300">Yes · {counts.yes ?? 0}</Badge>
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-300">Maybe · {counts.maybe ?? 0}</Badge>
            <Badge variant="secondary" className="bg-red-500/10 text-red-700 dark:text-red-300">No · {counts.no ?? 0}</Badge>
          </div>
          {attendees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No RSVPs yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {attendees.map((a: any) => (
                <li key={a.user_id} className="py-2 flex items-center justify-between gap-3">
                  <span className="font-medium">{a.full_name || "—"}</span>
                  <div className="flex items-center gap-2">
                    {a.note && <span className="text-xs text-muted-foreground italic">"{a.note}"</span>}
                    <Badge variant="outline" className="capitalize">{a.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
