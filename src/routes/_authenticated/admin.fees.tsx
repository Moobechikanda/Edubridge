import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PortalShell } from "../_authenticated";
import { RoleGuard } from "@/components/RoleGuard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/fees")({
  component: () => (
    <RoleGuard allow={["admin"]}>
      <AdminFeesPage />
    </RoleGuard>
  ),
});

type StudentOption = { id: string; full_name: string | null };

function AdminFeesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0");
  const [currency, setCurrency] = useState("ZMW");
  const [dueDate, setDueDate] = useState("");

  const { data: students = [] } = useQuery({
    queryKey: ["fee-students"],
    queryFn: async () => {
      const [{ data: roles, error: rolesError }, { data: profiles, error: profileError }] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("role", "student"),
        supabase.from("profiles").select("id, full_name"),
      ]);
      if (rolesError) throw rolesError;
      if (profileError) throw profileError;
      const studentIds = new Set((roles ?? []).map((r) => r.user_id));
      return (profiles ?? []).filter((p) => studentIds.has(p.id)) as StudentOption[];
    },
  });

  const { data: feeRows = [] } = useQuery({
    queryKey: ["admin-student-fees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_fees")
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const studentNameById = useMemo(
    () => new Map(students.map((s) => [s.id, s.full_name ?? "Student"])),
    [students],
  );

  const createFee = useMutation({
    mutationFn: async () => {
      if (!studentId) throw new Error("Choose a student");
      if (!title.trim()) throw new Error("Title is required");
      if (!dueDate) throw new Error("Due date is required");
      const parsedAmount = Number(amount);
      if (Number.isNaN(parsedAmount) || parsedAmount < 0) throw new Error("Amount must be valid");

      const { error } = await supabase.from("student_fees").insert({
        student_id: studentId,
        title: title.trim(),
        description: description.trim() || null,
        amount: parsedAmount,
        amount_paid: 0,
        currency: currency.trim() || "ZMW",
        due_date: dueDate,
        status: "outstanding",
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fee item created");
      setTitle("");
      setDescription("");
      setAmount("0");
      setDueDate("");
      qc.invalidateQueries({ queryKey: ["admin-student-fees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateFee = useMutation({
    mutationFn: async ({ id, status, amountPaid }: { id: string; status: string; amountPaid: number }) => {
      const { error } = await supabase
        .from("student_fees")
        .update({ status, amount_paid: amountPaid })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fee updated");
      qc.invalidateQueries({ queryKey: ["admin-student-fees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeFee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("student_fees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fee deleted");
      qc.invalidateQueries({ queryKey: ["admin-student-fees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PortalShell title="Student fees" subtitle="Track, update and clear fee balances per student.">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="p-5 space-y-3 h-fit">
          <h2 className="font-semibold">Create fee item</h2>
          <div className="space-y-1">
            <Label>Student</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name || "Student"}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tuition term 3" />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Payment instructions, bank details..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={8} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <Button onClick={() => createFee.mutate()} disabled={createFee.isPending}>
            {createFee.isPending ? "Saving..." : "Create fee"}
          </Button>
        </Card>

        <div className="space-y-3">
          {feeRows.length === 0 ? (
            <Card className="p-8 text-sm text-muted-foreground">No fee records yet.</Card>
          ) : (
            feeRows.map((f) => {
              const remaining = Number(f.amount) - Number(f.amount_paid);
              return (
                <FeeRow
                  key={f.id}
                  id={f.id}
                  student={studentNameById.get(f.student_id) || "Student"}
                  title={f.title}
                  description={f.description}
                  amount={Number(f.amount)}
                  amountPaid={Number(f.amount_paid)}
                  currency={f.currency}
                  dueDate={f.due_date}
                  status={f.status}
                  remaining={remaining}
                  onUpdate={(status, amountPaid) => updateFee.mutate({ id: f.id, status, amountPaid })}
                  onDelete={() => removeFee.mutate(f.id)}
                />
              );
            })
          )}
        </div>
      </div>
    </PortalShell>
  );
}

function FeeRow({
  id,
  student,
  title,
  description,
  amount,
  amountPaid,
  currency,
  dueDate,
  status,
  remaining,
  onUpdate,
  onDelete,
}: {
  id: string;
  student: string;
  title: string;
  description: string | null;
  amount: number;
  amountPaid: number;
  currency: string;
  dueDate: string;
  status: string;
  remaining: number;
  onUpdate: (status: string, amountPaid: number) => void;
  onDelete: () => void;
}) {
  const [localStatus, setLocalStatus] = useState(status);
  const [localPaid, setLocalPaid] = useState(amountPaid.toString());

  return (
    <Card className="p-4" key={id}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{student} · due {new Date(dueDate).toLocaleDateString()}</div>
          <div className="text-sm mt-2">
            {currency} {amount.toFixed(2)} · Paid {currency} {amountPaid.toFixed(2)} · Remaining {currency} {Math.max(remaining, 0).toFixed(2)}
          </div>
          {description && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{description}</p>}

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-[180px_160px_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Status</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={localStatus}
                onChange={(e) => setLocalStatus(e.target.value)}
              >
                <option value="outstanding">Outstanding</option>
                <option value="partially_paid">Partially paid</option>
                <option value="paid">Paid</option>
                <option value="waived">Waived</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Amount paid</Label>
              <Input type="number" min={0} value={localPaid} onChange={(e) => setLocalPaid(e.target.value)} />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                const parsed = Number(localPaid);
                if (Number.isNaN(parsed) || parsed < 0 || parsed > amount) {
                  toast.error("Amount paid must be between 0 and total amount");
                  return;
                }
                onUpdate(localStatus, parsed);
              }}
            >
              Save changes
            </Button>
          </div>
        </div>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            if (confirm("Delete this fee item?")) onDelete();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
