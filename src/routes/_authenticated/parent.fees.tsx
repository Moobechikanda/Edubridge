import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/parent/fees")({
  component: ParentFees,
});

function ParentFees() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["parent-fees", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: links, error: linkError } = await supabase
        .from("parent_links")
        .select("student_id")
        .eq("parent_id", user!.id);
      if (linkError) throw linkError;

      const studentIds = (links ?? []).map((l) => l.student_id);
      if (studentIds.length === 0) return { students: [], fees: [] as any[] };

      const [{ data: students, error: studentError }, { data: fees, error: feeError }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", studentIds),
        supabase
          .from("student_fees")
          .select("*")
          .in("student_id", studentIds)
          .order("due_date", { ascending: true }),
      ]);
      if (studentError) throw studentError;
      if (feeError) throw feeError;

      return { students: students ?? [], fees: fees ?? [] };
    },
  });

  const nameMap = new Map((data?.students ?? []).map((s) => [s.id, s.full_name || "Student"]));
  const grouped = new Map<string, any[]>();
  for (const fee of data?.fees ?? []) {
    const list = grouped.get(fee.student_id) ?? [];
    list.push(fee);
    grouped.set(fee.student_id, list);
  }

  const outstandingTotal = (data?.fees ?? [])
    .filter((f) => f.status !== "paid" && f.status !== "waived")
    .reduce((sum, f) => sum + (Number(f.amount) - Number(f.amount_paid)), 0);

  return (
    <PortalShell title="Fees" subtitle="Track outstanding and upcoming fee items for your linked children.">
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Linked children</div>
          <div className="text-2xl font-semibold mt-1">{data?.students.length ?? 0}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Fee items</div>
          <div className="text-2xl font-semibold mt-1">{data?.fees.length ?? 0}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Outstanding total</div>
          <div className="text-2xl font-semibold mt-1">ZMW {Math.max(outstandingTotal, 0).toFixed(2)}</div>
        </Card>
      </div>

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Loading fees...</Card>
      ) : grouped.size === 0 ? (
        <Card className="p-8 text-sm text-muted-foreground">No fee records found yet.</Card>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([studentId, fees]) => {
            const studentOutstanding = fees
              .filter((f) => f.status !== "paid" && f.status !== "waived")
              .reduce((sum, f) => sum + (Number(f.amount) - Number(f.amount_paid)), 0);

            return (
              <Card key={studentId} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">{nameMap.get(studentId) || "Student"}</h2>
                  <div className="text-sm font-medium">
                    Outstanding: ZMW {Math.max(studentOutstanding, 0).toFixed(2)}
                  </div>
                </div>

                <ul className="divide-y">
                  {fees.map((f) => {
                    const remaining = Math.max(Number(f.amount) - Number(f.amount_paid), 0);
                    return (
                      <li key={f.id} className="py-3">
                        <div className="font-medium">{f.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Due {new Date(f.due_date).toLocaleDateString()} · {f.status.replace("_", " ")}
                        </div>
                        <div className="text-sm mt-1">
                          {f.currency} {Number(f.amount).toFixed(2)} · Paid {f.currency} {Number(f.amount_paid).toFixed(2)} · Remaining {f.currency} {remaining.toFixed(2)}
                        </div>
                        {f.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{f.description}</p>}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </PortalShell>
  );
}
