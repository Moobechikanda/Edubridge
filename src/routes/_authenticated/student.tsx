import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { BookOpen, ClipboardList, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleGuard } from "@/components/RoleGuard";

export const Route = createFileRoute("/_authenticated/student")({
  component: StudentLayout,
});

function StudentLayout() {
  const { pathname } = useLocation();
  const tabs = [
    { to: "/student", label: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/student/classes", label: "Classes", icon: BookOpen, exact: false },
    { to: "/student/assignments", label: "Assignments", icon: ClipboardList, exact: false },
  ];
  return (
    <RoleGuard allow={["student"]}>
      <div>
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 flex gap-1">
            {tabs.map((t) => {
              const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
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
