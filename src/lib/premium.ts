/**
 * The rules for "is this student Pro, and until when?" in one pure place (no imports, so `npm test` can check them).
 *
 * premium_until is the ONLY source of truth: a student is Pro while it is in the future. Every server route, and the
 * app, asks these functions instead of repeating the comparison, so they cannot drift apart.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Days of Pro each paid plan buys. Anything not listed here is NOT a plan (see planDays). */
export const PLAN_DAYS: Record<string, number> = { weekly: 7, monthly: 30, biannual: 180 };
/** "Lifetime" is a very long plan rather than a special case, so one rule (premium_until) covers everyone. */
export const LIFETIME_DAYS = 100 * 365;

/** Longest a free trial may run, whatever the admin setting says (a typo such as 3000 must not hand out years). */
export const MAX_TRIAL_DAYS = 30;

/** Days a plan buys, or null when the name is not a plan we sell. Never guesses: no silent 30 days, no silent lifetime. */
export function planDays(plan: unknown): number | null {
  if (typeof plan !== "string") return null;
  if (plan === "lifetime") return LIFETIME_DAYS;
  return Object.prototype.hasOwnProperty.call(PLAN_DAYS, plan) ? PLAN_DAYS[plan] : null;
}

/** Epoch ms of an expiry value, or null when it is empty or not a real date. */
export function untilMs(until: string | number | Date | null | undefined): number | null {
  if (until === null || until === undefined || until === "") return null;
  const t = new Date(until).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Pro while the end date is strictly in the future. No date, an unreadable date, or a past date → not Pro. */
export function isProActive(until: string | number | Date | null | undefined, now: number = Date.now()): boolean {
  const t = untilMs(until);
  return t !== null && t > now;
}

/**
 * New end date after buying `days` more: counted from the current end date while Pro is still running (the student
 * loses nothing by renewing early), otherwise from `now`. Returns an ISO string.
 */
export function extendedUntil(existing: string | number | Date | null | undefined, days: number, now: number = Date.now()): string {
  if (!Number.isFinite(days) || days <= 0) throw new Error("days must be a positive number");
  const cur = untilMs(existing);
  const base = cur !== null && cur > now ? cur : now;
  return new Date(base + days * DAY_MS).toISOString();
}

/** A free-trial length from the admin setting: whole days, at least 1, at most MAX_TRIAL_DAYS, 1 if unreadable. */
export function clampTrialDays(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_TRIAL_DAYS, Math.max(1, Math.floor(n)));
}

/** Longest a single timer may wait (browsers cap setTimeout at about 24.8 days; longer values fire immediately). */
export const MAX_TIMER_MS = 2_000_000_000;

/**
 * How long until the app should re-check this student's plan so an open app drops Pro the moment it ends (instead of
 * only on the next reload). null when there is nothing to wait for. Always at least 1 second, never more than
 * MAX_TIMER_MS — a longer wait is simply re-armed when the timer fires.
 */
export function msUntilExpiryCheck(until: string | number | Date | null | undefined, now: number): number | null {
  const t = untilMs(until);
  if (t === null || t <= now) return null;
  return Math.min(MAX_TIMER_MS, Math.max(1000, t - now + 1000));
}
