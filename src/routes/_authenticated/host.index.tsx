import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Radio } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRoom } from "@/lib/game.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/host/")({
  head: () => ({
    meta: [
      { title: "Host Dashboard — AptiQuiz" },
      { name: "description", content: "Create live competition rooms from your question sets and monitor them in real time." },
      { property: "og:title", content: "Host a live AptiQuiz competition" },
      { property: "og:description", content: "Pick a set, get a code, start the battle." },
    ],
  }),
  component: HostHome,
});

function HostHome() {
  const { user } = useAuth();
  const nav = useNavigate();
  const sets = useQuery({
    queryKey: ["sets-for-host"],
    queryFn: async () => (await supabase.from("question_sets").select("id, title, is_sample, status, questions(count)").order("is_sample")).data ?? [],
  });
  const rooms = useQuery({
    queryKey: ["my-rooms", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("rooms").select("code, name, status, created_at, total_questions").eq("host_id", user!.id).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });
  const [setId, setSetId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!setId) return toast.error("Pick a question set");
    setBusy(true);
    try {
      const r = await createRoom({ data: { setId, name: name || "AptiQuiz Battle" } });
      nav({ to: "/host/$code", params: { code: r.code } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Host Dashboard" subtitle="Create a room, share the code, and run the competition." actions={<Button variant="glass" asChild><Link to="/sets">Manage question sets</Link></Button>} />
      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <form onSubmit={create} className="glass space-y-4 p-5">
          <h2 className="font-semibold">New competition</h2>
          <div><Label htmlFor="nm">Competition name</Label><Input id="nm" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday Placement Showdown" /></div>
          <div>
            <Label htmlFor="st">Question set</Label>
            <select id="st" className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm" value={setId} onChange={(e) => setSetId(e.target.value)}>
              <option value="">Select a set…</option>
              {sets.data?.map((s) => {
                const n = (s.questions as unknown as { count: number }[])[0]?.count ?? 0;
                return <option key={s.id} value={s.id} disabled={!n}>{s.title} ({n} q{s.is_sample ? "" : `, ${s.status}`})</option>;
              })}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">Up to 50 players. Time limits come from each question.</p>
          <Button type="submit" variant="hero" className="w-full" disabled={busy}><Plus /> {busy ? "Creating…" : "Create room"}</Button>
        </form>
        <div className="glass p-5">
          <h2 className="mb-3 font-semibold">Your rooms</h2>
          {!rooms.data?.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground"><Radio className="mx-auto mb-2 size-6" />No rooms yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rooms.data.map((r) => (
                <li key={r.code} className="flex items-center gap-3 py-3">
                  <span className="font-display font-bold tracking-widest text-primary">{r.code}</span>
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{r.status}</span>
                  <Button size="sm" variant="glass" asChild><Link to="/host/$code" params={{ code: r.code }}>Open</Link></Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
