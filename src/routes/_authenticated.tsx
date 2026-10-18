import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Home, LogOut, MessageSquare, Newspaper, Settings } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading, role, signOut, user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>
    );
  }

  const roleLabel: Record<AppRole, string> = {
    student: "Student",
    teacher: "Teacher",
    parent: "Parent",
    admin: "Administrator",
  };
  const homePath =
    role === "teacher"
      ? "/teacher"
      : role === "parent"
        ? "/parent"
        : role === "admin"
          ? "/admin"
          : "/student";
  const lastSegment = pathname.split("/").filter(Boolean).at(-1);
  const pageTitle =
    pathname === homePath || pathname === `${homePath}/`
      ? `${role ? roleLabel[role] : "School"} portal`
      : pathname.includes("/parent/children/")
        ? "Student profile"
        : lastSegment
          ? lastSegment.replace(/[._-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
          : "Home";

  return (
    <div className="portal-app min-h-screen flex flex-col bg-background">
      <header className="portal-header border-b bg-blue-800 text-white">
        <div className="container mx-auto flex min-h-14 items-center justify-between gap-3 px-4 py-2">
          <h1 className="min-w-0 truncate text-base font-semibold sm:text-lg">{pageTitle}</h1>
          <div className="flex items-center gap-2">
            <Link to="/news" className="hidden sm:block">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 hover:text-white"
              >
                <Newspaper className="h-4 w-4 sm:mr-2" />
                News
              </Button>
            </Link>
            <span className="hidden max-w-56 truncate text-sm text-blue-100 md:block">
              {user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={signOut}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="portal-main flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
      <nav aria-label="Primary navigation" className="portal-mobile-nav md:hidden">
        <Link
          to={homePath}
          className={
            pathname.startsWith(homePath)
              ? "portal-mobile-nav-link is-active"
              : "portal-mobile-nav-link"
          }
          aria-current={pathname.startsWith(homePath) ? "page" : undefined}
        >
          <Home aria-hidden="true" />
          <span>Home</span>
        </Link>
        <div className="portal-mobile-nav-link portal-mobile-alerts">
          <NotificationBell />
          <span>Notifications</span>
        </div>
        <Link
          to="/messages"
          className={
            pathname.startsWith("/messages")
              ? "portal-mobile-nav-link is-active"
              : "portal-mobile-nav-link"
          }
          aria-current={pathname.startsWith("/messages") ? "page" : undefined}
        >
          <MessageSquare aria-hidden="true" />
          <span>Messages</span>
        </Link>
        <Link
          to="/settings/notifications"
          className={
            pathname.startsWith("/settings")
              ? "portal-mobile-nav-link is-active"
              : "portal-mobile-nav-link"
          }
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
        >
          <Settings aria-hidden="true" />
          <span>Settings</span>
        </Link>
      </nav>
    </div>
  );
}

export function PortalShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="mb-5">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        <p className="text-muted-foreground mt-1">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
