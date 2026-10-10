/**
 * Discount-code rules, in one place so the admin page, the price preview and both checkouts agree.
 *
 * Pure (no React, no database, no imports from other app files) so `npm test` can check the maths.
 *
 * Units: `value` is a percent (1–100) for percent codes and whole NAIRA for fixed codes — that is what the
 * admin page asks for ("₦ off", e.g. 200). The old checkout read it as kobo, so a ₦200 code took off ₦2.
 */

/** Paystack on this merchant refuses charges under ₦100, so a discount never takes the price below that */
export const MIN_PAYABLE_KOBO = 10_000;

export type DiscountKind = "percent" | "fixed";

export type DiscountMath = {
  /** what is actually taken off, in kobo (already limited so the price stays at or above the floor) */
  discountKobo: number;
  /** what the student pays, in kobo */
  payableKobo: number;
};

/** Price after a code. Percent is rounded to the nearest kobo; the same function is used everywhere. */
export function applyDiscount(baseKobo: number, kind: DiscountKind, value: number): DiscountMath {
  const base = Math.max(0, Math.round(Number.isFinite(baseKobo) ? baseKobo : 0));
  const v = Number.isFinite(value) ? Math.max(0, value) : 0;
  const raw = kind === "percent" ? Math.round((base * Math.min(100, v)) / 100) : Math.round(v * 100);
  const room = Math.max(0, base - MIN_PAYABLE_KOBO);
  const discountKobo = Math.min(raw, room);
  return { discountKobo, payableKobo: Math.max(MIN_PAYABLE_KOBO, base - discountKobo) };
}

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" });
const lagosDay = (t: number | string | Date): string => dayFmt.format(typeof t === "object" ? t : new Date(t));

/**
 * A code stays usable for the whole of its last day (Lagos time). Comparing days, not moments, also keeps codes
 * that were saved with a midnight expiry working through that day.
 */
export function isExpired(expiresAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return lagosDay(t) < lagosDay(now);
}

/** "2026-10-15" from the date box → the last second of that day in Lagos, as an ISO string */
export function expiryFromDateInput(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const iso = new Date(`${date}T23:59:59+01:00`);
  return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
}

export type NewCodeInput = { code: string; kind: DiscountKind; value: string; maxUses: string; expires: string };
export type NewCodeCheck =
  | { ok: true; row: { code: string; kind: DiscountKind; value: number; max_uses: number | null; expires_at: string | null } }
  | { ok: false; error: string };

/** Check what the admin typed before it goes to the database, with a plain message for each mistake */
export function checkNewCode(input: NewCodeInput, now: number = Date.now()): NewCodeCheck {
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "");
  if (!code) return { ok: false, error: "Enter a code name." };
  if (code.length < 3) return { ok: false, error: "Make the code at least 3 characters." };
  if (!/^[A-Z0-9_-]+$/.test(code)) return { ok: false, error: "Use only letters, numbers, - or _ in the code." };

  const valueText = input.value.trim();
  if (!/^\d+$/.test(valueText)) return { ok: false, error: input.kind === "percent" ? "Enter the percent as a whole number, like 10." : "Enter the naira amount as a whole number, like 200." };
  const value = Number(valueText);
  if (value <= 0) return { ok: false, error: "The discount must be more than zero." };
  if (input.kind === "percent" && value > 100) return { ok: false, error: "A percent can't be more than 100." };
  if (input.kind === "fixed" && value > 1_000_000) return { ok: false, error: "That naira amount is too big." };

  let max_uses: number | null = null;
  const maxText = input.maxUses.trim();
  if (maxText) {
    if (!/^\d+$/.test(maxText) || Number(maxText) < 1) return { ok: false, error: "Max uses must be a whole number of 1 or more, or left empty for no limit." };
    max_uses = Number(maxText);
  }

  let expires_at: string | null = null;
  if (input.expires) {
    expires_at = expiryFromDateInput(input.expires);
    if (!expires_at) return { ok: false, error: "That expiry date isn't valid." };
    if (isExpired(expires_at, now)) return { ok: false, error: "The expiry date is already in the past." };
  }
  return { ok: true, row: { code, kind: input.kind, value, max_uses, expires_at } };
}

/** The label on the admin list and in messages: "10% off" or "₦200 off" */
export function describeDiscount(kind: DiscountKind, value: number): string {
  return kind === "percent" ? `${value}% off` : `₦${value.toLocaleString("en-NG")} off`;
}

export type CodeStatus = "live" | "off" | "expired" | "used-up";

export function codeStatus(c: { active: boolean; expires_at: string | null; max_uses: number | null; used_count: number }, now: number = Date.now()): CodeStatus {
  if (!c.active) return "off";
  if (isExpired(c.expires_at, now)) return "expired";
  if (c.max_uses !== null && c.used_count >= c.max_uses) return "used-up";
  return "live";
}
