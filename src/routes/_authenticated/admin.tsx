import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Users, Newspaper, Wallet, ScrollText, CalendarDays, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleGuard } from "@/components/RoleGuard";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { pathname } = useLocation();
  const tabs = [
    { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/admin/users", label: "Users", icon: Users, exact: false },
    { to: "/admin/classes", label: "Classes", icon: BookOpen, exact: false },
    { to: "/admin/news", label: "News & events", icon: Newspaper, exact: false },
    { to: "/admin/fees", label: "Fees", icon: Wallet, exact: false },
    { to: "/admin/audit", label: "Audit log", icon: ScrollText, exact: false },
    { to: "/admin/subjects", label: "Subjects", icon: BookOpen, exact: false },
  ];
  return (
    <RoleGuard allow={["admin"]}>
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

