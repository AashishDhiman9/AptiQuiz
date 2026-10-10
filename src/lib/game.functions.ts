import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  db,
  sha256,
  randomToken,
  randomCode,
  getRoomByCode,
  verifyParticipant,
  syncRoom,
  beginCountdown,
  revealQuestion,
  finishRoom,
  recomputeRanks,
  type RoomRow,
} from "./game.server";
import { MAX_PLAYERS, NETWORK_GRACE_MS, roundScore, shuffleFor } from "./scoring";

const codeSchema = z
  .string()
  .trim()
  .min(4)
  .max(8)
  .transform((s) => s.toUpperCase());
const creds = z.object({
  code: codeSchema,
  participantId: z.string().uuid(),
  token: z.string().min(10).max(100),
});

async function optionalUserId(): Promise<string | null> {
  const h = getRequestHeader("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const { data } = await db().auth.getUser(h.slice(7));
  return data.user?.id ?? null;
}

// ---------- Host ----------
export const createRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({ setId: z.string().uuid(), name: z.string().trim().min(2).max(80) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Authorization: caller must be able to read the set (own or sample) under RLS.
    const { data: set } = await context.supabase
      .from("question_sets")
      .select("id, title, status")
      .eq("id", data.setId)
      .maybeSingle();
    if (!set) throw new Error("Question set not found");
    const { count } = await db()
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("set_id", set.id);
    if (!count) throw new Error("This question set has no questions yet");
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const { data: room, error } = await db()
        .from("rooms")
        .insert({
          code,
          host_id: context.userId,
          set_id: set.id,
          name: data.name,
          quiz_title: set.title,
          total_questions: count,
          max_players: MAX_PLAYERS,
        })
        .select("code")
        .single();
      if (!error && room) return { code: room.code };
    }
    throw new Error("Could not allocate a room code, try again");
  });

async function hostRoom(code: string, userId: string): Promise<RoomRow> {
  const room = await getRoomByCode(code);
  if (!room) throw new Error("Room not found");
  if (room.host_id !== userId) throw new Error("Only the host can control this room");
  return room;
}

export const hostAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        code: codeSchema,
        action: z.enum(["start", "next", "end", "kick"]),
        participantId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const room = await hostRoom(data.code, context.userId);
    if (data.action === "start") {
      if (room.status !== "lobby") throw new Error("Game already started");
      const { count } = await db()
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("room_id", room.id);
      if (!count) throw new Error("Wait for at least one player to join");
      await beginCountdown(room);
    } else if (data.action === "next") {
      if (room.status === "question") await revealQuestion(room);
      else await syncRoom(room, true);
    } else if (data.action === "end") {
      if (room.status === "question") await revealQuestion(room);
      await recomputeRanks(room.id);
      await finishRoom(room);
    } else if (data.action === "kick" && data.participantId) {
      if (room.status !== "lobby") throw new Error("Players can only be removed in the lobby");
      await db().from("participants").delete().eq("id", data.participantId).eq("room_id", room.id);
    }
    return { ok: true };
  });

export const getHostReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ code: codeSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const room = await hostRoom(data.code, context.userId);
    const { data: qs } = await db()
      .from("questions")
      .select("id, text, topic, difficulty, position, options")
      .eq("set_id", room.set_id!)
      .order("position")
      .order("created_at");
    const { data: ans } = await db()
      .from("answers")
      .select("question_index, participant_id, correct, elapsed_ms, points, choice_index")
      .eq("room_id", room.id);
    const { data: ps } = await db()
      .from("participants")
      .select(
        "id, display_name, college_id, score, correct_count, answered_count, total_time_ms, rank",
      )
      .eq("room_id", room.id)
      .order("rank", { ascending: true, nullsFirst: false });
    const { data: keys } = await db()
      .from("question_keys")
      .select("question_id, correct_index")
      .in(
        "question_id",
        (qs ?? []).map((q) => q.id),
      );
    const questions = (qs ?? []).slice(0, room.total_questions).map((q, i) => {
      const a = (ans ?? []).filter((x) => x.question_index === i);
      const correct = a.filter((x) => x.correct).length;
      return {
        index: i,
        text: q.text,
        topic: q.topic,
        difficulty: q.difficulty,
        options: q.options as string[],
        correctIndex: keys?.find((k) => k.question_id === q.id)?.correct_index ?? -1,
        answered: a.length,
        correct,
        incorrectRate: a.length ? Math.round(((a.length - correct) / a.length) * 100) : 0,
        avgMs: a.length ? Math.round(a.reduce((s, x) => s + x.elapsed_ms, 0) / a.length) : 0,
      };
    });
    return { questions, participants: ps ?? [] };
  });

