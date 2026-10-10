import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { syncRoomFn } from "@/lib/game.functions";

export type PublicRoom = {
  id: string;
  code: string;
  name: string;
  quiz_title: string;
  host_id: string | null;
  status: "lobby" | "countdown" | "question" | "reveal" | "finished";
  current_index: number;
  total_questions: number;
  phase_ends_at: string | null;
  question_duration_ms: number;
  answered_count: number;
  max_players: number;
  is_demo: boolean;
  current_question: { id: string; text: string; options: string[]; topic: string; difficulty: string; image_url: string | null; time_limit_sec: number } | null;
  reveal: { correct_index: number; explanation: string; distribution: number[]; correct_count: number; answered: number } | null;
};

export type PublicParticipant = {
  id: string;
  display_name: string;
  college_id: string | null;
  user_id: string | null;
  score: number;
  correct_count: number;
  answered_count: number;
  total_time_ms: number;
  rank: number | null;
  prev_rank: number | null;
  last_seen: string;
};

/** Live public room state (no answer keys). Realtime pushes trigger refetches. */
export function useRoom(code: string) {
  const qc = useQueryClient();
  const key = ["room", code];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data: room, error } = await supabase.from("rooms").select("*").eq("code", code).maybeSingle();
      if (error) throw error;
      if (!room) return null;
      const { data: ps } = await supabase.from("participants").select("*").eq("room_id", room.id);
      const participants = ((ps ?? []) as PublicParticipant[]).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || b.score - a.score || a.display_name.localeCompare(b.display_name));
      return { room: room as unknown as PublicRoom, participants };
    },
    refetchInterval: 4000, // safety net if a realtime event is missed
  });
  const roomId = q.data?.room.id;
  const [connected, setConnected] = useState(true);
  useEffect(() => {
    if (!roomId) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const bump = () => {
      clearTimeout(t);
      t = setTimeout(() => qc.invalidateQueries({ queryKey: key }), 120);
    };
    const ch = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `room_id=eq.${roomId}` }, bump)
      .subscribe((s) => setConnected(s === "SUBSCRIBED"));
    return () => {
      clearTimeout(t);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);
  return { ...q, connected };
}

/** Visual countdown from authoritative end time; pokes the server when a phase expires. */
export function usePhaseTimer(code: string, endsAt: string | null | undefined, offsetMs = 0) {
  const [now, setNow] = useState(() => Date.now());
  const poked = useRef<string | null>(null);
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(i);
  }, []);
  const remaining = endsAt ? Math.max(0, new Date(endsAt).getTime() - (now + offsetMs)) : 0;
  useEffect(() => {
    if (!endsAt || remaining > 0 || poked.current === endsAt) return;
    poked.current = endsAt;
    // small delay so the server's clock has definitely passed the deadline
    const t = setTimeout(() => {
      syncRoomFn({ data: { code } }).catch(() => {
        poked.current = null;
      });
    }, 450);
    return () => clearTimeout(t);
  }, [remaining, endsAt, code]);
  return remaining;
}

export function useServerOffset() {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    syncRoomFn({ data: { code: "XXXX" } })
      .then((r) => {
        const rtt = Date.now() - t0;
        setOffset(r.serverNow + rtt / 2 - Date.now());
      })
      .catch(() => {});
  }, []);
  return offset;
}

export const playerKey = (code: string) => `aq:player:${code}`;
export function loadCreds(code: string): { participantId: string; token: string } | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(playerKey(code)) ?? "null");
  } catch {
    return null;
  }
}
