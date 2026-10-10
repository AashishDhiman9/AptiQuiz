import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Wifi, WifiOff, XCircle, Users, Clock, Trophy, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Leaderboard } from "@/components/Leaderboard";
import { RulesCard } from "@/components/RulesCard";
import { TimerRing } from "@/components/Timer";
import { Initials } from "@/components/AppShell";
import { useRoom, usePhaseTimer, useServerOffset, loadCreds, playerKey } from "@/hooks/use-room";
import { getPlayerState, joinRoom, submitAnswer } from "@/lib/game.functions";
import { collegesQuery } from "@/lib/data";
import { TOPICS, type Topic } from "@/lib/scoring";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/play/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.code} — AptiQuiz Arena` },
      { name: "description", content: "Live aptitude competition room. Join and answer in real time." },
      { property: "og:title", content: `Join AptiQuiz room ${params.code}` },
      { property: "og:description", content: "Same question, same clock. Join the live battle." },
    ],
  }),
  ssr: false,
  component: PlayRoom,
});

function PlayRoom() {
  const { code } = Route.useParams();
  const [creds, setCreds] = useState(() => loadCreds(code));
  const room = useRoom(code);

  if (room.isLoading) return <Center><Loader2 className="size-6 animate-spin text-primary" /></Center>;
  if (!room.data) return <Center><p className="text-lg">No room with code <b>{code}</b>.</p><Button asChild className="mt-4"><Link to="/play">Try another code</Link></Button></Center>;
  if (!creds) return <JoinForm code={code} status={room.data.room.status} name={room.data.room.name} count={room.data.participants.length} max={room.data.room.max_players} onJoined={setCreds} />;
  return <Arena code={code} creds={creds} room={room} onLeave={() => { localStorage.removeItem(playerKey(code)); setCreds(null); }} />;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">{children}</div>;
}

function JoinForm({ code, status, name, count, max, onJoined }: { code: string; status: string; name: string; count: number; max: number; onJoined: (c: { participantId: string; token: string }) => void }) {
  const { user } = useAuth();
  const colleges = useQuery(collegesQuery);
  const [displayName, setDisplayName] = useState("");
  const [college, setCollege] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (user && !displayName) setDisplayName(((user.user_metadata?.display_name as string) || user.email?.split("@")[0] || "").slice(0, 24));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await joinRoom({ data: { code, displayName, collegeId: college || null } });
      if ("error" in r && r.error) return setErr(r.error);
      if ("participantId" in r) {
        const c = { participantId: r.participantId, token: r.token };
        localStorage.setItem(playerKey(code), JSON.stringify(c));
        onJoined(c);
      }
    } catch (e) {
      const m = (e as Error).message;
      setErr(m.includes("[") ? "Please check your name (2–24 letters, numbers, spaces)." : m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={join} className="glass space-y-4 p-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Room {code}</p>
          <h1 className="text-2xl font-bold">{name}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><Users className="size-4" /> {count}/{max} players</p>
        </div>
        {status !== "lobby" ? (
          <p className="rounded-lg bg-warning/10 p-3 text-sm text-warning">This competition has already started. You can still <Link to="/spectate/$code" params={{ code }} className="underline">watch it live</Link>.</p>
        ) : (
          <>
            <div><Label htmlFor="dn">Display name</Label><Input id="dn" required minLength={2} maxLength={24} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Logic_Lord" /></div>
            <div>
              <Label htmlFor="col">College (optional)</Label>
              <select id="col" className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm" value={college} onChange={(e) => setCollege(e.target.value)}>
                <option value="">— None —</option>
                {colleges.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {!user && <p className="text-xs text-muted-foreground"><Link to="/auth" search={{ next: `/play/${code}` }} className="text-primary">Sign in</Link> first to save results to your performance history.</p>}
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>{busy ? "Joining…" : "Join competition"}</Button>
          </>
        )}
      </form>
    </div>
  );
}
type RoomQ = ReturnType<typeof useRoom>;

function Arena({ code, creds, room, onLeave }: { code: string; creds: { participantId: string; token: string }; room: RoomQ; onLeave: () => void }) {
  const qc = useQueryClient();
  const offset = useServerOffset();
  const r = room.data!.room;
  const participants = room.data!.participants;
  const me = participants.find((p) => p.id === creds.participantId);
  const colleges = useQuery(collegesQuery);
  const colName = (id: string | null) => colleges.data?.find((c) => c.id === id)?.short_name ?? null;

  const ps = useQuery({
    queryKey: ["pstate", code, creds.participantId],
    queryFn: () => getPlayerState({ data: { code, ...creds } }),
  });
  // refetch private state whenever the public room phase changes
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["pstate", code, creds.participantId] });
  }, [r.status, r.current_index, qc, code, creds.participantId]);

  const remaining = usePhaseTimer(code, r.phase_ends_at, offset);
  const [selected, setSelected] = useState<number | null>(null);
  const [submit, setSubmit] = useState<{ idx: number; state: "sending" | "accepted" | "rejected"; reason?: string } | null>(null);
  useEffect(() => {
    setSelected(null);
  }, [r.current_index]);

  const state = ps.data && !("error" in ps.data) ? ps.data : null;
  if (ps.data && "error" in ps.data) {
    return <Center><p>{ps.data.error}</p><Button className="mt-4" onClick={onLeave}>Rejoin</Button></Center>;
  }

  const answeredHere = state?.myAnswer != null || (submit?.idx === r.current_index && submit.state === "accepted");
  const sub = submit?.idx === r.current_index ? submit : null;

  async function send() {
    if (selected == null || !state || answeredHere) return;
    const idx = r.current_index;
    setSubmit({ idx, state: "sending" });
    try {
      const res = await submitAnswer({ data: { code, ...creds, questionIndex: idx, choice: selected } });
      setSubmit({ idx, state: res.accepted ? "accepted" : "rejected", reason: res.reason ?? undefined });
      if (!res.accepted) toast.error(res.reason ?? "Answer rejected");
      qc.invalidateQueries({ queryKey: ["pstate", code, creds.participantId] });
    } catch {
      setSubmit({ idx, state: "rejected", reason: "Network error — try again" });
    }
  }

  const header = (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="glass !rounded-lg px-3 py-1.5">Room <b className="text-primary">{code}</b></span>
      <span className="glass !rounded-lg px-3 py-1.5">{r.quiz_title}</span>
      <span className="glass flex items-center gap-1 !rounded-lg px-3 py-1.5"><Users className="size-4" />{participants.length}</span>
      <span className={cn("flex items-center gap-1 rounded-lg px-3 py-1.5", room.connected ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
        {room.connected ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}{room.connected ? "Live" : "Reconnecting…"}
      </span>
      {r.status === "lobby" && <Button size="sm" variant="ghost" className="ml-auto" onClick={onLeave}><LogOut /> Leave</Button>}
    </div>
  );

  const myStats = me && (
    <div className="glass grid grid-cols-3 gap-2 p-4 text-center">
      <div><div className="text-xs text-muted-foreground">Score</div><div className="tabular font-display text-xl font-bold">{me.score.toLocaleString()}</div></div>
      <div><div className="text-xs text-muted-foreground">Rank</div><div className="tabular font-display text-xl font-bold">{me.rank ?? "–"}<span className="text-sm text-muted-foreground">/{participants.length}</span></div></div>
      <div><div className="text-xs text-muted-foreground">Correct</div><div className="tabular font-display text-xl font-bold">{me.correct_count}/{me.answered_count}</div></div>
    </div>
  );

  const lb = <div className="glass p-3"><h3 className="mb-2 px-1 text-sm font-semibold">Standings</h3><Leaderboard size="sm" meId={creds.participantId} rows={participants.slice(0, 10).map((p) => ({ ...p, college: colName(p.college_id) }))} /></div>;

  if (r.status === "lobby" || r.status === "countdown") {
    return (
      <div>
        {header}
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="glass p-6 text-center">
            {r.status === "countdown" ? (
              <>
                <p className="text-sm uppercase tracking-widest text-muted-foreground">Get ready</p>
                <p className="tabular my-6 font-display text-8xl font-bold text-primary">{Math.ceil(remaining / 1000)}</p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold">{r.name}</h1>
                <p className="mt-1 text-muted-foreground">{r.total_questions} questions · waiting for the host to start…</p>
                <Loader2 className="mx-auto mt-6 size-6 animate-spin text-primary" />
              </>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {participants.map((p) => (
                <span key={p.id} className={cn("flex items-center gap-2 rounded-full border border-border bg-surface/60 py-1 pl-1 pr-3 text-sm animate-pop", p.id === creds.participantId && "border-primary/60")}>
                  <Initials name={p.display_name} className="size-6 text-[10px]" />{p.display_name}
                </span>
              ))}
            </div>
          </div>
          <RulesCard />
        </div>
      </div>
    );
  }

  if (r.status === "finished") {
    const top3 = participants.slice(0, 3);
    return (
      <div>
        {header}
        <div className="glass p-6 text-center">
          <Trophy className="mx-auto size-10 text-gold" />
          <h1 className="mt-2 text-3xl font-bold">Final results</h1>
          {me && <p className="mt-2 text-muted-foreground">You finished <b className="text-primary">#{me.rank}</b> of {participants.length} with <b className="text-foreground">{me.score.toLocaleString()}</b> points.</p>}
          <div className="mx-auto mt-6 grid max-w-xl grid-cols-3 items-end gap-3">
            {[1, 0, 2].map((i) => top3[i] && (
              <div key={top3[i].id} className={cn("rounded-t-2xl border border-border bg-surface/70 p-3", i === 0 ? "h-44" : i === 1 ? "h-36" : "h-28")}>
                <div className={cn("font-display text-2xl font-bold", ["text-gold", "text-silver", "text-bronze"][i])}>#{i + 1}</div>
                <div className="truncate text-sm font-medium">{top3[i].display_name}</div>
                <div className="tabular text-xs text-muted-foreground">{top3[i].score.toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild variant="hero"><Link to="/performance">My performance</Link></Button>
            <Button asChild variant="glass"><Link to="/play">Play another</Link></Button>
          </div>
        </div>
        <div className="mt-4">{lb}</div>
      </div>
    );
  }

  // question / reveal
  const q = state?.question;
  const reveal = state?.reveal;
  const myAns = state?.myAnswer;
  const myChoice = myAns?.displayChoice ?? (sub ? selected : null);

  return (
    <div>
      {header}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="glass p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Question {r.current_index + 1} of {r.total_questions}</p>
              <div className="mt-2 h-1.5 w-40 rounded-full bg-surface-2"><div className="h-full rounded-full bg-gradient-primary" style={{ width: `${((r.current_index + 1) / r.total_questions) * 100}%` }} /></div>
              {q && <p className="mt-3 flex gap-2 text-xs"><span className="rounded-full bg-blue/15 px-2 py-0.5 text-blue">{TOPICS[(q as { topic: Topic }).topic]}</span><span className="rounded-full bg-warning/10 px-2 py-0.5 capitalize text-warning">{(q as { difficulty: string }).difficulty}</span></p>}
            </div>
            {r.status === "question" ? <TimerRing remainingMs={remaining} totalMs={r.question_duration_ms} /> : <span className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">Results</span>}
          </div>
          {!q ? (
            <div className="py-16 text-center"><Loader2 className="mx-auto size-6 animate-spin text-primary" /></div>
          ) : (
            <>
              <h2 className="mt-6 text-xl font-semibold leading-snug sm:text-2xl">{(q as { text: string }).text}</h2>
              {(q as { image_url: string | null }).image_url && <img src={(q as { image_url: string }).image_url} alt="Question attachment" className="mt-4 max-h-60 rounded-xl border border-border" />}
              <div className="mt-6 grid gap-3" role="radiogroup" aria-label="Answer options">
                {q.options.map((opt, i) => {
                  const isCorrect = reveal?.correctDisplay === i;
                  const isMine = myChoice === i;
                  const locked = answeredHere || r.status !== "question" || sub?.state === "sending";
                  return (
                    <button
                      key={i}
                      role="radio"
                      aria-checked={selected === i || isMine}
                      disabled={locked}
                      onClick={() => setSelected(i)}
                      className={cn(
                        "flex min-h-14 items-center gap-4 rounded-xl border border-border bg-surface/60 px-4 text-left text-base transition-all hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                        (selected === i || isMine) && !reveal && "border-primary bg-primary/12 glow-ring",
                        reveal && isCorrect && "border-success bg-success/15",
                        reveal && isMine && !isCorrect && "border-destructive bg-destructive/15",
                      )}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 font-semibold">{String.fromCharCode(65 + i)}</span>
                      <span className="flex-1">{opt}</span>
                      {reveal && isCorrect && <CheckCircle2 className="size-5 text-success" />}
                      {reveal && isMine && !isCorrect && <XCircle className="size-5 text-destructive" />}
                    </button>
                  );
                })}
              </div>
              {r.status === "question" && (
                <div className="mt-5">
                  {answeredHere ? (
                    <p className="flex items-center justify-center gap-2 rounded-xl bg-success/10 p-3 text-success"><CheckCircle2 className="size-5" /> Answer accepted by server — waiting for the reveal</p>
                  ) : remaining <= 0 ? (
                    <p className="flex items-center justify-center gap-2 rounded-xl bg-warning/10 p-3 text-warning"><Clock className="size-5" /> Time's up — waiting for results</p>
                  ) : (
                    <Button variant="hero" size="lg" className="w-full" disabled={selected == null || sub?.state === "sending"} onClick={send}>
                      {sub?.state === "sending" ? <><Loader2 className="animate-spin" /> Submitting…</> : selected == null ? "Select an answer" : "Submit answer"}
                    </Button>
                  )}
                  {sub?.state === "rejected" && <p role="alert" className="mt-2 text-center text-sm text-destructive">Rejected: {sub.reason}</p>}
                </div>
              )}
              {r.status === "reveal" && (
                <div className="mt-5 animate-pop rounded-xl border border-border bg-surface/60 p-4">
                  {myAns && "correct" in myAns ? (
                    myAns.correct ? (
                      <p className="flex items-center gap-2 text-lg font-semibold text-success"><CheckCircle2 /> Correct! +{myAns.points} pts <span className="text-sm font-normal text-muted-foreground">({((myAns.elapsedMs ?? 0) / 1000).toFixed(1)}s)</span></p>
                    ) : (
                      <p className="flex items-center gap-2 text-lg font-semibold text-destructive"><XCircle /> Not quite — 0 pts</p>
                    )
                  ) : (
                    <p className="flex items-center gap-2 font-semibold text-warning"><Clock /> No answer — 0 pts</p>
                  )}
                  {reveal?.explanation && <p className="mt-2 text-sm text-muted-foreground">{reveal.explanation}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">Next question in {Math.ceil(remaining / 1000)}s</p>
                </div>
              )}
            </>
          )}
        </div>
        <div className="space-y-4">
          {myStats}
          <div className="glass flex items-center justify-between p-4 text-sm"><span className="text-muted-foreground">Players answered</span><span className="tabular font-display text-xl font-bold">{r.status === "reveal" ? r.reveal?.answered ?? r.answered_count : r.answered_count}/{participants.length}</span></div>
          {lb}
          <RulesCard compact />
        </div>
      </div>
    </div>
  );
}
