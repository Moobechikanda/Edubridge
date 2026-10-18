import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  Mail,
  Presentation,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { dashboardPathFor } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

const REMEMBER_SESSION_KEY = "edubridge:remember-session";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    const savedPreference = window.localStorage.getItem(REMEMBER_SESSION_KEY);
    if (savedPreference !== null) setRememberMe(savedPreference !== "false");
  }, []);

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

      const { data: roleRecord, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (roleError) throw roleError;
      if (!roleRecord) {
        toast.error(
          "This account has no assigned portal. Please contact your school administrator.",
        );
        await supabase.auth.signOut();
        return;
      }

      toast.success("Welcome back!");
      await navigate({ to: dashboardPathFor(roleRecord.role) });
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
    <main className="edu-login-page">
      <section className="edu-login-top">
        <div className="edu-campus-panel">
          <div className="edu-campus-image" aria-hidden="true" />
          <div className="edu-campus-overlay" aria-hidden="true" />
          <div className="edu-campus-content">
            <Link className="edu-brand" to="/" aria-label="EduBridge home">
              <span className="edu-brand-icon">
                <GraduationCap aria-hidden="true" />
              </span>
              <span>EduBridge</span>
            </Link>
            <div className="edu-campus-copy">
              <p className="edu-tagline">Connecting students, parents, teachers and departments.</p>
              <h1>
                Better Communication.
                <br />
                Brighter Futures.
              </h1>
              <p className="edu-campus-description">
                EduBridge connects the school community through accessible academic information,
                timely communication and improved student progress monitoring.
              </p>
            </div>
          </div>
        </div>

        <div className="edu-login-panel">
          <section className="edu-login-card" aria-labelledby="login-heading">
            <h2 id="login-heading">Welcome Back</h2>
            <p className="edu-login-subtitle">
              Log in to your EduBridge account to access your dashboard.
            </p>

            <form className="edu-login-form" onSubmit={onSubmit}>
              <label className="edu-field-label" htmlFor="login-email">
                Email address
              </label>
              <div className="edu-input-wrap">
                <Mail className="edu-input-icon" aria-hidden="true" />
                <input
                  id="login-email"
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
                <label className="edu-field-label" htmlFor="login-password">
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
                  id="login-password"
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
                <label className="edu-remember-label" htmlFor="remember-me">
                  <input
                    id="remember-me"
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
              <p>Have an account? Sign in through your role portal.</p>
            </div>
            <nav className="edu-portal-links" aria-label="Choose your sign-in portal">
              <Link to="/login/$role" params={{ role: "student" }}>
                Student portal
              </Link>
              <Link to="/login/$role" params={{ role: "parent" }}>
                Parent portal
              </Link>
              <Link to="/login/$role" params={{ role: "teacher" }}>
                Teacher portal
              </Link>
            </nav>
          </section>
        </div>
      </section>

      <section className="edu-role-section" aria-label="EduBridge roles">
        <div className="edu-role-grid">
          <RoleFeature
            icon={GraduationCap}
            tone="student"
            title="Students"
            description="View subjects, assignments, attendance and academic results."
          />
          <RoleFeature
            icon={Users}
            tone="parent"
            title="Parents"
            description="Monitor your child's academic progress, attendance and school announcements."
          />
          <RoleFeature
            icon={Presentation}
            tone="teacher"
            title="Teachers & Lecturers"
            description="Record attendance, manage student results and share important announcements."
          />
          <RoleFeature
            icon={Building2}
            tone="department"
            title="Departments"
            description="Manage academic records, coordinate communication and publish departmental updates."
          />
        </div>
      </section>

      <footer className="edu-login-footer">
        EDUCATION <span>|</span> COMMUNICATION <span>|</span> PROGRESS
      </footer>
    </main>
  );
}

function RoleFeature({
  icon: Icon,
  tone,
  title,
  description,
}: {
  icon: LucideIcon;
  tone: "student" | "parent" | "teacher" | "department";
  title: string;
  description: string;
}) {
  return (
    <article className="edu-role-feature">
      <span className={`edu-role-icon edu-role-icon-${tone}`}>
        <Icon aria-hidden="true" />
      </span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </article>
  );
}
