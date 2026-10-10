import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Download, Play, SkipForward, Square, Tv, UserX, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Leaderboard } from "@/components/Leaderboard";
import { RulesCard } from "@/components/RulesCard";
import { TimerRing } from "@/components/Timer";
import { Initials } from "@/components/AppShell";
import { useRoom, usePhaseTimer, useServerOffset } from "@/hooks/use-room";
import { getHostReport, hostAction } from "@/lib/game.functions";
import { collegesQuery } from "@/lib/data";
import { TOPICS, type Topic } from "@/lib/scoring";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/host/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Hosting ${params.code} — AptiQuiz` },
      { name: "description", content: "Host controls and live monitoring for this competition." },
      { property: "og:title", content: `Hosting room ${params.code}` },
      { property: "og:description", content: "AptiQuiz host control panel." },
    ],
  }),
  component: HostRoom,
});

function HostRoom() {
  const { code } = Route.useParams();
  const { user } = useAuth();
  const room = useRoom(code);
  const offset = useServerOffset();
  const colleges = useQuery(collegesQuery);
  const r = room.data?.room;
  const remaining = usePhaseTimer(code, r?.phase_ends_at, offset);
  const [busy, setBusy] = useState(false);
  const report = useQuery({
    queryKey: ["report", code, r?.status],
    enabled: r?.status === "finished",
    queryFn: () => getHostReport({ data: { code } }),
  });

  if (room.isLoading) return <div className="h-96 animate-pulse rounded-2xl bg-surface/60" />;
  if (!r) return <p>Room not found.</p>;
  if (user && r.host_id !== user.id) return <p className="text-destructive">You are not the host of this room.</p>;
  const ps = room.data!.participants;
  const colName = (id: string | null) => colleges.data?.find((c) => c.id === id)?.short_name ?? null;
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/play/${code}` : "";

  async function act(action: "start" | "next" | "end" | "kick", participantId?: string) {
    setBusy(true);
    try {
      await hostAction({ data: { code, action, participantId } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (!report.data) return;
    const rows = [["rank", "name", "college", "score", "correct", "answered", "total_time_ms"], ...report.data.participants.map((p) => [p.rank, p.display_name, colName(p.college_id) ?? "", p.score, p.correct_count, p.answered_count, p.total_time_ms])];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `aptiquiz-${code}-results.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center gap-4 p-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Join code</p>
          <p className="font-display text-4xl font-bold tracking-[0.25em] text-primary">{code}</p>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{r.name}</h1>
          <p className="text-sm text-muted-foreground">{r.quiz_title} · {r.total_questions} questions · {ps.length}/{r.max_players} players</p>
          <p className={cn("mt-1 flex items-center gap-1 text-xs", room.connected ? "text-success" : "text-destructive")}>{room.connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}{room.connected ? "Live connection" : "Reconnecting"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="glass" onClick={() => { navigator.clipboard.writeText(joinUrl); toast.success("Join link copied"); }}><Copy /> Copy link</Button>
          <Button variant="glass" asChild><Link to="/spectate/$code" params={{ code }} target="_blank"><Tv /> Spectator screen</Link></Button>
          {r.status === "lobby" && <Button variant="hero" disabled={busy || !ps.length} onClick={() => act("start")}><Play /> Start game</Button>}
          {(r.status === "question" || r.status === "reveal") && <Button variant="glass" disabled={busy} onClick={() => act("next")}><SkipForward /> {r.status === "question" ? "Close round" : "Next"}</Button>}
          {r.status !== "finished" && r.status !== "lobby" && <Button variant="destructive" disabled={busy} onClick={() => act("end")}><Square /> End</Button>}
        </div>
      </div>

      {r.status === "lobby" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="glass p-5">
            <h2 className="mb-3 font-semibold">Players in lobby ({ps.length})</h2>
            {!ps.length ? <p className="py-10 text-center text-muted-foreground">Waiting for players to join with code {code}…</p> : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {ps.map((p) => (
                  <li key={p.id} className="flex animate-pop items-center gap-3 rounded-xl bg-surface/60 p-2">
                    <Initials name={p.display_name} />
                    <span className="flex-1 truncate">{p.display_name}<span className="ml-2 text-xs text-muted-foreground">{colName(p.college_id)}</span></span>
                    <Button size="icon" variant="ghost" aria-label={`Remove ${p.display_name}`} onClick={() => act("kick", p.id)}><UserX /></Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <RulesCard />
        </div>
      )}

      {(r.status === "countdown" || r.status === "question" || r.status === "reveal") && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="glass p-5">
            {r.status === "countdown" ? (
              <p className="py-10 text-center font-display text-6xl font-bold text-primary">{Math.ceil(remaining / 1000)}</p>
            ) : r.current_question && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Q{r.current_index + 1}/{r.total_questions} · {TOPICS[r.current_question.topic as Topic]} · {r.current_question.difficulty}</p>
                  <TimerRing remainingMs={remaining} totalMs={r.status === "question" ? r.question_duration_ms : 7000} size={80} />
                </div>
                <h2 className="mt-3 text-xl font-semibold">{r.current_question.text}</h2>
                <ul className="mt-4 space-y-2">
                  {r.current_question.options.map((o, i) => {
                    const n = r.reveal?.distribution?.[i] ?? 0;
                    const tot = r.reveal?.answered || 1;
                    return (
                      <li key={i} className={cn("relative overflow-hidden rounded-lg border border-border px-4 py-2.5", r.reveal?.correct_index === i && "border-success")}>
                        {r.reveal && <div className="absolute inset-y-0 left-0 bg-primary/12" style={{ width: `${(n / tot) * 100}%` }} />}
                        <span className="relative">{String.fromCharCode(65 + i)}. {o}{r.reveal && <span className="float-right tabular text-muted-foreground">{n}</span>}</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 text-sm text-muted-foreground">Answered: <b className="text-foreground">{r.answered_count}/{ps.length}</b>{r.reveal && ` · Correct: ${r.reveal.correct_count}`}</p>
              </>
            )}
          </div>
          <div className="glass p-3"><Leaderboard size="sm" showAccuracy rows={ps.map((p) => ({ ...p, college: colName(p.college_id) }))} /></div>
        </div>
      )}

      {r.status === "finished" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="glass p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Question analysis</h2>
              <Button size="sm" variant="glass" onClick={exportCsv} disabled={!report.data}><Download /> Export CSV</Button>
            </div>
            {report.isLoading ? <div className="h-40 animate-pulse rounded-xl bg-surface/60" /> : report.error ? <p className="text-destructive">Could not load report.</p> : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">#</th><th>Question</th><th>Topic</th><th className="text-right">Answered</th><th className="text-right">Wrong %</th><th className="text-right">Avg time</th></tr></thead>
                <tbody>
                  {report.data?.questions.map((q) => (
                    <tr key={q.index} className="border-t border-border">
                      <td className="py-2 text-muted-foreground">{q.index + 1}</td>
                      <td className="max-w-xs truncate pr-2">{q.text}</td>
                      <td className="text-xs text-muted-foreground">{q.topic}</td>
                      <td className="tabular text-right">{q.answered}</td>
                      <td className={cn("tabular text-right", q.incorrectRate >= 50 ? "text-destructive" : "text-success")}>{q.incorrectRate}%</td>
                      <td className="tabular text-right">{(q.avgMs / 1000).toFixed(1)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="glass p-3"><h2 className="mb-2 px-1 font-semibold">Final standings</h2><Leaderboard size="sm" showAccuracy rows={ps.map((p) => ({ ...p, college: colName(p.college_id) }))} /></div>
        </div>
      )}
    </div>
  );
}