// ---------- Player ----------
export const joinRoom = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        code: codeSchema,
        displayName: z
          .string()
          .trim()
          .min(2, "Name too short")
          .max(24)
          .regex(/^[\w .-]+$/, "Letters, numbers, spaces, _ . - only"),
        collegeId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const room = await getRoomByCode(data.code);
    if (!room) return { error: "No room with that code. Check it and try again." } as const;
    if (room.status !== "lobby") return { error: "This competition has already started." } as const;
    const { count } = await db()
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id);
    if ((count ?? 0) >= MAX_PLAYERS) return { error: "This room is full (50 players)." } as const;
    const userId = await optionalUserId();
    const { data: p, error } = await db()
      .from("participants")
      .insert({
        room_id: room.id,
        display_name: data.displayName,
        college_id: data.collegeId ?? null,
        user_id: userId,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505")
        return { error: "That name is taken in this room. Pick another." } as const;
      throw new Error(error.message);
    }
    const token = randomToken();
    await db()
      .from("participant_secrets")
      .insert({ participant_id: p.id, token_hash: await sha256(token) });
    return { participantId: p.id, token, code: room.code } as const;
  });

export const syncRoomFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ code: codeSchema }).parse(d))
  .handler(async ({ data }) => {
    const room = await getRoomByCode(data.code);
    if (room) await syncRoom(room);
    return { serverNow: Date.now() };
  });

export const getPlayerState = createServerFn({ method: "POST" })
  .validator((d) => creds.parse(d))
  .handler(async ({ data }) => {
    let room = await getRoomByCode(data.code);
    if (!room) return { error: "Room not found" } as const;
    const me = await verifyParticipant(room.id, data.participantId, data.token);
    if (!me) return { error: "Session expired for this room" } as const;
    await syncRoom(room);
    room = (await getRoomByCode(data.code))!;
    await db().from("participants").update({ last_seen: new Date().toISOString() }).eq("id", me.id);
    const cq = room.current_question as {
      id: string;
      text: string;
      options: string[];
      topic: string;
      difficulty: string;
      image_url: string | null;
    } | null;
    let options: string[] = [];
    let perm: number[] = [];
    if (cq && (room.status === "question" || room.status === "reveal")) {
      perm = shuffleFor(me.id + cq.id, cq.options.length);
      options = perm.map((o) => cq.options[o]);
    }
    const { data: myAns } = await db()
      .from("answers")
      .select("choice_index, correct, points, elapsed_ms")
      .eq("participant_id", me.id)
      .eq("question_index", room.current_index)
      .maybeSingle();
    const reveal = room.reveal as {
      correct_index: number;
      explanation: string;
      distribution: number[];
    } | null;
    const toDisplay = (orig: number | null | undefined) =>
      orig == null ? null : perm.indexOf(orig);
    return {
      serverNow: Date.now(),
      status: room.status,
      currentIndex: room.current_index,
      total: room.total_questions,
      phaseEndsAt: room.phase_ends_at,
      durationMs: room.question_duration_ms,
      answeredCount: room.answered_count,
      question:
        cq && (room.status === "question" || room.status === "reveal") ? { ...cq, options } : null,
      myAnswer: myAns
        ? {
            displayChoice: toDisplay(myAns.choice_index),
            ...(room.status === "reveal" || room.status === "finished"
              ? { correct: myAns.correct, points: myAns.points, elapsedMs: myAns.elapsed_ms }
              : {}),
          }
        : null,
      reveal:
        reveal && room.status === "reveal"
          ? { correctDisplay: toDisplay(reveal.correct_index), explanation: reveal.explanation }
          : null,
    } as const;
  });

