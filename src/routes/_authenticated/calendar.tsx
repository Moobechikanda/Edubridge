import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: SchoolCalendar,
});

function SchoolCalendar() {
  const { role } = useAuth();
  const {
    data: events = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["school-calendar", role],
    enabled: !!role,
    queryFn: async () => {
      const audience =
        role === "parent"
          ? ["all", "parents"]
          : role === "student"
            ? ["all", "students"]
            : role === "teacher"
              ? ["all", "teachers"]
              : ["all", "students", "parents", "teachers"];
      const { data, error } = await supabase
        .from("events")
        .select("id, title, description, event_type, start_at, end_at, location, audience")
        .in("audience", audience)
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <PortalShell title="Calendar" subtitle="Upcoming school events and dates.">
      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground" role="status">
          Loading upcoming events…
        </Card>
      ) : isError ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-destructive">Could not load events.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
            <RotateCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </Card>
      ) : events.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No upcoming events have been published for your account.
        </Card>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {events.map((event) => (
            <li key={event.id} className="px-4 py-4 sm:px-5">
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{event.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(event.start_at).toLocaleString()}
                    {event.end_at && ` · Ends ${new Date(event.end_at).toLocaleString()}`}
                  </p>
                  {event.location && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {event.location}
                    </p>
                  )}
                  {event.description && (
                    <p className="mt-2 whitespace-pre-wrap text-sm">{event.description}</p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs capitalize text-muted-foreground">
                  {event.event_type}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PortalShell>
  );
}
