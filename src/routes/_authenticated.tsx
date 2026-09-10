import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth, dashboardPathFor, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, MessageSquare, Newspaper, Settings } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading, role, signOut, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  const roleLabel: Record<AppRole, string> = {
    student: "Student", teacher: "Teacher", parent: "Parent", admin: "Administrator",
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to={role ? dashboardPathFor(role) : "/"} className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            EduBridge
            {role && (
              <span className="ml-2 hidden sm:inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground">
                {roleLabel[role]}
              </span>
            )}
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/news">
              <Button variant="ghost" size="sm">
                <Newspaper className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">News</span>
              </Button>
            </Link>
            <Link to="/messages">
              <Button variant="ghost" size="sm">
                <MessageSquare className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Messages</span>
              </Button>
            </Link>
            <NotificationBell />
            <Link to="/settings/notifications">
              <Button variant="ghost" size="sm" aria-label="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <span className="hidden md:block text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export function PortalShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
