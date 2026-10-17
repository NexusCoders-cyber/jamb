import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  clampTrialDays, DAY_MS, extendedUntil, isProActive, LIFETIME_DAYS, MAX_TIMER_MS, MAX_TRIAL_DAYS,
  msUntilExpiryCheck, planDays, untilMs,
} from "../src/lib/premium.ts";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);

test("planDays knows the plans we sell and never guesses the rest", () => {
  assert.equal(planDays("weekly"), 7);
  assert.equal(planDays("monthly"), 30);
  assert.equal(planDays("biannual"), 180);
  assert.equal(planDays("lifetime"), LIFETIME_DAYS);
  for (const bad of [null, undefined, "", "yearly", "WEEKLY", "constructor", "__proto__", 7, {}]) {
    assert.equal(planDays(bad), null, `planDays(${String(bad)}) must be null`);
  }
});

test("isProActive: only a future, readable end date counts", () => {
  assert.equal(isProActive(new Date(NOW + 1000).toISOString(), NOW), true);
  assert.equal(isProActive(new Date(NOW).toISOString(), NOW), false, "ending exactly now is over");
  assert.equal(isProActive(new Date(NOW - 1).toISOString(), NOW), false);
  assert.equal(isProActive(null, NOW), false);
  assert.equal(isProActive(undefined, NOW), false);
  assert.equal(isProActive("", NOW), false);
  assert.equal(isProActive("not a date", NOW), false);
  assert.equal(untilMs("not a date"), null);
});

test("extendedUntil counts from the current end date while Pro runs, otherwise from now", () => {
  const running = new Date(NOW + 3 * DAY_MS).toISOString();
  assert.equal(extendedUntil(running, 7, NOW), new Date(NOW + 10 * DAY_MS).toISOString());
  const expired = new Date(NOW - 3 * DAY_MS).toISOString();
  assert.equal(extendedUntil(expired, 7, NOW), new Date(NOW + 7 * DAY_MS).toISOString());
  assert.equal(extendedUntil(null, 30, NOW), new Date(NOW + 30 * DAY_MS).toISOString());
  assert.equal(extendedUntil("garbage", 30, NOW), new Date(NOW + 30 * DAY_MS).toISOString());
});

test("extendedUntil refuses nonsense day counts instead of writing a bad date", () => {
  for (const bad of [0, -1, NaN, Infinity]) assert.throws(() => extendedUntil(null, bad, NOW));
});

test("two purchases stack: weekly then monthly = 37 days", () => {
  const first = extendedUntil(null, planDays("weekly")!, NOW);
  const second = extendedUntil(first, planDays("monthly")!, NOW);
  assert.equal(second, new Date(NOW + 37 * DAY_MS).toISOString());
});

test("free-trial length is clamped to 1..30 whole days, 1 when unreadable", () => {
  assert.equal(clampTrialDays("3"), 3);
  assert.equal(clampTrialDays(undefined), 1);
  assert.equal(clampTrialDays("abc"), 1);
  assert.equal(clampTrialDays("0"), 1);
  assert.equal(clampTrialDays("-5"), 1);
  assert.equal(clampTrialDays("2.9"), 2);
  assert.equal(clampTrialDays("3000"), MAX_TRIAL_DAYS);
});

test("the expiry re-check timer is bounded and only exists while Pro runs", () => {
  assert.equal(msUntilExpiryCheck(null, NOW), null);
  assert.equal(msUntilExpiryCheck(new Date(NOW - 1000).toISOString(), NOW), null);
  assert.equal(msUntilExpiryCheck(new Date(NOW + 5000).toISOString(), NOW), 6000);
  assert.equal(msUntilExpiryCheck(new Date(NOW + 1).toISOString(), NOW), 1001, "never faster than about a second");
  assert.equal(msUntilExpiryCheck(new Date(NOW + LIFETIME_DAYS * DAY_MS).toISOString(), NOW), MAX_TIMER_MS, "far dates are capped and re-armed");
});

test("granting Pro goes through the atomic database function, with the old path only as a fallback", () => {
  const src = read("../src/lib/payment-finalize.ts");
  assert.ok(src.includes('rpc("grant_pro_for_payment"'));
  assert.ok(!/\?\?\s*"lifetime"/.test(src), "a payment with no plan must not default to lifetime");
  assert.ok(src.includes("planDays("), "the plan must be checked with planDays()");
  assert.ok(src.includes("Number.isFinite(Number(paidKobo))"), "an unreadable paid amount must count as unpaid");
});

test("the atomic grant SQL is service-role only and extends from the current end date", () => {
  const sql = read("../supabase/atomic_pro_grant.sql");
  assert.ok(/security definer/i.test(sql));
  assert.ok(/revoke all on function public\.grant_pro_for_payment\(uuid, integer, integer\) from public, anon, authenticated/.test(sql));
  assert.ok(/grant execute on function public\.grant_pro_for_payment\(uuid, integer, integer\) to service_role/.test(sql));
  assert.ok(/greatest\(coalesce\(premium_until, now\(\)\), now\(\)\)/.test(sql));
  assert.ok(/status <> 'success'/.test(sql), "must only claim a payment that is not already paid");
  assert.ok(/amount_kobo <= p_paid_kobo/.test(sql), "must refuse an underpaid payment");
});

test("every server check of Pro uses the shared rule, and the trial write repeats its own rules", () => {
  for (const file of ["../src/lib/pro-server.ts", "../src/app/api/device/check/route.ts", "../src/app/api/payments/trial/route.ts", "../src/lib/usePro.ts"]) {
    assert.ok(read(file).includes("isProActive("), `${file} should use isProActive()`);
  }
  const trial = read("../src/app/api/payments/trial/route.ts");
  assert.ok(trial.includes('.is("trial_used_at", null)'), "the trial write must only touch an account that never had a trial");
  assert.ok(trial.includes("clampTrialDays("));
  const access = read("../src/lib/pro-server.ts");
  assert.ok(!/if \(error \|\| !profile\) return \{ allowed: true \}/.test(access), "a missing profile must get the free rules, not full access");
});
