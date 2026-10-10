import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Tv } from "lucide-react";
import { PageHeader, DemoBadge, Initials } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { leagueQuery, type Period } from "@/lib/data";

export const Route = createFileRoute("/leagues/")({
  head: () => ({
    meta: [
      { title: "College Leagues — AptiQuiz" },
      { name: "description", content: "College rankings built from each college's top five match scores." },
      { property: "og:title", content: "AptiQuiz College Leagues" },
      { property: "og:description", content: "Which college leads the aptitude league?" },
    ],
  }),
  component: Leagues,
});

function Leagues() {
  const [period, setPeriod] = useState<Period>("all");
  const q = useQuery(leagueQuery(period));
  const max = q.data?.standings[0]?.points || 1;
  return (
    <div className="space-y-6">
      <PageHeader title="College Leagues" subtitle="Policy: a college's points = sum of its top 5 individual scores from completed matches in the period." actions={<Button variant="glass" asChild><Link to="/spectate"><Tv /> Spectator mode</Link></Button>} />
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "30d", "7d"] as const).map((p) => <Button key={p} size="sm" variant={period === p ? "default" : "glass"} onClick={() => setPeriod(p)}>{p === "all" ? "All time" : p === "30d" ? "Last 30 days" : "This week"}</Button>)}
        {q.data?.standings.some((s) => s.hasDemo) && <DemoBadge />}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass p-5">
          <h2 className="mb-4 font-semibold">College rankings</h2>
          {q.isLoading ? <div className="h-64 animate-pulse rounded-xl bg-surface/60" /> : (
            <ol className="space-y-3">
              {q.data?.standings.map((s, i) => (
                <li key={s.college.id}>
                  <Link to="/leagues/$collegeId" params={{ collegeId: s.college.id }} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-xl p-2 hover:bg-surface/60">
                    <span className={`tabular font-display text-lg font-bold ${["text-gold", "text-silver", "text-bronze"][i] ?? "text-muted-foreground"}`}>{i + 1}</span>
                    <div>
                      <div className="font-medium">{s.college.name}</div>
                      <div className="text-xs text-muted-foreground">{s.players} players · {s.entries} match entries</div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-gradient-primary" style={{ width: `${(s.points / max) * 100}%` }} /></div>
                    </div>
                    <span className="tabular font-display text-lg font-bold">{s.points.toLocaleString()}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="glass p-5">
          <h2 className="mb-4 font-semibold">Top individuals</h2>
          {!q.data?.players.length ? <p className="text-sm text-muted-foreground">No completed matches in this period.</p> : (
            <ol className="space-y-2 text-sm">
              {q.data.players.slice(0, 12).map((p, i) => (
                <li key={p.id} className="flex items-center gap-3"><span className="tabular w-5 text-muted-foreground">{i + 1}</span><Initials name={p.display_name} className="size-7" /><span className="flex-1 truncate">{p.display_name}</span><span className="tabular font-semibold">{p.score.toLocaleString()}</span></li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
