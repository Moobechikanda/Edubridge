import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { dashboardPathFor, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { session, role, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      toast.error("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("Your password has been updated.");
      await navigate({ to: role ? dashboardPathFor(role) : "/" });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update your password. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="edu-login-page">
      <section className="edu-login-panel" style={{ flex: 1 }}>
        <section className="edu-login-card" aria-labelledby="reset-password-heading">
          <Link className="edu-portal-back" to="/">
            <ArrowLeft aria-hidden="true" /> Back to sign in
          </Link>
          <h2 id="reset-password-heading">Set a new password</h2>
          <p className="edu-login-subtitle">Choose a new password for your EduBridge account.</p>

          {loading ? (
            <p role="status">Verifying your recovery link…</p>
          ) : !session ? (
            <div className="edu-session-notice" role="alert">
              <p>
                This recovery link is invalid or has expired. Request a new one from the sign-in
                page.
              </p>
              <Link to="/">Return to sign in</Link>
            </div>
          ) : (
            <form className="edu-login-form" onSubmit={onSubmit}>
              <label className="edu-field-label" htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                className="edu-login-input"
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />

              <label className="edu-field-label" htmlFor="confirm-password">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                className="edu-login-input"
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />

              <Button className="edu-sign-in-button" type="submit" disabled={busy}>
                {busy ? "Updating password…" : "Update password"}
              </Button>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}
