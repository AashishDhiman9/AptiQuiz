import { describe, it, expect } from "vitest";
import { roundScore, speedBonus, rankPlayers, accuracy, shuffleFor } from "./scoring";

describe("scoring rules", () => {
  it("correct instant answer earns 1500", () => {
    expect(roundScore(true, 0, 20000)).toBe(1500);
  });
  it("correct answer at half time earns 1250", () => {
    expect(roundScore(true, 10000, 20000)).toBe(1250);
  });
  it("incorrect answer earns 0", () => {
    expect(roundScore(false, 100, 20000)).toBe(0);
  });
  it("speed bonus floors and never negative", () => {
    expect(speedBonus(19999, 20000)).toBe(0);
    expect(speedBonus(30000, 20000)).toBe(0);
  });
  it("ties break on correct count then time", () => {
    const r = rankPlayers([
      { id: "a", score: 1000, correct_count: 1, total_time_ms: 900 },
      { id: "b", score: 1000, correct_count: 2, total_time_ms: 5000 },
      { id: "c", score: 1000, correct_count: 2, total_time_ms: 3000 },
    ]);
    expect(r.map((p) => p.id)).toEqual(["c", "b", "a"]);
  });
  it("accuracy excludes unanswered", () => {
    expect(accuracy(3, 4)).toBe(75);
    expect(accuracy(0, 0)).toBe(0);
  });
  it("shuffle is a permutation", () => {
    expect([...shuffleFor("x", 4)].sort()).toEqual([0, 1, 2, 3]);
  });
});
