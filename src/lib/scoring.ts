// Pure, shared game rules. Used by the server engine and shown to players.

export const BASE_POINTS = 1000;
export const MAX_SPEED_BONUS = 500;
/** Bounded network-delay allowance after the deadline (ms). */
export const NETWORK_GRACE_MS = 400;
export const COUNTDOWN_MS = 5000;
export const REVEAL_MS = 7000;
export const MAX_PLAYERS = 50;

export function speedBonus(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  const e = Math.min(Math.max(0, elapsedMs), durationMs);
  return Math.floor(MAX_SPEED_BONUS * Math.max(0, 1 - e / durationMs));
}

export function roundScore(correct: boolean, elapsedMs: number, durationMs: number): number {
  return correct ? BASE_POINTS + speedBonus(elapsedMs, durationMs) : 0;
}

export interface Rankable {
  id: string;
  score: number;
  correct_count: number;
  total_time_ms: number;
}

/** Tie-break: score desc, correct answers desc, aggregate accepted time asc. */
export function compareRank(a: Rankable, b: Rankable): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.correct_count !== a.correct_count) return b.correct_count - a.correct_count;
  if (a.total_time_ms !== b.total_time_ms) return a.total_time_ms - b.total_time_ms;
  return a.id.localeCompare(b.id);
}

export function rankPlayers<T extends Rankable>(players: T[]): T[] {
  return [...players].sort(compareRank);
}

/** Accuracy = correct / answered questions × 100 (unanswered questions are excluded). */
export function accuracy(correct: number, answered: number): number {
  if (answered <= 0) return 0;
  return Math.round((correct / answered) * 100);
}

/** Deterministic per-player option permutation. perm[displayIndex] = originalIndex. */
export function shuffleFor(seed: string, n: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  return perm;
}

export const TOPICS = {
  quant: "Quantitative Aptitude",
  logical: "Logical Reasoning",
  verbal: "Verbal Ability",
  di: "Data Interpretation",
} as const;
export type Topic = keyof typeof TOPICS;
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
