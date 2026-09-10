import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Baby, BookOpen, Bell, ClipboardCheck, Contact2, TriangleAlert, User, ClipboardList, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/parent/")({
  component: ParentOverview,
});

function ParentOverview() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["parent-contact", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("contact_email, contact_phone, contact_whatsapp, contact_socials")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const [contactSocials, setContactSocials] = useState("");

  useEffect(() => {
    if (!me) return;
    setContactEmail(me.contact_email ?? "");
    setContactPhone(me.contact_phone ?? "");
    setContactWhatsapp(me.contact_whatsapp ?? "");
    setContactSocials(me.contact_socials ?? "");
  }, [me]);

  const saveContact = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,
          contact_whatsapp: contactWhatsapp.trim() || null,
          contact_socials: contactSocials.trim() || null,
        })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contact details saved");
      qc.invalidateQueries({ queryKey: ["parent-contact", user?.id] });
      qc.invalidateQueries({ queryKey: ["parent-teacher-contacts", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: teacherContacts = [] } = useQuery({
    queryKey: ["parent-teacher-contacts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_message_contacts");
      if (error) throw error;
      return (data ?? []).filter((c) => c.role === "teacher");
    },
  });

  const { data: children = [] } = useQuery({
    queryKey: ["parent-children", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: links } = await supabase
        .from("parent_links")
        .select("student_id")
        .eq("parent_id", user!.id);
      const ids = (links ?? []).map((l) => l.student_id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      return data ?? [];
    },
  });

  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  const selectedChild = children.find((c) => c.id === selectedChildId);

  const { data: childData } = useQuery({
    queryKey: ["parent-child-overview", selectedChildId],
    enabled: !!selectedChildId,
    queryFn: async () => {
      const { data: enr } = await supabase
        .from("enrollments")
        .select("class_id, classes(id, name, subject, teacher_id)")
        .eq("student_id", selectedChildId!);
      const clsIds = (enr ?? []).map((e) => (e as any).classes?.id).filter(Boolean);
      const teacherIds = Array.from(new Set((enr ?? []).map((e) => (e as any).classes?.teacher_id).filter(Boolean)));
      const [{ data: teachers }, { data: assignments }, { data: subs }, { data: anns }] = await Promise.all([
        teacherIds.length ? supabase.from("profiles").select("id, full_name").in("id", teacherIds) : { data: [] as any[] },
        clsIds.length ? supabase.from("assignments").select("id, title, due_date, points, class_id, classes(name)").in("class_id", clsIds) : { data: [] as any[] },
        supabase.from("submissions").select("assignment_id, grade, submitted_at").eq("student_id", selectedChildId!),
        supabase.from("announcements").select("id, title, created_at").gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
      ]);
      const teacherMap = new Map((teachers ?? []).map((t) => [t.id, t.full_name]));
      const subMap = new Map((subs ?? []).map((s) => [s.assignment_id, s]));
      const now = Date.now();
      const pending = (assignments ?? []).filter((a: any) => {
        const sub = subMap.get(a.id);
        if (sub) return false;
        return !a.due_date || new Date(a.due_date).getTime() > now;
      });
      const missed = (assignments ?? []).filter((a: any) => {
        const sub = subMap.get(a.id);
        return !sub && a.due_date && new Date(a.due_date).getTime() < now;
      });
      const upcoming = (assignments ?? []).filter((a: any) => {
        const sub = subMap.get(a.id);
        if (sub) return false;
        const due = a.due_date ? new Date(a.due_date).getTime() : 0;
        return due > now && due < now + 7 * 86400000;
      });
      const completed = (assignments ?? []).filter((a: any) => subMap.get(a.id)?.grade != null);
      const grades = (subs ?? []).filter((s) => s.grade != null).map((s) => Number(s.grade));
      const avg = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : null;

      return {
        classes: (enr ?? []).length,
        pending: pending.length,
        missed: missed.length,
        upcoming: upcoming.length,
        completed: completed.length,
        avgGrade: avg,
        announcements: (anns ?? []).length,
        teachers: teacherMap,
        assignments: (assignments ?? []).map((a: any) => ({ ...a, submission: subMap.get(a.id) })),
      };
    },
  });

  const { data: parentNotices = [] } = useQuery({
    queryKey: ["parent-priority-notices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_announcements")
        .select("id, category, title, body, publish_at")
        .in("category", ["fees", "trip", "event", "meeting"])
        .order("publish_at", { ascending: true })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <PortalShell
      title="Parent portal"
      subtitle={selectedChild ? `Viewing progress for ${selectedChild.full_name}` : "Stay connected with your child's school journey."}
    >
      {children.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {children.map((c) => (
            <Button
              key={c.id}
              variant={c.id === selectedChildId ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedChildId(c.id)}
            >
              <User className="h-4 w-4 mr-1" /> {c.full_name}
            </Button>
          ))}
        </div>
      )}

      {!selectedChild ? (
        <Card className="p-10 text-center text-muted-foreground">
          Link a child to view their progress.
          <div className="mt-3">
            <Link to="/parent/children" className="text-primary hover:underline">Link a child</Link>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Stat icon={BookOpen} label="Classes" value={childData?.classes ?? "—"} />
            <Stat icon={ClipboardList} label="Pending work" value={childData?.pending ?? "—"} />
            <Stat icon={TriangleAlert} label="Missed" value={childData?.missed ?? "—"} color="text-destructive" />
            <Stat icon={TrendingUp} label="Average grade" value={childData?.avgGrade != null ? `${childData.avgGrade.toFixed(1)}%` : "—"} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 p-6">
              <h2 className="font-semibold mb-4">Subjects & teachers</h2>
              {!childData || childData.classes === 0 ? (
                <p className="text-sm text-muted-foreground">Not enrolled in any classes yet.</p>
              ) : (
                <div className="space-y-4">
                  {childData.assignments?.length ? (
                    <div className="grid gap-3">
                      {Array.from(new Map(childData.assignments.map((a: any) => [a.class_id, a.classes])).entries()).map(([classId, cls]: [string, any]) => {
                        const teacherName = childData.teachers?.get((cls as any)?.teacher_id) || "Not available";
                        return (
                          <div key={classId} className="flex items-start justify-between p-3 rounded-md bg-muted/30">
                            <div>
                              <div className="font-medium">{cls?.name}</div>
                              {cls?.subject && <div className="text-sm text-muted-foreground">{cls.subject}</div>}
                              <div className="text-xs text-muted-foreground mt-1">Teacher: {teacherName}</div>
                            </div>
                            <Button asChild size="sm" variant="ghost">
                              <Link to="/messages" search={{ contact: (cls as any)?.teacher_id }}>Message</Link>
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No classes found.</p>
                  )}
                </div>
              )}
            </Card>

            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <Contact2 className="h-4 w-4" /> Parent contact profile
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Teachers of your children can see these details.
                </p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Email address</Label>
                    <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="parent@email.com" />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone number</Label>
                    <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+260 ..." />
                  </div>
                  <div className="space-y-1">
                    <Label>WhatsApp</Label>
                    <Input value={contactWhatsapp} onChange={(e) => setContactWhatsapp(e.target.value)} placeholder="+260 ..." />
                  </div>
                  <Button onClick={() => saveContact.mutate()} disabled={saveContact.isPending} className="w-full">
                    {saveContact.isPending ? "Saving..." : "Save contact details"}
                  </Button>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="font-semibold mb-4">Important notices</h2>
                {parentNotices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No outstanding fees or upcoming events posted.</p>
                ) : (
                  <ul className="divide-y">
                    {parentNotices.map((n) => (
                      <li key={n.id} className="py-2">
                        <div className="text-xs uppercase text-muted-foreground">{n.category}</div>
                        <div className="font-medium text-sm">{n.title}</div>
                        <div className="text-xs text-muted-foreground">{new Date(n.publish_at).toLocaleString()}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          <Card className="mt-6 p-6">
            <h2 className="font-semibold mb-4">Assignment progress</h2>
            {!childData || childData.assignments?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assignments yet.</p>
            ) : (
              <div className="grid gap-3">
                {childData.assignments.slice(0, 20).map((a: any) => {
                  const s = a.submission;
                  const status = s?.grade != null ? `Graded: ${s.grade}/${a.points}` : s ? "Submitted" : "Not submitted";
                  return (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-md bg-muted/30">
                      <div>
                        <div className="font-medium text-sm">{a.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {(a.assignment_type ?? "homework").toUpperCase()} · {a.classes?.name}
                          {a.due_date && ` · Due ${new Date(a.due_date).toLocaleDateString()}`}
                        </div>
                        {s?.feedback && <div className="text-xs mt-1 italic">"{s.feedback}"</div>}
                      </div>
                      <div className="text-sm font-medium">{status}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </PortalShell>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className={`text-2xl font-semibold mt-1 ${color ?? ""}`}>{value}</div>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
