import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth, dashboardPathFor } from "@/lib/auth";
import { GraduationCap, MessagesSquare, LineChart, Users, ShieldCheck, BookOpen } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session && role) {
      navigate({ to: dashboardPathFor(role) });
    }
  }, [loading, session, role, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            EduBridge
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
            <Link to="/auth" search={{ mode: "signup" }}><Button>Get started</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{ background: "var(--gradient-soft)" }}
      >
        <div className="container mx-auto px-4 py-20 md:py-28 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Built for modern schools
          </span>
          <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight text-foreground">
            One platform for the<br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--gradient-hero)" }}
            >
              entire school community
            </span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground">
            EduBridge connects teachers, students, parents and administrators —
            unifying communication, classroom management and progress tracking in one place.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button size="lg" className="shadow-lg">Create your account</Button>
            </Link>
            <Link to="/auth"><Button size="lg" variant="outline">I already have an account</Button></Link>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">A portal for every role</h2>
          <p className="mt-3 text-muted-foreground">
            Tailored experiences that put the right tools in the right hands.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: BookOpen, title: "Teachers", desc: "Manage classes, assignments and feedback." },
            { icon: GraduationCap, title: "Students", desc: "Access materials and track learning progress." },
            { icon: Users, title: "Parents", desc: "Stay informed about your child's school life." },
            { icon: ShieldCheck, title: "Admins", desc: "Oversee communication and school analytics." },
          ].map((r) => (
            <Card key={r.title} className="p-6 hover:shadow-lg transition-shadow" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-accent text-accent-foreground">
                <r.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">{r.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-secondary/40">
        <div className="container mx-auto px-4 py-20">
          <div className="grid gap-10 md:grid-cols-3">
            {[
              { icon: MessagesSquare, title: "Unified messaging", desc: "Announcements and direct messages between every stakeholder." },
              { icon: LineChart, title: "Progress tracking", desc: "Real-time visibility into assignments, grades and attendance." },
              { icon: ShieldCheck, title: "Secure by design", desc: "Role-based access keeps student data private and protected." },
            ].map((f) => (
              <div key={f.title}>
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-lg">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="container mx-auto px-4 py-8 text-sm text-muted-foreground flex justify-between">
          <span>© {new Date().getFullYear()} EduBridge</span>
          <span>University of Zambia</span>
        </div>
      </footer>
    </div>
  );
}