export const submitAnswer = createServerFn({ method: "POST" })
  .validator((d) =>
    creds
      .extend({ questionIndex: z.number().int().min(0), choice: z.number().int().min(0).max(9) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const receivedAt = Date.now(); // server receipt timestamp
    const room = await getRoomByCode(data.code);
    if (!room) return { accepted: false, reason: "Room not found" };
    const me = await verifyParticipant(room.id, data.participantId, data.token);
    if (!me) return { accepted: false, reason: "Unauthorized" };
    if (room.status !== "question") return { accepted: false, reason: "Round is closed" };
    if (room.current_index !== data.questionIndex)
      return { accepted: false, reason: "Wrong round" };
    const started = new Date(room.phase_started_at!).getTime();
    const ends = new Date(room.phase_ends_at!).getTime();
    if (receivedAt > ends + NETWORK_GRACE_MS) return { accepted: false, reason: "Time expired" };
    const cq = room.current_question as {
      id: string;
      options: string[];
      topic: string;
      difficulty: string;
    };
    if (data.choice >= cq.options.length) return { accepted: false, reason: "Invalid option" };
    const perm = shuffleFor(me.id + cq.id, cq.options.length);
    const original = perm[data.choice];
    const { data: key } = await db()
      .from("question_keys")
      .select("correct_index")
      .eq("question_id", cq.id)
      .maybeSingle();
    const correct = key?.correct_index === original;
    const elapsed = Math.min(Math.max(0, receivedAt - started), room.question_duration_ms);
    const points = roundScore(correct, elapsed, room.question_duration_ms);
    const { error } = await db().from("answers").insert({
      room_id: room.id,
      participant_id: me.id,
      user_id: me.user_id,
      question_id: cq.id,
      question_index: room.current_index,
      choice_index: original,
      correct,
      elapsed_ms: elapsed,
      points,
      topic: cq.topic,
      difficulty: cq.difficulty,
    });
    if (error)
      return {
        accepted: false,
        reason: error.code === "23505" ? "Already answered" : "Could not record answer",
      };
    await db()
      .from("participants")
      .update({
        score: me.score + points,
        correct_count: me.correct_count + (correct ? 1 : 0),
        answered_count: me.answered_count + 1,
        total_time_ms: Number(me.total_time_ms) + elapsed,
      })
      .eq("id", me.id);
    const [{ count: answered }, { count: players }] = await Promise.all([
      db()
        .from("answers")
        .select("id", { count: "exact", head: true })
        .eq("room_id", room.id)
        .eq("question_index", room.current_index),
      db().from("participants").select("id", { count: "exact", head: true }).eq("room_id", room.id),
    ]);
    await db()
      .from("rooms")
      .update({ answered_count: answered ?? 0 })
      .eq("id", room.id)
      .eq("current_index", room.current_index);
    if ((answered ?? 0) >= (players ?? 0)) await revealQuestion(room);
    return { accepted: true, reason: null, elapsedMs: elapsed };
  });

// ---------- Practice (solo, sample/own sets) ----------
export const checkPractice = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({ questionId: z.string().uuid(), choice: z.number().int().min(0).max(9) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: q } = await db()
      .from("questions")
      .select("id, set_id, explanation")
      .eq("id", data.questionId)
      .maybeSingle();
    if (!q) throw new Error("Question not found");
    const { data: set } = await db()
      .from("question_sets")
      .select("is_sample")
      .eq("id", q.set_id)
      .maybeSingle();
    if (!set?.is_sample) throw new Error("Practice is available for sample sets only");
    const { data: key } = await db()
      .from("question_keys")
      .select("correct_index")
      .eq("question_id", q.id)
      .maybeSingle();
    return {
      correct: key?.correct_index === data.choice,
      correctIndex: key?.correct_index ?? -1,
      explanation: q.explanation,
    };
  });
