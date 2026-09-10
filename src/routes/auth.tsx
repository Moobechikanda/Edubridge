import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, dashboardPathFor, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GraduationCap, BookOpen, Users, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  component: AuthPage,
});

const roles: { value: AppRole; label: string; icon: typeof BookOpen; desc: string }[] = [
  { value: "student", label: "Student", icon: GraduationCap, desc: "Access classes & materials" },
  { value: "teacher", label: "Teacher", icon: BookOpen, desc: "Manage classroom & feedback" },
  { value: "parent", label: "Parent", icon: Users, desc: "Monitor your child's progress" },
  { value: "admin", label: "Administrator", icon: ShieldCheck, desc: "Oversee the school" },
];

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { session, role, loading } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">(mode === "signup" ? "signup" : "signin");

  useEffect(() => {
    if (!loading && session && role) navigate({ to: dashboardPathFor(role) });
  }, [loading, session, role, navigate]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div
        className="hidden lg:flex flex-col justify-between p-12 text-primary-foreground"
        style={{ background: "var(--gradient-hero)" }}
      >
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-foreground/20 backdrop-blur">
            <GraduationCap className="h-5 w-5" />
          </span>
          EduBridge
        </Link>
        <div>
          <h2 className="text-4xl font-bold leading-tight">
            Welcome to the bridge between home and school.
          </h2>
          <p className="mt-4 text-primary-foreground/80 max-w-md">
            Communication, learning and progress — connected for every member of your school community.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">© EduBridge {new Date().getFullYear()}</p>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12 bg-background">
        <Card className="w-full max-w-md p-6 md:p-8">
          <div className="lg:hidden mb-6">
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </span>
              EduBridge
            </Link>
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="pt-6">
              <SignInForm />
            </TabsContent>
            <TabsContent value="signup" className="pt-6">
              <SignUpForm />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Welcome back!");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="text-sm text-muted-foreground">Continue to your EduBridge account.</p>
      <div className="space-y-2">
        <Label htmlFor="si-email">Email</Label>
        <Input id="si-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="si-pw">Password</Label>
        <Input id="si-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}

function SignUpForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("student");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, role },
      },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Account created. Check your email to confirm.");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="text-sm text-muted-foreground">Choose your role to personalize your experience.</p>

      <div className="space-y-2">
        <Label>I am a…</Label>
        <div className="grid grid-cols-2 gap-2">
          {roles.map((r) => {
            const active = role === r.value;
            return (
              <button
                type="button"
                key={r.value}
                onClick={() => setRole(r.value)}
                className={
                  "flex items-start gap-2 rounded-lg border p-3 text-left transition-all " +
                  (active
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "hover:bg-muted/50")
                }
              >
                <r.icon className={"h-4 w-4 mt-0.5 " + (active ? "text-primary" : "text-muted-foreground")} />
                <div>
                  <div className="text-sm font-medium">{r.label}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">{r.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="su-name">Full name</Label>
        <Input id="su-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-pw">Password</Label>
        <Input id="su-pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
    </form>
  );
}
