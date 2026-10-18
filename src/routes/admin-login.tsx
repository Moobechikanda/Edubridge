import { createFileRoute } from "@tanstack/react-router";
import { PortalSignIn } from "@/components/PortalSignIn";

export const Route = createFileRoute("/admin-login")({
  component: () => <PortalSignIn expectedRole="admin" />,
});
