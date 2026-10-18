import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { dashboardPathFor, useAuth, type AppRole } from "@/lib/auth";

const REMEMBER_SESSION_KEY = "edubridge:remember-session";

const portalDetails: Record<AppRole, { title: string; description: string }> = {
  student: {
    title: "Student portal",
    description: "Sign in to view your classes, assignments, and academic progress.",
  },
  parent: {
    title: "Parent portal",
    description: "Sign in to follow your child's learning and connect with teachers.",
  },
  teacher: {
    title: "Teacher portal",
    description: "Sign in to manage classes, assignments, and school communication.",
  },
  admin: {
    title: "Administrator sign in",
    description: "Sign in to manage accounts, announcements, events, and school settings.",
  },
};

export function PortalSignIn({ expectedRole }: { expectedRole: AppRole }) {
  const { session, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [assignedRole, setAssignedRole] = useState<AppRole | null>(null);
  const details = portalDetails[expectedRole];

  useEffect(() => {
    const savedPreference = window.localStorage.getItem(REMEMBER_SESSION_KEY);
    if (savedPreference !== null) setRememberMe(savedPreference !== "false");
  }, []);

  useEffect(() => {
    if (!busy && !loading && session && role === expectedRole) {
      navigate({ to: dashboardPathFor(expectedRole) });
    }
  }, [busy, expectedRole, loading, session, role, navigate]);

  async function onSwitchAccount() {
    try {
      await signOut();
      toast.success("Signed out. You can now use another account.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign out.");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    window.localStorage.setItem(REMEMBER_SESSION_KEY, String(rememberMe));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }

      setAssignedRole(null);
      const { data: roleRecord, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (roleError) throw roleError;
      if (roleRecord?.role !== expectedRole) {
        if (roleRecord?.role) {
          setAssignedRole(roleRecord.role);
          toast.error(`This account is assigned to the ${roleRecord.role} portal.`);
        } else {
          await supabase.auth.signOut();
          toast.error(
            "This account has no assigned portal. Please contact your school administrator.",
          );
        }
        return;
      }

      setAssignedRole(null);
      toast.success("Welcome back!");
      await navigate({ to: dashboardPathFor(expectedRole) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onForgotPassword() {
    const address = email.trim();
    if (!address) {
      toast.error("Enter your email address first.");
      return;
    }

    setResetBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) toast.error(error.message);
      else toast.success("If an account exists for that email, a reset link is on its way.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to request a reset link. Please try again.",
      );
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <main className="edu-login-page edu-portal-signin">
      <section className="edu-login-top">
        <div className="edu-campus-panel">
          <div className="edu-campus-image" aria-hidden="true" />
          <div className="edu-campus-overlay" aria-hidden="true" />
          <div className="edu-campus-content">
            <Link className="edu-brand" to="/" aria-label="EduBridge home">
              <span className="edu-brand-icon">
                <span aria-hidden="true">E</span>
              </span>
              <span>EduBridge</span>
            </Link>
            <div className="edu-campus-copy">
              <p className="edu-tagline">Connecting students, parents, teachers and departments.</p>
              <h1>{details.title}</h1>
              <p className="edu-campus-description">{details.description}</p>
            </div>
          </div>
        </div>

        <div className="edu-login-panel">
          <section className="edu-login-card" aria-labelledby="portal-login-heading">
            <Link className="edu-portal-back" to="/">
              <ArrowLeft aria-hidden="true" /> All portals
            </Link>
            {session && role && role !== expectedRole && (
              <div className="edu-session-notice" role="status">
                <p>
                  You are currently signed in as a <strong>{role}</strong>. Sign out first to switch
                  accounts, or enter credentials for a {expectedRole} account below.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={onSwitchAccount}>
                  Sign out of current account
                </Button>
              </div>
            )}
            <h2 id="portal-login-heading">Welcome Back</h2>
            <p className="edu-login-subtitle">{details.description}</p>

            {assignedRole && (
              <div className="edu-session-notice" role="alert">
                <p>
                  These credentials are assigned to the <strong>{assignedRole}</strong> portal, not
                  the {expectedRole} portal. Use the assigned portal to continue, or contact your
                  administrator if this role is incorrect.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate({ to: dashboardPathFor(assignedRole) })}
                >
                  Continue to {assignedRole} portal
                </Button>
              </div>
            )}

            <form className="edu-login-form" onSubmit={onSubmit}>
              <label className="edu-field-label" htmlFor="portal-login-email">
                Email address
              </label>
              <div className="edu-input-wrap">
                <Mail className="edu-input-icon" aria-hidden="true" />
                <input
                  id="portal-login-email"
                  className="edu-login-input"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="edu-password-heading">
                <label className="edu-field-label" htmlFor="portal-login-password">
                  Password
                </label>
                <button
                  className="edu-forgot-link"
                  type="button"
                  onClick={onForgotPassword}
                  disabled={resetBusy}
                >
                  {resetBusy ? "Sending…" : "Forgot password?"}
                </button>
              </div>
              <div className="edu-input-wrap">
                <LockKeyhole className="edu-input-icon" aria-hidden="true" />
                <input
                  id="portal-login-password"
                  className="edu-login-input edu-password-input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  className="edu-password-toggle"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>

              <div className="edu-login-options">
                <label className="edu-remember-label" htmlFor="portal-remember-me">
                  <input
                    id="portal-remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
              </div>

              <Button className="edu-sign-in-button" type="submit" disabled={busy}>
                {busy ? (
                  "Signing in…"
                ) : (
                  <>
                    Sign In <ArrowRight aria-hidden="true" />
                  </>
                )}
              </Button>
            </form>

            <div className="edu-account-note">
              <p>Accounts are created by your school administrator.</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
