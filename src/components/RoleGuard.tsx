import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, dashboardPathFor, type AppRole } from "@/lib/auth";

export function RoleGuard({
  allow,
  children,
}: {
  allow: AppRole[];
  children: ReactNode;
}) {
  const { role, loading } = useAuth();
  if (loading) {
    return (
      <div className="container mx-auto py-16 text-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!role || !allow.includes(role)) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive mb-4">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Access denied</h1>
        <p className="text-muted-foreground mb-6">
          You don't have permission to view this area.
          {role ? ` Your account is signed in as ${role}.` : ""}
        </p>
        <Link to={dashboardPathFor(role)}>
          <Button>Go to your dashboard</Button>
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
