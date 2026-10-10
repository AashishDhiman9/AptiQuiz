import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Gamepad2, Target, Timer, Trophy, TrendingUp, AlertTriangle } from "lucide-react";
import { PageHeader, Stat } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { myStatsQuery } from "@/lib/stats";

export const Route = createFileRoute("/_authenticated/performance")({
  head: () => ({
    meta: [
      { title: "My Performance — AptiQuiz" },
      { name: "description", content: "Accuracy, speed, topic strengths and score history from your recorded matches." },
      { property: "og:title", content: "My Performance — AptiQuiz" },
      { property: "og:description", content: "Your aptitude analytics." },
    ],
  }),
  component: Performance,
});

function Performance() {
  const { user } = useAuth();
  const s = useQuery(myStatsQuery(user?.id));
  if (s.isLoading || !user) return <div className="grid gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface/60" />)}</div>;
  if (s.error) return <p className="text-destructive">Could not load your stats.</p>;
  const d = s.data!;
  return (
    <div className="space-y-6">
      <PageHeader title="My Performance" subtitle="Accuracy = correct ÷ answered questions (unanswered excluded). Times are server-recorded." />
      {!d.answered && (
        <div className="glass p-8 text-center"><p className="text-muted-foreground">No recorded answers yet. Play a match while signed in to see analytics.</p><Button variant="hero" className="mt-4" asChild><Link to="/play">Join a game</Link></Button></div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Gamepad2} label="Games played" value={d.games} />
        <Stat icon={Target} label="Accuracy" value={`${d.accuracy}%`} hint={`${d.correct} correct · ${d.incorrect} wrong`} />
        <Stat icon={Timer} label="Avg response" value={`${(d.avgMs / 1000).toFixed(1)}s`} hint={`${d.answered} answers`} />
        <Stat icon={Trophy} label="Total points" value={d.totalPoints.toLocaleString()} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass p-5">
          <h2 className="mb-4 font-semibold">Topic-wise performance</h2>
          <ul className="space-y-4">
            {d.byTopic.map((t) => (
              <li key={t.topic}>
                <div className="flex justify-between text-sm"><span>{t.label}</span><span className="tabular text-muted-foreground">{t.n ? `${t.acc}% · n=${t.n}` : "no data"}</span></div>
                <div className="mt-1.5 h-2 rounded-full bg-surface-2"><div className="h-full rounded-full bg-gradient-primary" style={{ width: `${t.acc}%` }} /></div>
              </li>
            ))}
          </ul>
          <h3 className="mb-2 mt-6 text-sm font-semibold">By difficulty</h3>
          <div className="grid grid-cols-3 gap-2">
            {d.byDiff.map((x) => <div key={x.difficulty} className="rounded-xl bg-surface/60 p-3 text-center"><div className="text-xs capitalize text-muted-foreground">{x.difficulty}</div><div className="tabular font-display text-xl font-bold">{x.n ? `${x.acc}%` : "–"}</div><div className="text-[10px] text-muted-foreground">n={x.n}</div></div>)}
          </div>
        </div>
        <div className="glass p-5">
          <h2 className="mb-4 font-semibold">Score progress</h2>
          {d.history.length < 2 ? <p className="py-16 text-center text-sm text-muted-foreground">Play at least two matches to see a trend.</p> : (
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={d.history}>
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="game" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }} />
                  <Area type="monotone" dataKey="score" stroke="var(--primary)" fill="url(#g)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-success/30 bg-success/10 p-3"><div className="flex items-center gap-1 text-xs text-success"><TrendingUp className="size-3" /> Strongest</div><div className="font-semibold">{d.strongest ? `${d.strongest.label} (${d.strongest.acc}%)` : "Need 3+ answers per topic"}</div></div>
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3"><div className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3" /> Needs practice</div><div className="font-semibold">{d.weakest ? `${d.weakest.label} (${d.weakest.acc}%)` : "Not enough data"}</div></div>
          </div>
        </div>
      </div>
      <div className="glass p-5">
        <h2 className="mb-3 font-semibold">Recent matches</h2>
        {!d.recent.length ? <p className="text-sm text-muted-foreground">No matches yet.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Match</th><th>Status</th><th className="text-right">Rank</th><th className="text-right">Correct</th><th className="text-right">Score</th></tr></thead>
            <tbody>{d.recent.map((m) => { const room = m.rooms as { name: string; status: string }; return (
              <tr key={m.id} className="border-t border-border"><td className="py-2">{room.name}</td><td className="text-xs capitalize text-muted-foreground">{room.status}</td><td className="tabular text-right">{m.rank ?? "–"}</td><td className="tabular text-right">{m.correct_count}/{m.answered_count}</td><td className="tabular text-right font-semibold">{m.score.toLocaleString()}</td></tr>
            ); })}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
