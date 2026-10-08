import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { Users, BookOpen, MessagesSquare, GraduationCap, ScrollText, Newspaper, Wallet, Plus, CalendarClock, Megaphone, FileText, School, Layers } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: () => (
    <RoleGuard allow={["admin"]}>
      <AdminDashboard />
    </RoleGuard>
  ),
});

function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, classes, schools, academicYears, announcements, enrollments, roles, assignments, events, fees] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("schools").select("id", { count: "exact", head: true }),
        supabase.from("academic_years").select("id", { count: "exact", head: true }),
        supabase.from("announcements").select("id", { count: "exact", head: true }),
        supabase.from("enrollments").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("role"),
        supabase.from("assignments").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("student_fees").select("id, status", { count: "exact", head: true }),
      ]);
      const byRole = (roles.data ?? []).reduce<Record<string, number>>((acc, r) => {
        acc[r.role] = (acc[r.role] ?? 0) + 1;
        return acc;
      }, {});
      const outstandingFees = (fees.data ?? []).filter((f: any) => f.status === "outstanding").length;
      return {
        users: users.count ?? 0,
        classes: classes.count ?? 0,
        schools: schools.count ?? 0,
        academicYears: academicYears.count ?? 0,
        announcements: announcements.count ?? 0,
        enrollments: enrollments.count ?? 0,
        assignments: assignments.count ?? 0,
        events: events.count ?? 0,
        byRole,
        outstandingFees,
      };
    },
  });

  const { data: recentUsers = [] } = useQuery({
    queryKey: ["admin-recent-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: recentClasses = [] } = useQuery({
    queryKey: ["admin-recent-classes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("classes")
        .select("id, name, subject, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ["admin-upcoming-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, start_at, event_type")
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(5);
      return data ?? [];
    },
  });

  return (
    <PortalShell title="Administrator portal" subtitle="School-wide activity at a glance.">
      <div className="mb-6 flex flex-wrap gap-2">
        <Link to="/admin/schools">
          <Button variant="outline" size="sm">
            <School className="h-4 w-4 mr-2" /> Schools
          </Button>
        </Link>
        <Link to="/admin/academic-years">
          <Button variant="outline" size="sm">
            <Layers className="h-4 w-4 mr-2" /> Academic years
          </Button>
        </Link>
        <Link to="/admin/users">
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4 mr-2" /> Manage users
          </Button>
        </Link>
        <Link to="/admin/news">
          <Button variant="outline" size="sm">
            <Newspaper className="h-4 w-4 mr-2" /> School news & events
          </Button>
        </Link>
        <Link to="/admin/fees">
          <Button variant="outline" size="sm">
            <Wallet className="h-4 w-4 mr-2" /> Manage fees
          </Button>
        </Link>
        <Link to="/admin/audit">
          <Button variant="outline" size="sm">
            <ScrollText className="h-4 w-4 mr-2" /> Notification audit
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat icon={School} label="Schools" value={isLoading ? "—" : String(stats?.schools ?? 0)} />
        <Stat icon={Layers} label="Academic years" value={isLoading ? "—" : String(stats?.academicYears ?? 0)} />
        <Stat icon={Users} label="Total users" value={isLoading ? "—" : String(stats?.users ?? 0)} />
        <Stat icon={BookOpen} label="Active classes" value={isLoading ? "—" : String(stats?.classes ?? 0)} />
        <Stat icon={GraduationCap} label="Enrollments" value={isLoading ? "—" : String(stats?.enrollments ?? 0)} />
        <Stat icon={FileText} label="Assignments" value={isLoading ? "—" : String(stats?.assignments ?? 0)} />
        <Stat icon={Megaphone} label="Announcements" value={isLoading ? "—" : String(stats?.announcements ?? 0)} />
        <Stat icon={CalendarClock} label="Events" value={isLoading ? "—" : String(stats?.events ?? 0)} />
        <Stat icon={Wallet} label="Outstanding fees" value={isLoading ? "—" : String(stats?.outstandingFees ?? 0)} color="text-destructive" />
      </div>

      <div className="grid gap-6 mt-8 lg:grid-cols-3">
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Users by role</h2>
          <ul className="space-y-2 text-sm">
            {(["student", "teacher", "parent", "admin"] as const).map((r) => (
              <li key={r} className="flex justify-between border-b pb-2 last:border-0">
                <span className="capitalize">{r}</span>
                <span className="font-medium">{stats?.byRole?.[r] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Recent users</h2>
          {recentUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {recentUsers.map((u) => (
                <li key={u.id} className="py-2 flex justify-between">
                  <span>{u.full_name || "Unnamed"}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Upcoming events</h2>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming events.</p>
          ) : (
            <ul className="divide-y text-sm">
              {upcomingEvents.map((e) => (
                <li key={e.id} className="py-2 flex justify-between">
                  <div>
                    <div className="font-medium">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{e.event_type}</div>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {new Date(e.start_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-6 mt-6">
        <h2 className="font-semibold mb-4">Recent classes</h2>
        {recentClasses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No classes yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {recentClasses.map((c) => (
              <li key={c.id} className="py-2 flex justify-between">
                <div>
                  <div className="font-medium">{c.name}</div>
                  {c.subject && <div className="text-muted-foreground text-xs">{c.subject}</div>}
                </div>
                <span className="text-muted-foreground text-xs">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PortalShell>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color?: string }) {
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
