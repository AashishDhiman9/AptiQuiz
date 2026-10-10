import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, BarChart3, ShieldCheck, Trophy, Users, Zap, School } from "lucide-react";
import hero from "@/assets/hero-arena.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Leaderboard } from "@/components/Leaderboard";
import { DemoBadge } from "@/components/AppShell";
import { leagueQuery, topPlayersQuery } from "@/lib/data";
import { RoleChoices } from "@/components/RoleChoices";
import { useAuth } from "@/hooks/use-auth";
import { setPendingRole, type AppRole } from "@/lib/role-selection";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AptiQuiz — Think Fast. Play Smart. Rise to the Top." },
      { name: "description", content: "Real-time multiplayer aptitude battles for placement prep. Join with a room code, compete live, and climb college leagues." },
      { property: "og:title", content: "AptiQuiz — Real-Time Aptitude Arena" },
      { property: "og:description", content: "Up to 50 players, same question, same clock. Server-scored live aptitude competitions." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [code, setCode] = useState("");
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const top = useQuery(topPlayersQuery);
  const league = useQuery(leagueQuery("all"));

  return (
    <div className="space-y-14">
      <section className="relative overflow-hidden rounded-3xl border border-border">
        <img src={hero} alt="" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover opacity-55" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/20" />
        <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:p-14">
          <div>
            <h1 className="font-display text-5xl font-bold leading-[1.02] sm:text-6xl">
              Think Fast.<br />Play <span className="text-gradient">Smart.</span><br /><span className="text-gradient">Rise to the Top.</span>
            </h1>
            <p className="mt-5 max-w-lg text-muted-foreground">
              A live multiplayer aptitude arena for college students. Same question, same clock, up to 50 players — scored by the server, ranked in real time.
            </p>
            {loading ? (
              <div className="mt-7 h-36 animate-pulse rounded-2xl bg-surface/50" />
            ) : user ? (
              <div className="mt-7 flex flex-wrap gap-3">
                <Button variant="hero" size="lg" asChild><Link to="/dashboard">Player Dashboard <ArrowRight /></Link></Button>
                <Button variant="glass" size="lg" asChild><Link to="/host">Host Dashboard</Link></Button>
              </div>
            ) : (
              <div className="mt-7">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Choose your role to continue</h2>
                <RoleChoices onSelect={(role: AppRole) => { setPendingRole(role); nav({ to: "/auth" }); }} />
              </div>
            )}
            <form
              className="glass mt-8 flex max-w-md gap-2 p-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim().length >= 4) nav({ to: "/play/$code", params: { code: code.trim().toUpperCase() } });
              }}
            >
              <Input aria-label="Room code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter room code" maxLength={8} className="h-11 border-0 bg-transparent font-display text-lg tracking-[0.3em] uppercase" />
              <Button type="submit" className="h-11">Join</Button>
            </form>
          </div>
          <div className="glass self-center p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold"><Trophy className="size-4 text-gold" /> Top scores</h2>
              {top.data?.some((r) => (r.rooms as { is_demo: boolean }).is_demo) && <DemoBadge />}
            </div>
            {top.isLoading ? <div className="h-64 animate-pulse rounded-xl bg-surface/60" /> : <Leaderboard size="sm" rows={(top.data ?? []).slice(0, 5).map((r, i) => ({ ...r, rank: i + 1, prev_rank: null }))} />}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-center text-2xl font-bold">Why AptiQuiz?</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Users, t: "Real-time multiplayer", d: "Up to 50 players answer the same question at the same moment." },
            { icon: ShieldCheck, t: "Server-authoritative", d: "Answer keys stay on the server. Timing and scoring can't be faked." },
            { icon: BarChart3, t: "Deep analytics", d: "Accuracy, speed and topic strengths from every recorded answer." },
            { icon: School, t: "College leagues", d: "Your best scores lift your college up the standings." },
          ].map(({ icon: I, t, d }) => (
            <div key={t} className="glass p-5">
              <I className="size-6 text-primary" />
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass p-6">
          <h2 className="text-xl font-bold">How scoring works</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li><b className="text-foreground">1,000</b> points for a correct answer</li>
            <li>Up to <b className="text-foreground">+500</b> speed bonus: 500 × (1 − time used / time limit)</li>
            <li><b className="text-foreground">0</b> for wrong, late, or no answer</li>
            <li>Ties: more correct answers, then less total time</li>
          </ul>
          <Button variant="link" className="mt-3 px-0" asChild><Link to="/practice">Try a practice round <ArrowRight /></Link></Button>
        </div>
        <div className="glass p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">College League</h2>
            {league.data?.standings.some((s) => s.hasDemo) && <DemoBadge />}
          </div>
          <ol className="mt-4 space-y-3">
            {(league.data?.standings ?? []).slice(0, 5).map((s, i) => {
              const max = league.data!.standings[0]?.points || 1;
              return (
                <li key={s.college.id} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 text-sm">
                  <span className="tabular text-muted-foreground">{i + 1}</span>
                  <div>
                    <div>{s.college.short_name} <span className="text-muted-foreground">· {s.college.city}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-gradient-primary" style={{ width: `${(s.points / max) * 100}%` }} /></div>
                  </div>
                  <span className="tabular font-semibold">{s.points.toLocaleString()}</span>
                </li>
              );
            })}
          </ol>
          <Button variant="link" className="mt-3 px-0" asChild><Link to="/leagues">View full league <ArrowRight /></Link></Button>
        </div>
      </section>

      <section className="glass flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex items-center gap-3"><Zap className="size-6 fill-primary text-primary" /><p className="font-semibold">Ready to compete? Grab a code from your host and jump in.</p></div>
        <Button variant="hero" asChild><Link to="/play">Play Now <ArrowRight /></Link></Button>
      </section>
    </div>
  );
}
