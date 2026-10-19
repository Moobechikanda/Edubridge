import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/parent/meetings")({
  component: ParentMeetingNotes,
});

function ParentMeetingNotes() {
  const { data: meetings = [], isLoading, isError } = useQuery({
    queryKey: ["parent-meeting-notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meetings").select("id, title, description, scheduled_at, location, minutes, conclusions").order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  function download(meeting: (typeof meetings)[number]) {
    const text = [
      meeting.title,
      new Date(meeting.scheduled_at).toLocaleString(),
      meeting.location ? `Location: ${meeting.location}` : "",
      "",
      "MINUTES",
      meeting.minutes || "No minutes have been published.",
      "",
      "CONCLUSIONS",
      meeting.conclusions || "No conclusions have been published.",
    ].filter(Boolean).join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${meeting.title.replace(/[^a-z0-9-_]+/gi, "-")}-minutes.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PortalShell title="Meeting minutes" subtitle="Review and download minutes and conclusions shared after school meetings.">
      <div className="space-y-3">
        {isLoading ? <Card className="p-6 text-sm text-muted-foreground">Loading meetings…</Card>
          : isError ? <Card className="p-6 text-sm text-destructive">Could not load meeting notes. Please try again.</Card>
            : meetings.length === 0 ? <Card className="p-6 text-sm text-muted-foreground">No meeting notes have been published.</Card>
              : meetings.map((meeting) => (
                <Card key={meeting.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{meeting.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{new Date(meeting.scheduled_at).toLocaleString()}{meeting.location ? ` · ${meeting.location}` : ""}</p>
                      {meeting.description && <p className="mt-2 text-sm">{meeting.description}</p>}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => download(meeting)}><Download className="mr-2 h-4 w-4" />Download minutes</Button>
                  </div>
                  <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
                    <section><h3 className="text-sm font-medium">Minutes</h3><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{meeting.minutes || "Not published yet."}</p></section>
                    <section><h3 className="text-sm font-medium">Conclusions and actions</h3><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{meeting.conclusions || "Not published yet."}</p></section>
                  </div>
                </Card>
              ))}
      </div>
    </PortalShell>
  );
}
