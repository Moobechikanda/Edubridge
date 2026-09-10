import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { BookOpen, ClipboardList, LayoutDashboard, CalendarClock, Megaphone, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleGuard } from "@/components/RoleGuard";

export const Route = createFileRoute("/_authenticated/teacher")({
  component: TeacherLayout,
});

function TeacherLayout() {
  const { pathname } = useLocation();
  const tabs = [
    { to: "/teacher", label: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/teacher/classes", label: "Classes", icon: BookOpen, exact: false },
    { to: "/teacher/assessments", label: "Assessments", icon: ClipboardList, exact: false },
    { to: "/teacher/meetings", label: "Meetings", icon: CalendarClock, exact: false },
    { to: "/teacher/announcements", label: "Announcements", icon: Megaphone, exact: false },
    { to: "/teacher/events", label: "Events", icon: CalendarDays, exact: false },
  ];
  return (
    <RoleGuard allow={["teacher"]}>
      <div>
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 flex gap-1 overflow-x-auto">
            {tabs.map((t) => {
              const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <t.icon className="h-4 w-4" /> {t.label}
                </Link>
              );
            })}
          </div>
        </div>
        <Outlet />
      </div>
    </RoleGuard>
  );
}
