import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { checkPractice } from "@/lib/game.functions";
import { TOPICS, type Topic } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/practice")({
  head: () => ({
    meta: [
      { title: "Practice — AptiQuiz" },
      { name: "description", content: "Untimed solo practice on sample aptitude questions with instant explanations." },
      { property: "og:title", content: "Practice aptitude questions — AptiQuiz" },
      { property: "og:description", content: "Solo practice with explanations." },
    ],
  }),
  component: Practice,
});

function Practice() {
  const [topic, setTopic] = useState<"all" | Topic>("all");
  const qs = useQuery({
    queryKey: ["practice-qs"],
    queryFn: async () => {
      const { data: sets } = await supabase.from("question_sets").select("id").eq("is_sample", true);
      const { data } = await supabase.from("questions").select("id, text, options, topic, difficulty, image_url").in("set_id", (sets ?? []).map((s) => s.id)).order("position");
      return data ?? [];
    },
  });
  const list = (qs.data ?? []).filter((q) => topic === "all" || q.topic === topic);
  const [i, setI] = useState(0);
  const [res, setRes] = useState<{ choice: number; correct: boolean; correctIndex: number; explanation: string } | null>(null);
  const [score, setScore] = useState({ c: 0, n: 0 });
  const q = list[i];

  async function pick(choice: number) {
    if (res || !q) return;
    const r = await checkPractice({ data: { questionId: q.id, choice } });
    setRes({ choice, ...r });
    setScore((s) => ({ c: s.c + (r.correct ? 1 : 0), n: s.n + 1 }));
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Practice" subtitle="Solo, untimed, sample questions. Practice answers don't count toward rankings." />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", ...Object.keys(TOPICS)] as const).map((t) => (
          <Button key={t} size="sm" variant={topic === t ? "default" : "glass"} onClick={() => { setTopic(t as "all" | Topic); setI(0); setRes(null); }}>{t === "all" ? "All" : TOPICS[t as Topic]}</Button>
        ))}
        <span className="ml-auto self-center text-sm text-muted-foreground">Score {score.c}/{score.n}</span>
      </div>
      {qs.isLoading ? <div className="h-80 animate-pulse rounded-2xl bg-surface/60" /> : !q ? (
        <div className="glass p-10 text-center"><p>You've finished this set! {score.c}/{score.n} correct.</p><Button className="mt-4" onClick={() => { setI(0); setRes(null); setScore({ c: 0, n: 0 }); }}><RotateCcw /> Restart</Button></div>
      ) : (
        <div className="glass p-6">
          <p className="text-xs text-muted-foreground">Q{i + 1}/{list.length} · {TOPICS[q.topic as Topic]} · <span className="capitalize">{q.difficulty}</span></p>
          <h2 className="mt-3 text-xl font-semibold">{q.text}</h2>
          <div className="mt-5 grid gap-3">
            {(q.options as string[]).map((o, k) => (
              <button key={k} disabled={!!res} onClick={() => pick(k)} className={cn("flex min-h-12 items-center gap-3 rounded-xl border border-border bg-surface/60 px-4 text-left hover:border-primary/50 disabled:cursor-default", res && k === res.correctIndex && "border-success bg-success/15", res && k === res.choice && !res.correct && "border-destructive bg-destructive/15")}>
                <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-sm font-semibold">{String.fromCharCode(65 + k)}</span>{o}
              </button>
            ))}
          </div>
          {res && (
            <div className="mt-5 animate-pop">
              <p className={cn("flex items-center gap-2 font-semibold", res.correct ? "text-success" : "text-destructive")}>{res.correct ? <CheckCircle2 /> : <XCircle />}{res.correct ? "Correct!" : "Incorrect"}</p>
              {res.explanation && <p className="mt-1 text-sm text-muted-foreground">{res.explanation}</p>}
              <Button variant="hero" className="mt-4" onClick={() => { setI(i + 1); setRes(null); }}>Next question</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
