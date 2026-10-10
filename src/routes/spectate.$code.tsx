import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown, Users, X, Zap } from "lucide-react";
import hero from "@/assets/hero-arena.jpg";
import { Leaderboard } from "@/components/Leaderboard";
import { TimerRing } from "@/components/Timer";
import { DemoBadge } from "@/components/AppShell";
import { useRoom, usePhaseTimer, useServerOffset } from "@/hooks/use-room";
import { collegesQuery } from "@/lib/data";
import { TOPICS, type Topic } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/spectate/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Live: Room ${params.code} — AptiQuiz Spectator` },
      { name: "description", content: "Live big-screen standings for an AptiQuiz competition." },
      { property: "og:title", content: `Watch room ${params.code} live` },
      { property: "og:description", content: "Live standings, podium and results." },
    ],
  }),
  ssr: false,
  component: Spectate,
});

function Spectate() {
  const { code } = Route.useParams();
  const room = useRoom(code);
  const offset = useServerOffset();
  const colleges = useQuery(collegesQuery);
  const r = room.data?.room;
  const remaining = usePhaseTimer(code, r?.phase_ends_at, offset);
  const colName = (id: string | null) => colleges.data?.find((c) => c.id === id)?.short_name ?? null;

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background">
      <img src={hero} alt="" className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-15" />
      <div className="relative mx-auto max-w-[1600px] p-6 lg:p-10">
        <header className="mb-8 flex flex-wrap items-center gap-6">
          <span className="flex items-center gap-2 font-display text-3xl font-bold"><Zap className="size-8 fill-primary text-primary" />Apti<span className="text-primary">Quiz</span></span>
          {r && (
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-3xl font-bold lg:text-5xl">{r.name}</h1>
              <p className="text-lg text-muted-foreground">Room {code} · {r.status === "finished" ? "Final results" : r.status === "lobby" ? "Waiting to start" : `Question ${r.current_index + 1} of ${r.total_questions}`}</p>
            </div>
          )}
          {r?.is_demo && <DemoBadge />}
          {r && <span className="flex items-center gap-2 text-2xl"><Users className="size-6 text-primary" />{room.data!.participants.length}</span>}
          <Link to="/spectate" aria-label="Exit spectator mode" className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground"><X /></Link>
        </header>
        {!r ? (
          <p className="py-40 text-center text-3xl text-muted-foreground">{room.isLoading ? "Loading…" : `No room ${code}`}</p>
        ) : (
          <div className="grid gap-8 xl:grid-cols-[1fr_640px]">
            <section>
              {r.status === "finished" || r.status === "lobby" ? (
                <Podium rows={room.data!.participants.slice(0, 3)} colName={colName} lobby={r.status === "lobby"} code={code} />
              ) : r.status === "countdown" ? (
                <p className="py-32 text-center font-display text-[10rem] font-bold leading-none text-primary">{Math.ceil(remaining / 1000)}</p>
              ) : r.current_question && (
                <div className="glass p-8">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <p className="text-xl text-muted-foreground">{TOPICS[r.current_question.topic as Topic]} · <span className="capitalize">{r.current_question.difficulty}</span></p>
                      <h2 className="mt-4 text-4xl font-semibold leading-tight">{r.current_question.text}</h2>
                    </div>
                    {r.status === "question" && <TimerRing remainingMs={remaining} totalMs={r.question_duration_ms} size={150} />}
                  </div>
                  <div className="mt-8 grid gap-4 md:grid-cols-2">
                    {r.current_question.options.map((o, i) => {
                      const n = r.reveal?.distribution?.[i] ?? 0;
                      const tot = r.reveal?.answered || 1;
                      const correct = r.status === "reveal" && r.reveal?.correct_index === i;
                      return (
                        <div key={i} className={cn("relative overflow-hidden rounded-2xl border border-border bg-surface/70 p-5 text-2xl", correct && "border-success glow-ring")}>
                          {r.status === "reveal" && <div className={cn("absolute inset-y-0 left-0", correct ? "bg-success/20" : "bg-primary/10")} style={{ width: `${(n / tot) * 100}%` }} />}
                          <span className="relative">{String.fromCharCode(65 + i)}. {o}</span>
                          {r.status === "reveal" && <span className="tabular relative float-right text-muted-foreground">{n}</span>}
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-6 text-2xl text-muted-foreground">
                    {r.status === "reveal" && r.reveal ? `${r.reveal.correct_count} of ${r.reveal.answered} answered correctly` : `${r.answered_count} of ${room.data!.participants.length} answered`}
                  </p>
                </div>
              )}
            </section>
            <section className="glass p-4">
              <h2 className="mb-3 px-2 text-2xl font-bold">Live standings</h2>
              <Leaderboard size="xl" rows={room.data!.participants.slice(0, 10).map((p) => ({ ...p, college: colName(p.college_id) }))} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Podium({ rows, colName, lobby, code }: { rows: { id: string; display_name: string; score: number; college_id: string | null }[]; colName: (id: string | null) => string | null; lobby: boolean; code: string }) {
  if (lobby)
    return (
      <div className="glass py-24 text-center">
        <p className="text-2xl text-muted-foreground">Join at <b className="text-foreground">/play</b> with code</p>
        <p className="mt-4 font-display text-9xl font-bold tracking-[0.2em] text-primary">{code}</p>
      </div>
    );
  const order = [1, 0, 2];
  return (
    <div className="glass p-8 text-center">
      <Crown className="mx-auto size-14 text-gold" />
      <h2 className="mt-2 text-4xl font-bold">Champion: {rows[0]?.display_name ?? "—"}</h2>
      <div className="mx-auto mt-10 grid max-w-3xl grid-cols-3 items-end gap-6">
        {order.map((i) => rows[i] && (
          <div key={rows[i].id} className={cn("rounded-t-3xl border border-border bg-surface/80 p-6", i === 0 ? "h-80 glow-ring" : i === 1 ? "h-64" : "h-52")}>
            <div className={cn("font-display text-6xl font-bold", ["text-gold", "text-silver", "text-bronze"][i])}>{i + 1}</div>
            <div className="mt-3 truncate text-2xl font-semibold">{rows[i].display_name}</div>
            <div className="text-lg text-muted-foreground">{colName(rows[i].college_id)}</div>
            <div className="tabular mt-2 font-display text-3xl font-bold">{rows[i].score.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
