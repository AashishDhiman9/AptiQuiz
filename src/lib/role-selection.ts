export const APP_ROLES = ["player", "host"] as const;
export type AppRole = (typeof APP_ROLES)[number];

const PENDING_ROLE_KEY = "aptiquiz.pending-role";
const PENDING_ROLE_TTL_MS = 30 * 60 * 1000;

function isAppRole(value: unknown): value is AppRole {
  return value === "player" || value === "host";
}

export function setPendingRole(role: AppRole, now = Date.now()): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    PENDING_ROLE_KEY,
    JSON.stringify({ role, expiresAt: now + PENDING_ROLE_TTL_MS }),
  );
}

export function getPendingRole(now = Date.now()): AppRole | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PENDING_ROLE_KEY);
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" &&
      value !== null &&
      "role" in value &&
      "expiresAt" in value &&
      isAppRole(value.role) &&
      typeof value.expiresAt === "number" &&
      value.expiresAt > now &&
      value.expiresAt <= now + PENDING_ROLE_TTL_MS
    ) {
      return value.role;
    }
  } catch {
    // Invalid browser state is discarded below; it never grants application permissions.
  }

  window.localStorage.removeItem(PENDING_ROLE_KEY);
  return null;
}

export function consumePendingRole(now = Date.now()): AppRole | null {
  const role = getPendingRole(now);
  if (typeof window !== "undefined") window.localStorage.removeItem(PENDING_ROLE_KEY);
  return role;
}

export function clearPendingRole(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(PENDING_ROLE_KEY);
}
