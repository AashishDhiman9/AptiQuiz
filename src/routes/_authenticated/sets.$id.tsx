import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DIFFICULTIES, TOPICS, type Topic } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sets/$id")({
  head: () => ({
    meta: [
      { title: "Edit Question Set — AptiQuiz" },
      { name: "description", content: "Edit questions, answers and settings for this set." },
      { property: "og:title", content: "Edit Question Set — AptiQuiz" },
      { property: "og:description", content: "Question set editor." },
    ],
  }),
  component: Editor,
});

const qSchema = z.object({
  text: z.string().trim().min(5, "Question text is required"),
  options: z.array(z.string().trim().min(1, "Every option needs text")).min(2).max(6),
  correct: z.number().int().min(0),
  topic: z.enum(["quant", "logical", "verbal", "di"]),
  difficulty: z.enum(DIFFICULTIES),
  time_limit_sec: z.number().int().min(5).max(120),
  explanation: z.string().max(1000),
  image_url: z.string().url().or(z.literal("")),
});
type Draft = z.infer<typeof qSchema> & { id?: string };
const blank = (): Draft => ({ text: "", options: ["", "", "", ""], correct: 0, topic: "quant", difficulty: "medium", time_limit_sec: 20, explanation: "", image_url: "" });

function Editor() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const data = useQuery({
    queryKey: ["set", id],
    queryFn: async () => {
      const [{ data: set, error }, { data: qs }] = await Promise.all([
        supabase.from("question_sets").select("*").eq("id", id).single(),
        supabase.from("questions").select("*").eq("set_id", id).order("position").order("created_at"),
      ]);
      if (error) throw error;
      const { data: keys } = await supabase.from("question_keys").select("*").in("question_id", (qs ?? []).map((q) => q.id));
      return { set, questions: (qs ?? []).map((q) => ({ ...q, correct: keys?.find((k) => k.question_id === q.id)?.correct_index ?? 0 })) };
    },
  });
  const [meta, setMeta] = useState({ title: "", description: "" });
  useEffect(() => {
    if (data.data) setMeta({ title: data.data.set.title, description: data.data.set.description });
  }, [data.data]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "q" | "set"; id: string } | null>(null);
  const [search, setSearch] = useState("");
  const [topicF, setTopicF] = useState<"all" | Topic>("all");
  const refresh = () => qc.invalidateQueries({ queryKey: ["set", id] });

  if (data.isLoading) return <div className="h-96 animate-pulse rounded-2xl bg-surface/60" />;
  if (data.error || !data.data) return <p className="text-destructive">Could not load this set.</p>;
  const { set, questions } = data.data;
  if (set.is_sample) return <p className="text-muted-foreground">Sample sets are read-only. Duplicate it from Question Sets to edit.</p>;

  async function saveMeta(status?: "draft" | "published") {
    if (meta.title.trim().length < 2) return toast.error("Title is required");
    if (status === "published" && !questions.length) return toast.error("Add at least one question before publishing");
    const { error } = await supabase.from("question_sets").update({ title: meta.title.trim(), description: meta.description, status: status ?? set.status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "published" ? "Published" : status === "draft" ? "Saved as draft" : "Saved");
    refresh();
    qc.invalidateQueries({ queryKey: ["sets"] });
  }

  async function saveQuestion(d: Draft) {
    const parsed = qSchema.safeParse(d);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (d.correct >= d.options.length) return toast.error("Pick the correct answer");
    if (new Set(d.options.map((o) => o.trim().toLowerCase())).size !== d.options.length) return toast.error("Options must be unique");
    const row = { text: d.text.trim(), options: d.options.map((o) => o.trim()), topic: d.topic, difficulty: d.difficulty, time_limit_sec: d.time_limit_sec, explanation: d.explanation, image_url: d.image_url || null };
    let qid = d.id;
    if (qid) {
      const { error } = await supabase.from("questions").update(row).eq("id", qid);
      if (error) return toast.error(error.message);
    } else {
      const { data: ins, error } = await supabase.from("questions").insert({ ...row, set_id: id, position: questions.length }).select("id").single();
      if (error) return toast.error(error.message);
      qid = ins.id;
    }
    const { error: kerr } = await supabase.from("question_keys").upsert({ question_id: qid!, correct_index: d.correct });
    if (kerr) return toast.error(kerr.message);
    setEditing(null);
    toast.success("Question saved");
    refresh();
  }

  async function move(i: number, dir: -1 | 1) {
    const a = questions[i], b = questions[i + dir];
    if (!a || !b) return;
    await Promise.all([
      supabase.from("questions").update({ position: i + dir }).eq("id", a.id),
      supabase.from("questions").update({ position: i }).eq("id", b.id),
    ]);
    // normalize positions
    await Promise.all(questions.map((q, j) => (q.id === a.id || q.id === b.id ? null : supabase.from("questions").update({ position: j }).eq("id", q.id))));
    refresh();
  }

  async function doDelete() {
    if (!confirm) return;
    if (confirm.kind === "q") {
      await supabase.from("questions").delete().eq("id", confirm.id);
      refresh();
    } else {
      await supabase.from("question_sets").delete().eq("id", confirm.id);
      qc.invalidateQueries({ queryKey: ["sets"] });
      nav({ to: "/sets" });
    }
    setConfirm(null);
    toast.success("Deleted");
  }

  const toDraft = (q: (typeof questions)[number]): Draft => ({ id: q.id, text: q.text, options: q.options as string[], correct: q.correct, topic: q.topic as Topic, difficulty: q.difficulty as Draft["difficulty"], time_limit_sec: q.time_limit_sec, explanation: q.explanation, image_url: q.image_url ?? "" });
  const shown = questions.filter((q) => (topicF === "all" || q.topic === topicF) && q.text.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <Link to="/sets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> All sets</Link>
      <div className="glass space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase", set.status === "published" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>{set.status}</span>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirm({ kind: "set", id })}><Trash2 /> Delete set</Button>
            <Button variant="glass" size="sm" onClick={() => saveMeta("draft")}>Save draft</Button>
            <Button variant="hero" size="sm" onClick={() => saveMeta("published")}>Publish</Button>
          </div>
        </div>
        <div><Label htmlFor="t">Title</Label><Input id="t" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} /></div>
        <div><Label htmlFor="d">Description</Label><Textarea id="d" value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} /></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold">Questions ({questions.length})</h2>
        <Input className="w-48" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter topic" className="h-10 rounded-md border border-input bg-surface px-3 text-sm" value={topicF} onChange={(e) => setTopicF(e.target.value as "all" | Topic)}>
          <option value="all">All topics</option>
          {Object.entries(TOPICS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button variant="hero" onClick={() => setEditing(blank())}><Plus /> Add question</Button>
      </div>

      {!shown.length ? (
        <div className="glass p-10 text-center text-muted-foreground">No questions yet.</div>
      ) : (
        <ol className="space-y-2">
          {shown.map((q) => {
            const i = questions.indexOf(q);
            return (
              <li key={q.id} className="glass flex items-start gap-3 p-4">
                <span className="tabular mt-0.5 w-6 text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{q.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{TOPICS[q.topic as Topic]} · {q.difficulty} · {q.time_limit_sec}s · answer: {(q.options as string[])[q.correct]}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                  <Button size="icon" variant="ghost" aria-label="Move down" disabled={i === questions.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                  <Button size="icon" variant="ghost" aria-label="Preview" onClick={() => setPreview(toDraft(q))}><Eye /></Button>
                  <Button size="icon" variant="ghost" aria-label="Duplicate" onClick={() => saveQuestion({ ...toDraft(q), id: undefined })}><Copy /></Button>
                  <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditing(toDraft(q))}><Pencil /></Button>
                  <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => setConfirm({ kind: "q", id: q.id })}><Trash2 /></Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-surface sm:max-w-xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit question" : "New question"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label htmlFor="qt">Question</Label><Textarea id="qt" value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} /></div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Options (select the correct one)</legend>
                {editing.options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="radio" name="correct" aria-label={`Option ${i + 1} correct`} checked={editing.correct === i} onChange={() => setEditing({ ...editing, correct: i })} className="size-4 accent-[var(--primary)]" />
                    <Input value={o} placeholder={`Option ${String.fromCharCode(65 + i)}`} onChange={(e) => setEditing({ ...editing, options: editing.options.map((x, j) => (j === i ? e.target.value : x)) })} />
                    {editing.options.length > 2 && (
                      <Button size="icon" variant="ghost" aria-label="Remove option" onClick={() => setEditing({ ...editing, options: editing.options.filter((_, j) => j !== i), correct: editing.correct === i ? 0 : editing.correct > i ? editing.correct - 1 : editing.correct })}><Trash2 /></Button>
                    )}
                  </div>
                ))}
                {editing.options.length < 6 && <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, options: [...editing.options, ""] })}><Plus /> Add option</Button>}
              </fieldset>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Topic</Label>
                  <select className="h-10 w-full rounded-md border border-input bg-surface px-2 text-sm" value={editing.topic} onChange={(e) => setEditing({ ...editing, topic: e.target.value as Topic })}>
                    {Object.entries(TOPICS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div><Label>Difficulty</Label>
                  <select className="h-10 w-full rounded-md border border-input bg-surface px-2 text-sm capitalize" value={editing.difficulty} onChange={(e) => setEditing({ ...editing, difficulty: e.target.value as Draft["difficulty"] })}>
                    {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div><Label htmlFor="tl">Time (sec)</Label><Input id="tl" type="number" min={5} max={120} value={editing.time_limit_sec} onChange={(e) => setEditing({ ...editing, time_limit_sec: Number(e.target.value) })} /></div>
              </div>
              <div><Label htmlFor="ex">Explanation</Label><Textarea id="ex" value={editing.explanation} onChange={(e) => setEditing({ ...editing, explanation: e.target.value })} /></div>
              <div><Label htmlFor="img">Image or table URL (optional)</Label><Input id="img" placeholder="https://…" value={editing.image_url} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="hero" onClick={() => editing && saveQuestion(editing)}>Save question</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="border-border bg-surface sm:max-w-lg">
          <DialogHeader><DialogTitle>Player preview</DialogTitle></DialogHeader>
          {preview && (
            <div>
              <p className="text-xs text-muted-foreground">{TOPICS[preview.topic]} · {preview.difficulty} · {preview.time_limit_sec}s</p>
              <p className="mt-2 text-lg font-semibold">{preview.text}</p>
              {preview.image_url && <img src={preview.image_url} alt="Question attachment" className="mt-3 max-h-48 rounded-lg" />}
              <div className="mt-4 space-y-2">
                {preview.options.map((o, i) => <div key={i} className={cn("rounded-lg border border-border px-4 py-3", i === preview.correct && "border-success/60 bg-success/10")}>{String.fromCharCode(65 + i)}. {o}</div>)}
              </div>
              {preview.explanation && <p className="mt-3 text-sm text-muted-foreground">{preview.explanation}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="border-border bg-surface">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.kind === "set" ? "Delete this whole set?" : "Delete this question?"}</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
