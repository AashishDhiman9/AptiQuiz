// Client-side read helpers (RLS applies). Shared query options.
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const collegesQuery = queryOptions({
  queryKey: ["colleges"],
  queryFn: async () => {
    const { data, error } = await supabase.from("colleges").select("*").order("name");
    if (error) throw error;
    return data;
  },
  staleTime: 5 * 60_000,
});

export type Period = "all" | "30d" | "7d";

/** League policy: sum of each college's top 5 individual match scores from finished matches in the period. */
export const leagueQuery = (period: Period) =>
  queryOptions({
    queryKey: ["league", period],
    queryFn: async () => {
      let q = supabase
        .from("participants")
        .select("id, display_name, score, correct_count, answered_count, college_id, user_id, rooms!inner(id, name, status, finished_at, is_demo)")
        .eq("rooms.status", "finished")
        .not("college_id", "is", null);
      if (period !== "all") {
        const days = period === "7d" ? 7 : 30;
        q = q.gte("rooms.finished_at", new Date(Date.now() - days * 864e5).toISOString());
      }
      const [{ data, error }, { data: colleges }] = await Promise.all([q, supabase.from("colleges").select("*")]);
      if (error) throw error;
      const rows = data ?? [];
      const standings = (colleges ?? [])
        .map((c) => {
          const mine = rows.filter((r) => r.college_id === c.id).sort((a, b) => b.score - a.score);
          return {
            college: c,
            points: mine.slice(0, 5).reduce((s, r) => s + r.score, 0),
            entries: mine.length,
            players: new Set(mine.map((r) => r.user_id ?? r.display_name)).size,
            hasDemo: mine.some((r) => (r.rooms as { is_demo: boolean }).is_demo),
            top: mine.slice(0, 5),
          };
        })
        .sort((a, b) => b.points - a.points);
      const players = [...rows].sort((a, b) => b.score - a.score).slice(0, 25);
      return { standings, players };
    },
  });

export const topPlayersQuery = queryOptions({
  queryKey: ["top-players"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("participants")
      .select("id, display_name, score, correct_count, answered_count, rank, prev_rank, college_id, rooms!inner(name, status, is_demo, finished_at)")
      .eq("rooms.status", "finished")
      .order("score", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data;
  },
});
