import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PortalSignIn } from "@/components/PortalSignIn";
import type { AppRole } from "@/lib/auth";

const publicPortals: AppRole[] = ["student", "parent", "teacher"];

function isPublicPortal(role: string): role is Exclude<AppRole, "admin"> {
  return publicPortals.includes(role as AppRole);
}

export const Route = createFileRoute("/login/$role")({
  component: PortalLoginPage,
});

function PortalLoginPage() {
  const { role } = Route.useParams();
  const navigate = useNavigate();
  const validRole = isPublicPortal(role);

  useEffect(() => {
    if (!validRole) navigate({ to: "/" });
  }, [validRole, navigate]);

  if (!validRole) return null;
  return <PortalSignIn expectedRole={role} />;
}
