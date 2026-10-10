import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Plus, Search, Library } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/sets/")({
  head: () => ({
    meta: [
      { title: "Question Sets — AptiQuiz" },
      { name: "description", content: "Author, organize and publish aptitude question sets." },
      { property: "og:title", content: "Question Sets — AptiQuiz" },
      { property: "og:description", content: "Author and publish aptitude question sets." },
    ],
  }),
  component: SetsPage,
});

function SetsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "published" | "sample">("all");
  const sets = useQuery({
    queryKey: ["sets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("question_sets").select("*, questions(count)").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function create() {
    if (!user) return;
    const { data, error } = await supabase.from("question_sets").insert({ owner_id: user.id, title: "Untitled set" }).select("id").single();
    if (error) return toast.error(error.message);
    nav({ to: "/sets/$id", params: { id: data.id } });
  }

  async function duplicate(id: string) {
    if (!user) return;
    const { data: src } = await supabase.from("question_sets").select("*").eq("id", id).single();
    const { data: qs } = await supabase.from("questions").select("*").eq("set_id", id).order("position");
    const { data: keys } = await supabase.from("question_keys").select("*").in("question_id", (qs ?? []).map((x) => x.id));
    if (!src) return;
    const { data: ns, error } = await supabase.from("question_sets").insert({ owner_id: user.id, title: `${src.title.replace(" (Sample)", "")} (copy)`, description: src.description }).select("id").single();
    if (error) return toast.error(error.message);
    for (const x of qs ?? []) {
      const { data: nq } = await supabase
        .from("questions")
        .insert({ set_id: ns.id, position: x.position, text: x.text, options: x.options, topic: x.topic, difficulty: x.difficulty, time_limit_sec: x.time_limit_sec, explanation: x.explanation, image_url: x.image_url })
        .select("id")
        .single();
      const k = keys?.find((k) => k.question_id === x.id);
      if (nq) await supabase.from("question_keys").insert({ question_id: nq.id, correct_index: k?.correct_index ?? 0 });
    }
    toast.success("Set duplicated");
    qc.invalidateQueries({ queryKey: ["sets"] });
  }

  const rows = (sets.data ?? []).filter((s) => {
    if (q && !s.title.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "sample") return s.is_sample;
    if (filter !== "all") return s.status === filter && !s.is_sample;
    return true;
  });

  return (
    <div>
      <PageHeader title="Question Sets" subtitle="Create, edit and publish sets. Answer keys are stored privately." actions={<Button variant="hero" onClick={create}><Plus /> New set</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search sets" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {(["all", "draft", "published", "sample"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "glass"} size="sm" className="h-10 capitalize" onClick={() => setFilter(f)}>{f}</Button>
        ))}
      </div>
      {sets.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface/60" />)}</div>
      ) : !rows.length ? (
        <div className="glass p-10 text-center"><Library className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 text-muted-foreground">No sets match. Create your first one.</p></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((s) => {
            const count = (s.questions as unknown as { count: number }[])[0]?.count ?? 0;
            return (
              <div key={s.id} className="glass flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{s.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${s.is_sample ? "bg-warning/10 text-warning" : s.status === "published" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{s.is_sample ? "sample" : s.status}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description || "No description"}</p>
                <div className="mt-auto flex items-center justify-between pt-4 text-sm">
                  <span className="text-muted-foreground">{count} questions</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => duplicate(s.id)}><Copy /> Duplicate</Button>
                    {!s.is_sample && <Button size="sm" variant="glass" asChild><Link to="/sets/$id" params={{ id: s.id }}>Edit</Link></Button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
