import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Plus, Trash2, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher/events")({
  component: TeacherEvents,
});

const EVENT_TYPES = ["event", "meeting", "trip", "workshop", "sports", "general"] as const;
const AUDIENCES = ["all", "students", "parents", "teachers"] as const;

function TeacherEvents() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("event");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [location, setLocation] = useState("");
  const [audience, setAudience] = useState("all");

  const { data: events = [] } = useQuery({
    queryKey: ["teacher-events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("created_by", user!.id)
        .order("start_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !startAt) throw new Error("Title and start date are required");
      const { error } = await supabase.from("events").insert({
        title: title.trim(),
        description: description.trim() || null,
        event_type: eventType,
        start_at: new Date(startAt).toISOString(),
        end_at: endAt ? new Date(endAt).toISOString() : null,
        location: location.trim() || null,
        audience: audience,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event created");
      setTitle(""); setDescription(""); setStartAt(""); setEndAt(""); setLocation(""); setEventType("event"); setAudience("all");
      qc.invalidateQueries({ queryKey: ["teacher-events", user?.id] });
      qc.invalidateQueries({ queryKey: ["events-upcoming"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event deleted");
      qc.invalidateQueries({ queryKey: ["teacher-events", user?.id] });
      qc.invalidateQueries({ queryKey: ["events-upcoming"] });
    },
  });

  return (
    <PortalShell title="My events" subtitle="Create and manage events for your classes.">
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card className="p-5 space-y-3 h-fit">
          <h3 className="font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> New event</h3>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} />
          </div>
          <div className="space-y-1.5">
            <Label>Audience</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUDIENCES.map((a) => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full">
            {create.isPending ? "Creating…" : "Create event"}
          </Button>
        </Card>

        <div className="space-y-3">
          {events.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">No events yet.</Card>
          ) : events.map((e) => (
            <Card key={e.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    {e.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(e.start_at).toLocaleString()}
                    {e.end_at && ` · Ends ${new Date(e.end_at).toLocaleString()}`}
                    {e.location && ` · ${e.location}`}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary capitalize">
                      {e.event_type}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground capitalize">
                      {e.audience}
                    </span>
                  </div>
                  {e.description && <p className="text-sm mt-2 whitespace-pre-wrap">{e.description}</p>}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Delete this event?")) remove.mutate(e.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PortalShell>
  );
}
