import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PortalShell } from "../_authenticated";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Trophy, Medal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rankings/$classId")({
  component: Rankings,
});

function Rankings() {
  const { classId } = Route.useParams();
  const { user } = useAuth();

  const { data: cls } = useQuery({
    queryKey: ["class-name", classId],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("name, subject").eq("id", classId).maybeSingle();
      return data;
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["class-rankings", classId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_class_rankings", { _class_id: classId });
      if (error) throw error;
      return data ?? [];
    },
  });

  const medalFor = (rank: number) => {
    if (rank === 1) return "text-yellow-500";
    if (rank === 2) return "text-slate-400";
    if (rank === 3) return "text-amber-700";
    return "text-muted-foreground";
  };

  return (
    <PortalShell title={cls?.name ? `Rankings — ${cls.name}` : "Class rankings"} subtitle="Full leaderboard based on graded work.">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/news"><ArrowLeft className="h-4 w-4" /> Back to news</Link>
      </Button>
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Trophy className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No graded work yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Student</TableHead>
                <TableHead className="text-right">Graded</TableHead>
                <TableHead className="text-right">Total points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const isMe = r.student_id === user?.id;
                return (
                  <TableRow key={r.student_id} className={isMe ? "bg-primary/5" : ""}>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 font-semibold ${medalFor(Number(r.rank))}`}>
                        {Number(r.rank) <= 3 && <Medal className="h-4 w-4" />} #{r.rank}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {r.full_name || "—"} {isMe && <span className="text-xs text-primary ml-1">(you)</span>}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.graded_count}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(r.total_points).toFixed(1)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </PortalShell>
  );
}
