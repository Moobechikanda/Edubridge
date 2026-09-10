import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock, Megaphone, BookOpenCheck, Pin, Trophy, CalendarDays } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { MeetingRsvp } from "@/components/MeetingRsvp";

export const Route = createFileRoute("/_authenticated/news")({
  component: NewsPage,
});

const categoryColor: Record<string, string> = {
  news: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  announcement: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  message: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  assignment: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  assessment: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  meeting: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  event: "bg-green-500/10 text-green-700 dark:text-green-300",
  trip: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  fees: "bg-red-500/10 text-red-700 dark:text-red-300",
  general: "bg-muted text-muted-foreground",
};

function NewsPage() {
  const { user } = useAuth();

  const { data: announcements = [] } = useQuery({
    queryKey: ["school-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_announcements")
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings-upcoming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .gte("scheduled_at", new Date(Date.now() - 86400000).toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ["assessments-upcoming", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("id, title, coverage, scheduled_at, points, class_id")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((a) => a.class_id)));
      const { data: cls } = ids.length
        ? await supabase.from("classes").select("id, name").in("id", ids)
        : { data: [] as { id: string; name: string }[] };
      const nameMap = new Map((cls ?? []).map((c) => [c.id, c.name]));
      return (data ?? []).map((a) => ({ ...a, class_name: nameMap.get(a.class_id) ?? "" }));
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events-upcoming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <PortalShell title="School news & events" subtitle="Announcements, upcoming assessments, meetings, and events.">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Megaphone className="h-5 w-5" /> Announcements
          </h2>
          {announcements.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">No school news yet.</Card>
          ) : (
            announcements.map((a) => (
              <Card key={a.id} className={`p-5 ${a.pinned ? "border-primary/40" : ""}`}>
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.pinned && <Pin className="h-4 w-4 text-primary" />}
                    <Badge className={categoryColor[a.category] ?? ""} variant="secondary">
                      {a.category}
                    </Badge>
                    <h3 className="font-semibold">{a.title}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{a.body}</p>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
              <CalendarDays className="h-5 w-5" /> Events
            </h2>
            {events.length === 0 ? (
              <Card className="p-5 text-sm text-muted-foreground">No upcoming events.</Card>
            ) : (
              <div className="space-y-3">
                {events.map((e) => (
                  <Card key={e.id} className="p-4">
                    <div className="font-medium">{e.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(e.start_at).toLocaleString()}
                      {e.end_at && ` · Ends ${new Date(e.end_at).toLocaleString()}`}
                      {e.location && ` · ${e.location}`}
                    </div>
                    {e.description && <p className="text-sm mt-2 whitespace-pre-wrap">{e.description}</p>}
                    <Badge className={categoryColor[e.event_type] ?? ""} variant="secondary">
                      {e.event_type}
                    </Badge>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
              <CalendarClock className="h-5 w-5" /> Meetings
            </h2>
            {meetings.length === 0 ? (
              <Card className="p-5 text-sm text-muted-foreground">No upcoming meetings.</Card>
            ) : (
              <div className="space-y-3">
                {meetings.map((m) => (
                  <Card key={m.id} className="p-4">
                    <div className="font-medium">{m.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(m.scheduled_at).toLocaleString()}
                      {m.location && ` · ${m.location}`}
                    </div>
                    {m.description && <p className="text-sm mt-2 whitespace-pre-wrap">{m.description}</p>}
                    <MeetingRsvp meetingId={m.id} />
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
              <BookOpenCheck className="h-5 w-5" /> Upcoming assessments
            </h2>
            {assessments.length === 0 ? (
              <Card className="p-5 text-sm text-muted-foreground">No upcoming assessments.</Card>
            ) : (
              <div className="space-y-3">
                {assessments.map((a) => (
                  <Card key={a.id} className="p-4">
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {a.class_name} · {new Date(a.scheduled_at).toLocaleDateString()} · {a.points} pts
                    </div>
                    {a.coverage && (
                      <p className="text-sm mt-2 whitespace-pre-wrap">
                        <span className="font-medium">Coverage: </span>
                        {a.coverage}
                      </p>
                    )}
                    <div className="mt-3">
                      <Link
                        to="/rankings/$classId"
                        params={{ classId: a.class_id }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <Trophy className="h-3 w-3" /> View class rankings
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </PortalShell>
  );
}
