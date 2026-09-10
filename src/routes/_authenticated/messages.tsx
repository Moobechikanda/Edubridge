import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Send, Search } from "lucide-react";

const searchSchema = z.object({
  contact: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (s) => searchSchema.parse(s),
  component: MessagesPage,
});

type Contact = {
  id: string;
  full_name: string | null;
  role: string | null;
  related_student_names: string | null;
  related_class_names: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  contact_socials: string | null;
};

function MessagesPage() {
  const { user, role } = useAuth();
  const { contact } = Route.useSearch();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: contacts = [] } = useQuery({
    queryKey: ["msg-contacts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_message_contacts");
      if (!error && data) {
        return (data ?? []) as Contact[];
      }

      // Fallback for older schemas: only staff can be messaged.
      const { data: fallback } = await supabase
        .from("profiles")
        .select("id, full_name, contact_email, contact_phone, contact_whatsapp, contact_socials")
        .neq("id", user!.id)
        .order("full_name");
      return (fallback ?? []).map((c) => ({
        ...c,
        role: "contact",
        related_student_names: null,
        related_class_names: null,
      })) as Contact[];
    },
  });

  const filtered = useMemo(
    () =>
      contacts.filter((c) =>
        [c.full_name, c.related_student_names, c.related_class_names]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [contacts, search],
  );

  useEffect(() => {
    if (contact && contacts.some((c) => c.id === contact)) {
      setActiveId(contact);
    }
  }, [contact, contacts]);

  const { data: thread = [] } = useQuery({
    queryKey: ["msg-thread", user?.id, activeId],
    enabled: !!user && !!activeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, recipient_id, body, created_at, read_at")
        .or(
          `and(sender_id.eq.${user!.id},recipient_id.eq.${activeId}),and(sender_id.eq.${activeId},recipient_id.eq.${user!.id})`,
        )
        .order("created_at");
      return data ?? [];
    },
  });

  // Realtime new messages
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`msg-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          qc.invalidateQueries({ queryKey: ["msg-thread"] });
          qc.invalidateQueries({ queryKey: ["msg-unread-counts"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  // Mark unread as read when opening thread
  useEffect(() => {
    if (!user || !activeId) return;
    const unread = thread.filter((m) => m.recipient_id === user.id && !m.read_at).map((m) => m.id);
    if (unread.length > 0) {
      supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unread).then(() => {
        qc.invalidateQueries({ queryKey: ["msg-thread"] });
        qc.invalidateQueries({ queryKey: ["msg-unread-counts"] });
      });
    }
    // scroll
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }, [thread, user, activeId, qc]);

  const send = useMutation({
    mutationFn: async () => {
      if (!user || !activeId || !draft.trim()) return;
      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        recipient_id: activeId,
        body: draft.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["msg-thread"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: unreadCounts = {} } = useQuery({
    queryKey: ["msg-unread-counts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("sender_id")
        .eq("recipient_id", user!.id)
        .is("read_at", null);
      const counts: Record<string, number> = {};
      for (const m of data ?? []) {
        counts[m.sender_id] = (counts[m.sender_id] ?? 0) + 1;
      }
      return counts;
    },
  });

  const active = contacts.find((c) => c.id === activeId) ?? null;
  const activeName = active?.full_name ?? "Contact";

  return (
    <PortalShell
      title="Messages"
      subtitle={
        role === "parent"
          ? "Message your child's teachers directly."
          : role === "teacher"
            ? "Message parents of students in your classes."
            : "Direct messages with your school contacts."
      }
    >
      <Card className="grid md:grid-cols-[280px_1fr] overflow-hidden h-[600px]">
        <aside className="border-r flex flex-col min-h-0">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts"
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No contacts available.</p>
            ) : (
              <ul>
                {filtered.map((c) => {
                  const unread = unreadCounts[c.id] ?? 0;
                  return (
                  <li key={c.id}>
                    <button
                      onClick={() => setActiveId(c.id)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-accent/40 border-b flex items-center justify-between gap-2 ${
                        activeId === c.id ? "bg-accent" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.full_name || "Unnamed"}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {(c.role ?? "contact").toUpperCase()}
                          {c.related_student_names ? ` · ${c.related_student_names}` : ""}
                        </div>
                      </div>
                      {unread > 0 && (
                        <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold h-5 min-w-5 px-1">
                          {unread}
                        </span>
                      )}
                    </button>
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="flex flex-col min-h-0">
          {!activeId ? (
            <div className="flex-1 grid place-items-center text-sm text-muted-foreground">
              Select a contact to start chatting.
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b">
                <div className="font-semibold">{activeName}</div>
                {active?.related_class_names && (
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{active.related_class_names}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {active?.contact_email && <span>Email: {active.contact_email}</span>}
                  {active?.contact_phone && <span>Phone: {active.contact_phone}</span>}
                  {active?.contact_whatsapp && <span>WhatsApp: {active.contact_whatsapp}</span>}
                </div>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-2">
                {thread.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No messages yet. Say hi!</p>
                ) : (
                  thread.map((m) => {
                    const mine = m.sender_id === user?.id;
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                            mine ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          <div className="whitespace-pre-wrap break-words">{m.body}</div>
                          <div
                            className={`text-[10px] mt-1 flex items-center gap-1 justify-end ${
                              mine ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}
                          >
                            {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {mine && <span>{m.read_at ? "· Seen" : "· Sent"}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send.mutate();
                }}
                className="border-t p-3 flex gap-2 items-end"
              >
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message…"
                  rows={1}
                  className="resize-none min-h-[40px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send.mutate();
                    }
                  }}
                />
                <Button type="submit" size="icon" disabled={send.isPending || !draft.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </section>
      </Card>
    </PortalShell>
  );
}
