import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { RoleGuard } from "@/components/RoleGuard";
import { toast } from "sonner";
import { Trash2, Pin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/news")({
  component: () => (
    <RoleGuard allow={["admin"]}>
      <AdminNews />
    </RoleGuard>
  ),
});

const CATEGORIES = [
  "news",
  "announcement",
  "message",
  "assignment",
  "assessment",
  "meeting",
  "event",
  "trip",
  "fees",
  "general",
] as const;

function AdminNews() {
  return (
    <PortalShell title="School news & meetings" subtitle="Post school-wide updates and schedule parent–teacher meetings.">
      <Tabs defaultValue="news">
        <TabsList>
          <TabsTrigger value="news">Announcements</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
        </TabsList>
        <TabsContent value="news" className="mt-4">
          <NewsPanel />
        </TabsContent>
        <TabsContent value="meetings" className="mt-4">
          <MeetingsPanel />
        </TabsContent>
      </Tabs>
    </PortalShell>
  );
}

function NewsPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("news");
  const [pinned, setPinned] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["admin-school-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !body.trim()) throw new Error("Title and body required");
      const { error } = await supabase.from("school_announcements").insert({
        title: title.trim(), body: body.trim(), category, pinned, posted_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Posted to school news");
      setTitle(""); setBody(""); setPinned(false); setCategory("news");
      qc.invalidateQueries({ queryKey: ["admin-school-announcements"] });
      qc.invalidateQueries({ queryKey: ["school-announcements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("school_announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-school-announcements"] }),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">New announcement</h3>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
        </div>
        <div className="space-y-1.5">
          <Label>Body</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={2000} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={pinned} onCheckedChange={(v) => setPinned(v === true)} /> Pin to top
        </label>
        <Button onClick={() => post.mutate()} disabled={post.isPending}>
          {post.isPending ? "Posting…" : "Post"}
        </Button>
      </Card>

      <div className="space-y-3">
        {items.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No announcements yet.</Card>
        ) : items.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {a.pinned && <Pin className="h-3 w-3 text-primary" />}
                  <span className="text-xs font-medium uppercase text-muted-foreground">{a.category}</span>
                  <span className="font-semibold">{a.title}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleString()}</div>
                <p className="text-sm mt-2 whitespace-pre-wrap line-clamp-3">{a.body}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => confirm("Delete?") && remove.mutate(a.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MeetingsPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [location, setLocation] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["admin-meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings").select("*").order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const post = useMutation({
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
      qc.invalidateQueries({ queryKey: ["admin-meetings"] });
      qc.invalidateQueries({ queryKey: ["meetings-upcoming"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-meetings"] }),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Schedule meeting</h3>
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Date & time</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room A / Online" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} />
        </div>
        <Button onClick={() => post.mutate()} disabled={post.isPending}>
          {post.isPending ? "Scheduling…" : "Schedule"}
        </Button>
      </Card>

      <div className="space-y-3">
        {items.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No meetings scheduled.</Card>
        ) : items.map((m) => (
          <Card key={m.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{m.title}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(m.scheduled_at).toLocaleString()}
                  {m.location && ` · ${m.location}`}
                </div>
                {m.description && <p className="text-sm mt-2 whitespace-pre-wrap line-clamp-3">{m.description}</p>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => confirm("Delete?") && remove.mutate(m.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
