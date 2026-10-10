// Authoritative game engine. Server-only: uses the privileged client.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { COUNTDOWN_MS, REVEAL_MS, rankPlayers } from "./scoring";

export const db = () => supabaseAdmin;

export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomToken(): string {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => chars[b % chars.length]).join("");
}

export type RoomRow = {
  id: string;
  code: string;
  host_id: string | null;
  set_id: string | null;
  status: string;
  current_index: number;
  total_questions: number;
  phase_ends_at: string | null;
  phase_started_at: string | null;
  question_duration_ms: number;
  current_question: unknown;
  reveal: unknown;
  answered_count: number;
};

export async function getRoomByCode(code: string): Promise<RoomRow | null> {
  const { data } = await db().from("rooms").select("*").eq("code", code.toUpperCase().trim()).maybeSingle();
  return (data as RoomRow) ?? null;
}

export async function verifyParticipant(roomId: string, participantId: string, token: string) {
  const { data: p } = await db().from("participants").select("*").eq("id", participantId).eq("room_id", roomId).maybeSingle();
  if (!p) return null;
  const { data: s } = await db().from("participant_secrets").select("token_hash").eq("participant_id", participantId).maybeSingle();
  if (!s || s.token_hash !== (await sha256(token))) return null;
  return p;
}

async function loadQuestion(setId: string, index: number) {
  const { data } = await db()
    .from("questions")
    .select("*")
    .eq("set_id", setId)
    .order("position")
    .order("created_at")
    .range(index, index);
  return data?.[0] ?? null;
}

async function startQuestion(room: RoomRow, index: number) {
  const q = room.set_id ? await loadQuestion(room.set_id, index) : null;
  if (!q) return finish(room);
  const now = Date.now();
  const dur = q.time_limit_sec * 1000;
  await db()
    .from("rooms")
    .update({
      status: "question",
      current_index: index,
      phase_started_at: new Date(now).toISOString(),
      phase_ends_at: new Date(now + dur).toISOString(),
      question_duration_ms: dur,
      answered_count: 0,
      reveal: null,
      current_question: {
        id: q.id,
        text: q.text,
        options: q.options,
        topic: q.topic,
        difficulty: q.difficulty,
        image_url: q.image_url,
        time_limit_sec: q.time_limit_sec,
      },
    })
    .eq("id", room.id)
    .eq("status", room.status)
    .eq("current_index", room.current_index);
}

export async function revealQuestion(room: RoomRow) {
  const cq = room.current_question as { id: string; options: string[] } | null;
  if (!cq) return;
  const { data: key } = await db().from("question_keys").select("correct_index").eq("question_id", cq.id).maybeSingle();
  const { data: q } = await db().from("questions").select("explanation").eq("id", cq.id).maybeSingle();
  const { data: ans } = await db()
    .from("answers")
    .select("choice_index, correct")
    .eq("room_id", room.id)
    .eq("question_index", room.current_index);
  const dist = cq.options.map(() => 0);
  let correctN = 0;
  for (const a of ans ?? []) {
    if (a.choice_index != null && a.choice_index < dist.length) dist[a.choice_index]++;
    if (a.correct) correctN++;
  }
  const now = Date.now();
  const { data: updated } = await db()
    .from("rooms")
    .update({
      status: "reveal",
      phase_started_at: new Date(now).toISOString(),
      phase_ends_at: new Date(now + REVEAL_MS).toISOString(),
      reveal: {
        correct_index: key?.correct_index ?? -1,
        explanation: q?.explanation ?? "",
        distribution: dist,
        correct_count: correctN,
        answered: (ans ?? []).length,
      },
    })
    .eq("id", room.id)
    .eq("status", "question")
    .eq("current_index", room.current_index)
    .select("id");
  if (!updated?.length) return; // another caller already revealed
  await recomputeRanks(room.id);
}

export async function recomputeRanks(roomId: string) {
  const { data: ps } = await db().from("participants").select("id, score, correct_count, total_time_ms, rank").eq("room_id", roomId);
  const ranked = rankPlayers(ps ?? []);
  await Promise.all(
    ranked.map((p, i) =>
      db()
        .from("participants")
        .update({ prev_rank: p.rank ?? i + 1, rank: i + 1 })
        .eq("id", p.id),
    ),
  );
}

async function finish(room: RoomRow) {
  await db()
    .from("rooms")
    .update({ status: "finished", phase_ends_at: null, finished_at: new Date().toISOString() })
    .eq("id", room.id)
    .neq("status", "finished");
}

export async function beginCountdown(room: RoomRow) {
  const now = Date.now();
  await db()
    .from("rooms")
    .update({
      status: "countdown",
      phase_started_at: new Date(now).toISOString(),
      phase_ends_at: new Date(now + COUNTDOWN_MS).toISOString(),
    })
    .eq("id", room.id)
    .eq("status", "lobby");
}

/** Advance the state machine based on server time only. Idempotent. */
export async function syncRoom(room: RoomRow, force = false): Promise<void> {
  const expired = room.phase_ends_at ? Date.now() >= new Date(room.phase_ends_at).getTime() : false;
  if (!expired && !force) return;
  if (room.status === "countdown") return startQuestion(room, 0);
  if (room.status === "question") return revealQuestion(room);
  if (room.status === "reveal") {
    if (room.current_index + 1 >= room.total_questions) return finish(room);
    return startQuestion(room, room.current_index + 1);
  }
}

export { finish as finishRoom };
