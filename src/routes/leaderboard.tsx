import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, DemoBadge } from "@/components/AppShell";
import { Leaderboard } from "@/components/Leaderboard";
import { Button } from "@/components/ui/button";
import { collegesQuery, topPlayersQuery } from "@/lib/data";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — AptiQuiz" },
      { name: "description", content: "Top individual match scores across completed AptiQuiz competitions." },
      { property: "og:title", content: "AptiQuiz Leaderboard" },
      { property: "og:description", content: "Highest scores from completed competitions." },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const top = useQuery(topPlayersQuery);
  const colleges = useQuery(collegesQuery);
  const colName = (id: string | null) => colleges.data?.find((c) => c.id === id)?.short_name ?? null;
  return (
    <div>
      <PageHeader title="Live Leaderboard" subtitle="Best single-match scores from completed competitions. For a live game, open its spectator screen." actions={<Button variant="glass" asChild><Link to="/spectate">Watch a live room</Link></Button>} />
      <div className="glass p-4">
        <div className="mb-2 flex justify-end">{top.data?.some((r) => (r.rooms as { is_demo: boolean }).is_demo) && <DemoBadge />}</div>
        {top.isLoading ? <div className="h-96 animate-pulse rounded-xl bg-surface/60" /> : top.error ? <p className="text-destructive">Could not load.</p> : (
          <Leaderboard showAccuracy rows={(top.data ?? []).map((r, i) => ({ ...r, rank: i + 1, prev_rank: null, college: `${colName(r.college_id) ?? ""}${colName(r.college_id) ? " · " : ""}${(r.rooms as { name: string }).name}` }))} />
        )}
      </div>
    </div>
  );
}
