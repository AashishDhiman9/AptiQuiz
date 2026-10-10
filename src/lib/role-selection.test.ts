import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPendingRole,
  consumePendingRole,
  getPendingRole,
  setPendingRole,
} from "./role-selection";

describe("pending role selection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores a validated role for the auth redirect", () => {
    setPendingRole("host", 1000);
    expect(getPendingRole(1001)).toBe("host");
  });

  it("consumes a role once after authentication", () => {
    setPendingRole("player", 1000);
    expect(consumePendingRole(1001)).toBe("player");
    expect(getPendingRole(1002)).toBeNull();
  });

  it("discards malformed, expired, and unsupported browser state", () => {
    localStorage.setItem(
      "aptiquiz.pending-role",
      JSON.stringify({ role: "admin", expiresAt: 5000 }),
    );
    expect(getPendingRole(1000)).toBeNull();
    expect(localStorage.getItem("aptiquiz.pending-role")).toBeNull();

    setPendingRole("host", 1000);
    expect(getPendingRole(31 * 60 * 1000)).toBeNull();
  });

  it("clears a pending role when the user signs out", () => {
    setPendingRole("host");
    clearPendingRole();
    expect(getPendingRole()).toBeNull();
  });
});
