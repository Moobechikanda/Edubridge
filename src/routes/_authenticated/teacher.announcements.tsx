import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { RoleGuard } from "@/components/RoleGuard";
import { toast } from "sonner";
import { Trash2, MessageSquare, Pin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher/announcements")({
  head: () => ({
    meta: [
      { title: "Teacher announcements | EduBridge" },
      { name: "description", content: "Post class announcements, share school-wide news with parents and students, and message families directly." },
      { property: "og:title", content: "Teacher announcements | EduBridge" },
      { property: "og:description", content: "Post class announcements, share school news, and message parents, students and administrators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGuard allow={["teacher"]}>
      <TeacherAnnouncements />
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

function TeacherAnnouncements() {
  return (
    <PortalShell
      title="Announcements & messages"
      subtitle="Reach your classes, all parents and students school-wide, or message people one-to-one."
    >
      <Tabs defaultValue="class">
        <TabsList>
          <TabsTrigger value="class">Class announcement</TabsTrigger>
          <TabsTrigger value="school">School-wide news</TabsTrigger>
          <TabsTrigger value="direct">Direct messages</TabsTrigger>
        </TabsList>
        <TabsContent value="class" className="mt-4"><ClassPanel /></TabsContent>
        <TabsContent value="school" className="mt-4"><SchoolPanel /></TabsContent>
        <TabsContent value="direct" className="mt-4"><DirectPanel /></TabsContent>
      </Tabs>
    </PortalShell>
  );
}

function ClassPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [classId, setClassId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [publishAt, setPublishAt] = useState("");


  const { data: classes = [] } = useQuery({
    queryKey: ["teacher-classes-simple", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .eq("teacher_id", user!.id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["teacher-class-announcements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, body, class_id, created_at, publish_at")
        .eq("teacher_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });


  const classNames = new Map(classes.map((c) => [c.id, c.name]));

  const { data: seenStats = {} } = useQuery({
    queryKey: ["teacher-class-announcement-seen", posts.map((p) => p.id).join(",")],
    enabled: posts.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        posts.map(async (p) => {
          const { data, error } = await supabase.rpc("get_announcement_seen_stats", {
            _announcement_id: p.id,
          });
          if (error) return [p.id, null] as const;
          const row = Array.isArray(data) ? data[0] : data;
          return [p.id, row] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, { seen_count: number; total_recipients: number } | null>;
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      if (!classId) throw new Error("Pick a class");
      if (!title.trim() || !body.trim()) throw new Error("Title and body required");
      const { error } = await supabase.from("announcements").insert({
        class_id: classId,
        teacher_id: user!.id,
        title: title.trim(),
        body: body.trim(),
        publish_at: publishAt ? new Date(publishAt).toISOString() : new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(publishAt ? "Announcement scheduled" : "Announcement sent to the class");
      setTitle(""); setBody(""); setPublishAt("");
      qc.invalidateQueries({ queryKey: ["teacher-class-announcements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher-class-announcements"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">New class announcement</h3>
        <p className="text-sm text-muted-foreground">
          Goes to enrolled students and their linked parents.
        </p>
        <div className="space-y-1.5">
          <Label>Class</Label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
            <SelectContent>
              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
        </div>
        <div className="space-y-1.5">
          <Label>Message</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={2000} />
        </div>
        <div className="space-y-1.5">
          <Label>Publish at (optional)</Label>
          <Input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
          <p className="text-xs text-muted-foreground">Leave empty to publish immediately.</p>
        </div>
        <Button onClick={() => post.mutate()} disabled={post.isPending}>
          {post.isPending ? "Sending…" : publishAt ? "Schedule announcement" : "Send announcement"}
        </Button>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Your class announcements</h3>
        {posts.length === 0 && <p className="text-sm text-muted-foreground">Nothing posted yet.</p>}
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{p.title}</p>
                    {new Date(p.publish_at) > new Date() && <Badge variant="outline">Scheduled</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{p.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {classNames.get(p.class_id) ?? "Class"} ·{" "}
                    {new Date(p.publish_at) > new Date()
                      ? `Publishes ${new Date(p.publish_at).toLocaleString()}`
                      : new Date(p.publish_at).toLocaleString()}
                  </p>
                  {seenStats[p.id] && (
                    <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground mt-1">
                      Seen by {seenStats[p.id]!.seen_count}/{seenStats[p.id]!.total_recipients}
                    </span>
                  )}
                </div>

                <Button variant="ghost" size="icon" onClick={() => remove.mutate(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function SchoolPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("news");
  const [pinned, setPinned] = useState(false);
  const [publishAt, setPublishAt] = useState("");


  const { data: mine = [] } = useQuery({
    queryKey: ["teacher-school-news", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_announcements")
        .select("*")
        .eq("posted_by", user!.id)
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
        publish_at: publishAt ? new Date(publishAt).toISOString() : new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sent to an administrator for review");
      setTitle(""); setBody(""); setPinned(false); setCategory("news"); setPublishAt("");
      qc.invalidateQueries({ queryKey: ["teacher-school-news"] });
      qc.invalidateQueries({ queryKey: ["school-announcements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("school_announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher-school-news"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">New school-wide post</h3>
        <p className="text-sm text-muted-foreground">
          Sent to an administrator for approval. Once approved it appears on the News page for every
          parent, student and administrator.
        </p>
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
        <div className="space-y-1.5">
          <Label>Publish at (optional)</Label>
          <Input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
          <p className="text-xs text-muted-foreground">Leave empty to publish as soon as it's approved.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={pinned} onCheckedChange={(v) => setPinned(v === true)} /> Pin to top
        </label>
        <Button onClick={() => post.mutate()} disabled={post.isPending}>
          {post.isPending ? "Submitting…" : "Submit for approval"}
        </Button>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Your school news posts</h3>
        {mine.length === 0 && <p className="text-sm text-muted-foreground">You haven't posted school news yet.</p>}
        <ul className="space-y-3">
          {mine.map((n) => (
            <li key={n.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{n.category}</Badge>
                    <Badge
                      variant={
                        n.status === "approved" ? "default" : n.status === "rejected" ? "destructive" : "outline"
                      }
                    >
                      {n.status === "approved"
                        ? new Date(n.publish_at) > new Date() ? "Approved · scheduled" : "Published"
                        : n.status === "rejected" ? "Rejected" : "Pending review"}
                    </Badge>
                    {n.pinned && <Pin className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <p className="mt-1 font-medium">{n.title}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.body}</p>
                  {n.review_note && (
                    <p className="mt-1 text-xs text-destructive">Admin note: {n.review_note}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(n.publish_at) > new Date()
                      ? `Publishes ${new Date(n.publish_at).toLocaleString()}`
                      : new Date(n.created_at).toLocaleString()}
                  </p>
                </div>

                <Button variant="ghost" size="icon" onClick={() => remove.mutate(n.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function DirectPanel() {
  return (
    <Card className="p-6 space-y-3">
      <h3 className="font-semibold">Message a person directly</h3>
      <p className="text-sm text-muted-foreground">
        Send private messages to your students, their parents, other teachers and administrators.
        Replies appear in real time and trigger a notification if the recipient allows message alerts.
      </p>
      <Button asChild>
        <Link to="/messages"><MessageSquare className="mr-2 h-4 w-4" /> Open messages</Link>
      </Button>
    </Card>
  );
}
