import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, FileText, Users, MessagesSquare, Plus, Contact2, ClipboardList, Bell, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teacher/")({
  component: TeacherOverview,
});

function TeacherOverview() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["teacher-contact", user?.id],
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

  const { data: parentContacts = [] } = useQuery({
    queryKey: ["teacher-parent-contacts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_message_contacts");
      if (error) throw error;
      return (data ?? []).filter((c) => c.role === "parent");
    },
  });

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
      qc.invalidateQueries({ queryKey: ["teacher-contact", user?.id] });
      qc.invalidateQueries({ queryKey: ["teacher-parent-contacts", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: stats } = useQuery({
    queryKey: ["teacher-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: classes } = await supabase
        .from("classes")
        .select("id")
        .eq("teacher_id", user!.id);
      const classIds = (classes ?? []).map((c) => c.id);
      const [enr, asg, sub, pendingGrading] = await Promise.all([
        classIds.length
          ? supabase.from("enrollments").select("id", { count: "exact", head: true }).in("class_id", classIds)
          : Promise.resolve({ count: 0 } as any),
        classIds.length
          ? supabase.from("assignments").select("id", { count: "exact", head: true }).in("class_id", classIds)
          : Promise.resolve({ count: 0 } as any),
        classIds.length
          ? supabase
              .from("submissions")
              .select("id, assignments!inner(class_id)", { count: "exact", head: true })
              .in("assignments.class_id", classIds)
          : Promise.resolve({ count: 0 } as any),
        classIds.length
          ? supabase
              .from("submissions")
              .select("id, assignments!inner(class_id)", { count: "exact", head: true })
              .in("assignments.class_id", classIds)
              .is("graded_at", null)
          : Promise.resolve({ count: 0 } as any),
      ]);
      return {
        classes: classes?.length ?? 0,
        students: enr.count ?? 0,
        assignments: asg.count ?? 0,
        submissions: sub.count ?? 0,
        pendingGrading: pendingGrading.count ?? 0,
      };
    },
  });

  const { data: actionItems = [] } = useQuery({
    queryKey: ["teacher-action-items", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: classes } = await supabase
        .from("classes")
        .select("id")
        .eq("teacher_id", user!.id);
      const classIds = (classes ?? []).map((c) => c.id);
      if (classIds.length === 0) return [];

      const [{ data: pendingAssignments }, { data: upcomingAssessments }, { data: unreadMessages }] = await Promise.all([
        supabase
          .from("assignments")
          .select("id, title, due_date, class_id, classes(name)")
          .in("class_id", classIds)
          .order("due_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("assessments")
          .select("id, title, scheduled_at, class_id")
          .in("class_id", classIds)
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("messages")
          .select("id, sender_id, body, created_at")
          .eq("recipient_id", user!.id)
          .is("read_at", null)
          .order("created_at", { ascending: false }),
      ]);

      const items: any[] = [];
      for (const a of (pendingAssignments ?? [])) {
        items.push({ type: "assignment", title: a.title, subtitle: a.classes?.name, link: `/teacher/classes/${a.class_id}`, date: a.due_date });
      }
      for (const a of (upcomingAssessments ?? [])) {
        items.push({ type: "assessment", title: a.title, subtitle: "Upcoming assessment", link: `/teacher/assessments/${a.id}`, date: a.scheduled_at });
      }
      for (const m of (unreadMessages ?? [])) {
        items.push({ type: "message", title: "New message", subtitle: m.body?.slice(0, 60), link: "/messages", date: m.created_at });
      }
      return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
    },
  });

  useEffect(() => {
    if (!me) return;
    setContactEmail(me.contact_email ?? "");
    setContactPhone(me.contact_phone ?? "");
    setContactWhatsapp(me.contact_whatsapp ?? "");
    setContactSocials(me.contact_socials ?? "");
  }, [me]);

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teacher portal</h1>
          <p className="text-muted-foreground mt-1">Your classes, students, and action items.</p>
        </div>
        <Button asChild>
          <Link to="/teacher/classes">
            <Plus className="h-4 w-4" /> New class
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Stat icon={BookOpen} label="My classes" value={stats?.classes ?? "—"} />
        <Stat icon={Users} label="Students" value={stats?.students ?? "—"} />
        <Stat icon={FileText} label="Assignments" value={stats?.assignments ?? "—"} />
        <Stat icon={ClipboardList} label="Submissions" value={stats?.submissions ?? "—"} />
        <Stat icon={MessagesSquare} label="Pending grading" value={stats?.pendingGrading ?? "—"} color="text-amber-600" />
      </div>

      <div className="grid gap-6 mt-8 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4" /> Action required
          </h2>
          {actionItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">You're all caught up!</p>
          ) : (
            <ul className="divide-y">
              {actionItems.map((item, i) => (
                <li key={i}>
                  <Link to={item.link} className="flex items-center justify-between gap-3 py-3 hover:bg-accent/30 -mx-2 px-2 rounded-md">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.subtitle}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.date ? new Date(item.date).toLocaleDateString() : ""}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Contact2 className="h-4 w-4" /> Teacher contact profile
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Parents can see these details when they are linked to students in your classes.
          </p>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Email address</Label>
              <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="teacher@school.com" />
            </div>
            <div className="space-y-1">
              <Label>Phone number</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+260 ..." />
            </div>
            <div className="space-y-1">
              <Label>WhatsApp</Label>
              <Input value={contactWhatsapp} onChange={(e) => setContactWhatsapp(e.target.value)} placeholder="+260 ..." />
            </div>
            <div className="space-y-1">
              <Label>Social links</Label>
              <Input value={contactSocials} onChange={(e) => setContactSocials(e.target.value)} placeholder="Telegram @name" />
            </div>
            <Button onClick={() => saveContact.mutate()} disabled={saveContact.isPending} className="w-full">
              {saveContact.isPending ? "Saving..." : "Save contact details"}
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 mt-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Quick actions</h2>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link to="/teacher/classes">Manage classes</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/teacher/assessments">
                <ClipboardList className="h-4 w-4 mr-1" /> Assessments
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/messages">
                <MessagesSquare className="h-4 w-4 mr-1" /> Messages
              </Link>
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Parents in your classes</h2>
          {parentContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No linked parents found yet.</p>
          ) : (
            <ul className="divide-y">
              {parentContacts.slice(0, 5).map((p) => (
                <li key={p.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm">{p.full_name || "Parent"}</div>
                    <div className="text-xs text-muted-foreground">{p.related_student_names || "Linked student"}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {p.contact_email || ""} {p.contact_phone ? `· ${p.contact_phone}` : ""}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/messages" search={{ contact: p.id }}>Message</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
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
