import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { accuracy, TOPICS, DIFFICULTIES, type Topic } from "./scoring";

/** Personal stats derived only from server-recorded answers of signed-in matches. */
export const myStatsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-stats", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: answers, error }, { data: matches }] = await Promise.all([
        supabase.from("answers").select("room_id, correct, elapsed_ms, points, topic, difficulty, created_at, question_index").eq("user_id", userId!).order("created_at"),
        supabase
          .from("participants")
          .select("id, score, rank, prev_rank, correct_count, answered_count, rooms!inner(id, name, quiz_title, status, finished_at, created_at)")
          .eq("user_id", userId!)
          .order("joined_at", { ascending: false }),
      ]);
      if (error) throw error;
      const a = answers ?? [];
      const correct = a.filter((x) => x.correct).length;
      const byTopic = (Object.keys(TOPICS) as Topic[]).map((t) => {
        const s = a.filter((x) => x.topic === t);
        const c = s.filter((x) => x.correct).length;
        return { topic: t, label: TOPICS[t], n: s.length, correct: c, acc: accuracy(c, s.length) };
      });
      const byDiff = DIFFICULTIES.map((d) => {
        const s = a.filter((x) => x.difficulty === d);
        const c = s.filter((x) => x.correct).length;
        return { difficulty: d, n: s.length, acc: accuracy(c, s.length) };
      });
      const finished = (matches ?? []).filter((m) => (m.rooms as { status: string }).status === "finished");
      const history = [...finished].reverse().map((m, i) => ({ game: i + 1, score: m.score, name: (m.rooms as { name: string }).name }));
      const eligible = byTopic.filter((t) => t.n >= 3);
      const strongest = eligible.length ? [...eligible].sort((x, y) => y.acc - x.acc)[0] : null;
      const weakest = eligible.length > 1 ? [...eligible].sort((x, y) => x.acc - y.acc)[0] : null;
      return {
        games: finished.length,
        totalPoints: finished.reduce((s, m) => s + m.score, 0),
        answered: a.length,
        correct,
        incorrect: a.length - correct,
        accuracy: accuracy(correct, a.length),
        avgMs: a.length ? Math.round(a.reduce((s, x) => s + x.elapsed_ms, 0) / a.length) : 0,
        byTopic,
        byDiff,
        history,
        strongest,
        weakest,
        recent: (matches ?? []).slice(0, 8),
      };
    },
  });
