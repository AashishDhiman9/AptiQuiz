import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { ArrowDown, ArrowUp, Gamepad2, Target, Timer, Trophy, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader, Stat, DemoBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { myStatsQuery } from "@/lib/stats";
import { leagueQuery } from "@/lib/data";
import { getHostRequest, requestHostAccess } from "@/lib/profile";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: z.object({ access: z.literal("host").optional() }),
  head: () => ({
    meta: [
      { title: "Player Dashboard — AptiQuiz" },
      { name: "description", content: "Your matches, points, accuracy and college standings at a glance." },
      { property: "og:title", content: "Player Dashboard — AptiQuiz" },
      { property: "og:description", content: "Your AptiQuiz overview." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, profile } = useAuth();
  const { access } = Route.useSearch();
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const s = useQuery(myStatsQuery(user?.id));
  const league = useQuery(leagueQuery("all"));
  const hostRequest = useQuery({
    queryKey: ["host-request", user?.id],
    enabled: !!user && profile?.role !== "host",
    queryFn: () => getHostRequest(user!.id),
  });
  const requestHost = useMutation({
    mutationFn: () => requestHostAccess(user!.id),
    onSuccess: async (request) => {
      queryClient.setQueryData(["host-request", user?.id], request);
      toast.success("Your Host access request is recorded");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const d = s.data;
  return (
    <div className="space-y-6">
      <PageHeader title="Player Dashboard" subtitle={user?.email ?? ""} />
      {profile?.role !== "host" && (
        <section className="glass flex flex-wrap items-center justify-between gap-4 p-5" aria-label="Host access request">
          <div>
            <h2 className="font-semibold">Want to host quizzes?</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Host tools require approval. Your request is reviewed by the AptiQuiz project administrator.
            </p>
            {access === "host" && <p className="mt-2 text-sm text-warning">Host access is not approved for this account yet.</p>}
            {hostRequest.data?.status === "pending" && <p className="mt-2 text-sm text-primary">Your request is pending review.</p>}
            {hostRequest.data?.status === "rejected" && <p className="mt-2 text-sm text-muted-foreground">Your request was declined. Contact the project administrator if you need a review.</p>}
            {hostRequest.isError && <p className="mt-2 text-sm text-destructive">Could not load your request: {(hostRequest.error as Error).message}</p>}
          </div>
          {hostRequest.data?.status === "approved" ? (
            <Button variant="hero" onClick={() => window.location.reload()}>Refresh Host access</Button>
          ) : (
            <Button
              variant="glass"
              disabled={requestHost.isPending || !!hostRequest.data}
              onClick={() => requestHost.mutate()}
            >
              {requestHost.isPending
                ? "Submitting…"
                : hostRequest.data?.status === "rejected"
                  ? "Request declined"
                  : hostRequest.data
                    ? "Request submitted"
                    : "Request Host access"}
            </Button>
          )}
        </section>
      )}
      <form className="glass flex flex-wrap items-center gap-3 p-4" onSubmit={(e) => { e.preventDefault(); if (code.length >= 4) nav({ to: "/play/$code", params: { code } }); }}>
        <span className="font-semibold">Join a competition</span>
        <Input aria-label="Room code" className="max-w-48 font-display tracking-[0.3em]" placeholder="CODE" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <Button type="submit" variant="hero">Join</Button>
        <Button type="button" variant="ghost" asChild><Link to="/practice">or practice solo</Link></Button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat icon={Trophy} label="Total points" value={d?.totalPoints.toLocaleString() ?? "–"} />
        <Stat icon={Gamepad2} label="Games" value={d?.games ?? "–"} />
        <Stat icon={Target} label="Accuracy" value={d ? `${d.accuracy}%` : "–"} />
        <Stat icon={Timer} label="Avg time" value={d ? `${(d.avgMs / 1000).toFixed(1)}s` : "–"} />
        <Stat icon={CheckCircle2} label="Correct" value={d?.correct ?? "–"} />
        <Stat icon={XCircle} label="Incorrect" value={d?.incorrect ?? "–"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Recent matches & rank movement</h2><Link to="/performance" className="text-sm text-primary">Full analytics</Link></div>
          {!d?.recent.length ? <p className="py-8 text-center text-sm text-muted-foreground">No matches yet — join one above.</p> : (
            <ul className="divide-y divide-border">
              {d.recent.map((m) => {
                const mv = m.prev_rank && m.rank ? m.prev_rank - m.rank : 0;
                return (
                  <li key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="flex-1 truncate">{(m.rooms as { name: string }).name}</span>
                    <span className="text-muted-foreground">#{m.rank ?? "–"}</span>
                    <span className="w-8">{mv > 0 ? <ArrowUp className="size-4 text-success" /> : mv < 0 ? <ArrowDown className="size-4 text-destructive" /> : null}</span>
                    <span className="tabular w-20 text-right font-semibold">{m.score.toLocaleString()}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <h3 className="mb-2 mt-5 text-sm font-semibold">Topic strengths</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {d?.byTopic.map((t) => <div key={t.topic} className="rounded-xl bg-surface/60 p-3"><div className="truncate text-xs text-muted-foreground">{t.label}</div><div className="tabular font-display text-lg font-bold">{t.n ? `${t.acc}%` : "–"}</div><div className="text-[10px] text-muted-foreground">n={t.n}</div></div>)}
          </div>
        </div>
        <div className="glass p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">College standings</h2>{league.data?.standings.some((x) => x.hasDemo) && <DemoBadge />}</div>
          <ol className="space-y-2 text-sm">
            {league.data?.standings.slice(0, 6).map((x, i) => <li key={x.college.id} className="flex justify-between"><span><span className="mr-2 text-muted-foreground">{i + 1}</span>{x.college.short_name}</span><span className="tabular font-semibold">{x.points.toLocaleString()}</span></li>)}
          </ol>
          <Button variant="link" className="mt-2 px-0" asChild><Link to="/leagues">View leagues</Link></Button>
        </div>
      </div>
    </div>
  );
}
