import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Stat, DemoBadge, Initials } from "@/components/AppShell";
import { leagueQuery } from "@/lib/data";

export const Route = createFileRoute("/leagues/$collegeId")({
  head: () => ({
    meta: [
      { title: "College Details — AptiQuiz League" },
      { name: "description", content: "League points, participation and top players for this college." },
      { property: "og:title", content: "College league details — AptiQuiz" },
      { property: "og:description", content: "College standing in the AptiQuiz league." },
    ],
  }),
  component: College,
});

function College() {
  const { collegeId } = Route.useParams();
  const q = useQuery(leagueQuery("all"));
  const idx = q.data?.standings.findIndex((s) => s.college.id === collegeId) ?? -1;
  const s = idx >= 0 ? q.data!.standings[idx] : null;
  if (q.isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-surface/60" />;
  if (!s) return <p>College not found.</p>;
  return (
    <div className="space-y-6">
      <Link to="/leagues" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Leagues</Link>
      <PageHeader title={s.college.name} subtitle={s.college.city} actions={s.hasDemo ? <DemoBadge /> : undefined} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="League rank" value={`#${idx + 1}`} />
        <Stat label="League points (top 5)" value={s.points.toLocaleString()} />
        <Stat label="Players · entries" value={`${s.players} · ${s.entries}`} />
      </div>
      <div className="glass p-5">
        <h2 className="mb-3 font-semibold">Counting scores</h2>
        {!s.top.length ? <p className="text-sm text-muted-foreground">No completed matches yet.</p> : (
          <ol className="space-y-2">
            {s.top.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl bg-surface/60 p-2.5"><span className="tabular w-5 text-muted-foreground">{i + 1}</span><Initials name={p.display_name} /><div className="flex-1"><div>{p.display_name}</div><div className="text-xs text-muted-foreground">{(p.rooms as { name: string }).name}</div></div><span className="tabular font-semibold">{p.score.toLocaleString()}</span></li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
