import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, dashboardPathFor } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, role, loading } = useAuth();

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
          <Link to="/" className="flex items-center gap-2 font-semibold text-lg mb-6">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            EduBridge
          </Link>
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Accounts are created by the school administrator.
          </p>

          <Tabs defaultValue="password" className="mt-6">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="student">Student ID</TabsTrigger>
              <TabsTrigger value="code">Code</TabsTrigger>
            </TabsList>

            <TabsContent value="password" className="pt-4">
              <PasswordSignIn />
            </TabsContent>
            <TabsContent value="student" className="pt-4">
              <StudentIdSignIn />
            </TabsContent>
            <TabsContent value="code" className="pt-4">
              <CodeSignIn />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

function PasswordSignIn() {
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

function StudentIdSignIn() {
  const [studentId, setStudentId] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", studentId.trim())
      .maybeSingle();
    setBusy(false);
    if (!data) {
      toast.error("Student not found. Check your student ID.");
      return;
    }
    toast.success(`Welcome, ${data.full_name || "Student"}!`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="si-id">Student ID</Label>
        <Input
          id="si-id"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="Enter your student ID"
          required
        />
        <p className="text-xs text-muted-foreground">Your student ID is linked to your account.</p>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Looking up…" : "Continue"}</Button>
    </form>
  );
}

function CodeSignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Login code sent to your email.");
      setSent(true);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await (supabase.auth as any).signInWithOtp({ token: code.trim() });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Welcome back!");
  }

  if (!sent) {
    return (
      <form onSubmit={sendCode} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ci-email">Email</Label>
          <Input
            id="ci-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="parent@school.com"
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Sending…" : "Send login code"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ci-code">Login code</Label>
        <Input
          id="ci-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter the 6-digit code"
          required
          maxLength={10}
        />
        <p className="text-xs text-muted-foreground">Check your email inbox for the code.</p>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Verifying…" : "Verify and sign in"}
      </Button>
    </form>
  );
}
