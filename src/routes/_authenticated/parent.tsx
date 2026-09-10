import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { RoleGuard } from "@/components/RoleGuard";

export const Route = createFileRoute("/_authenticated/parent")({
  component: ParentLayout,
});

function ParentLayout() {
  const { pathname } = useLocation();
  const tabs = [
    { to: "/parent", label: "Overview" },
    { to: "/parent/children", label: "Children" },
    { to: "/parent/fees", label: "Fees" },
    { to: "/parent/announcements", label: "Announcements" },
  ];
  return (
    <RoleGuard allow={["parent"]}>
      <div>
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 flex gap-1">
            {tabs.map((t) => {
              const active = pathname === t.to || (t.to !== "/parent" && pathname.startsWith(t.to));
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
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
