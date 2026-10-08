/**
 * Offline rules for the "one Pro licence per phone" check (pure functions, easy to test).
 *
 * The server decides who holds the licence. This phone keeps the last answer so Pro keeps working with no signal —
 * but not forever, and not in a way that can be gamed by going offline:
 *   - a phone that was told "not licensed" STAYS locked offline (airplane mode doesn't unlock a shared login);
 *   - a licensed phone may work offline for OFFLINE_GRACE_MS after its last online confirmation, then must reconnect once;
 *   - turning the clock back doesn't stretch that window (the phone remembers the latest time it has seen).
 */
export const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
export const CLOCK_SLACK_MS = 10 * 60 * 1000;

export type LicenseCache = { deviceId: string; licensed: boolean; checkedAt: number; seenAt: number };
export type OfflineVerdict = { licensed: boolean; needsVerify: boolean };

/** Accepts caches written by older versions (no timestamps): they get a fresh grace window starting now. */
export function normalizeCache(raw: unknown, now: number): LicenseCache | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<LicenseCache>;
  if (typeof r.deviceId !== "string" || typeof r.licensed !== "boolean") return null;
  const checkedAt = typeof r.checkedAt === "number" ? r.checkedAt : now;
  const seenAt = typeof r.seenAt === "number" ? r.seenAt : checkedAt;
  return { deviceId: r.deviceId, licensed: r.licensed, checkedAt, seenAt };
}

/** The latest time this phone has ever observed — never moves backwards. */
export function advanceClock(previousSeen: number | null | undefined, now: number): number {
  return Math.max(now, typeof previousSeen === "number" && Number.isFinite(previousSeen) ? previousSeen : 0);
}

export function offlineVerdict(cache: LicenseCache | null, deviceId: string, now: number): OfflineVerdict {
  if (!cache || cache.deviceId !== deviceId) return { licensed: false, needsVerify: true };
  if (cache.licensed === false) return { licensed: false, needsVerify: false }; // stays locked
  const trusted = advanceClock(cache.seenAt, now);
  if (trusted - now > CLOCK_SLACK_MS) return { licensed: false, needsVerify: true }; // clock was set back
  if (trusted - cache.checkedAt > OFFLINE_GRACE_MS) return { licensed: false, needsVerify: true };
  return { licensed: true, needsVerify: false };
}

const CLOCK_KEY = "qubit_clock";

/** Browser: current time, but never earlier than the latest time seen before (blocks "set the clock back" tricks). */
export function trustedNow(): number {
  const now = Date.now();
  try {
    const prev = Number(localStorage.getItem(CLOCK_KEY));
    const t = advanceClock(Number.isFinite(prev) ? prev : null, now);
    localStorage.setItem(CLOCK_KEY, String(t));
    return t;
  } catch {
    return now;
  }
}
