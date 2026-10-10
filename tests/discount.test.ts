import test from "node:test";
import assert from "node:assert/strict";
import { applyDiscount, isExpired, expiryFromDateInput, checkNewCode, codeStatus, describeDiscount, MIN_PAYABLE_KOBO } from "../src/lib/discount.ts";

const at = (iso: string) => Date.parse(iso);

test("a ₦200 code takes ₦200 off, not ₦2", () => {
  const r = applyDiscount(80_000, "fixed", 200); // ₦800 plan
  assert.equal(r.discountKobo, 20_000);
  assert.equal(r.payableKobo, 60_000);
});

test("percent codes", () => {
  assert.deepEqual(applyDiscount(80_000, "percent", 10), { discountKobo: 8_000, payableKobo: 72_000 });
  assert.deepEqual(applyDiscount(80_000, "percent", 50), { discountKobo: 40_000, payableKobo: 40_000 });
  // rounds to the nearest kobo, the same way in every place that uses it
  assert.equal(applyDiscount(17_000, "percent", 33).discountKobo, 5_610);
  assert.equal(applyDiscount(9_999, "percent", 15).discountKobo, 0); // already under the floor: nothing to take off
});

test("students never pay less than ₦100", () => {
  assert.equal(applyDiscount(80_000, "percent", 100).payableKobo, MIN_PAYABLE_KOBO);
  assert.equal(applyDiscount(80_000, "fixed", 5_000).payableKobo, MIN_PAYABLE_KOBO);
  // and the discount that is recorded is what was really taken off
  assert.equal(applyDiscount(80_000, "percent", 100).discountKobo, 70_000);
  assert.equal(applyDiscount(20_000, "fixed", 500).discountKobo, 10_000);
});

test("odd input is harmless", () => {
  assert.deepEqual(applyDiscount(80_000, "percent", -5), { discountKobo: 0, payableKobo: 80_000 });
  assert.deepEqual(applyDiscount(80_000, "percent", 250), { discountKobo: 70_000, payableKobo: MIN_PAYABLE_KOBO });
  assert.deepEqual(applyDiscount(NaN, "fixed", 200), { discountKobo: 0, payableKobo: MIN_PAYABLE_KOBO });
  assert.deepEqual(applyDiscount(80_000, "fixed", NaN), { discountKobo: 0, payableKobo: 80_000 });
});

test("a code works for the whole of its last day in Lagos", () => {
  const exp = expiryFromDateInput("2026-10-15")!;
  assert.equal(exp, "2026-10-15T22:59:59.000Z");
  assert.equal(isExpired(exp, at("2026-10-15T08:00:00Z")), false);
  assert.equal(isExpired(exp, at("2026-10-15T22:30:00Z")), false); // 23:30 in Lagos, still the 15th
  assert.equal(isExpired(exp, at("2026-10-15T23:30:00Z")), true); // 00:30 on the 16th in Lagos
  assert.equal(isExpired(exp, at("2026-10-16T09:00:00Z")), true);
});

test("codes saved with a midnight expiry also last through their date", () => {
  assert.equal(isExpired("2026-10-15T00:00:00Z", at("2026-10-15T14:00:00Z")), false);
  assert.equal(isExpired("2026-10-15T00:00:00Z", at("2026-10-16T14:00:00Z")), true);
});

test("no expiry, or a broken one, never expires", () => {
  assert.equal(isExpired(null), false);
  assert.equal(isExpired(undefined), false);
  assert.equal(isExpired("nonsense"), false);
});

test("expiry date box", () => {
  assert.equal(expiryFromDateInput(""), null);
  assert.equal(expiryFromDateInput("15/10/2026"), null);
  assert.equal(expiryFromDateInput("2026-13-45"), null);
});

const base: { code: string; kind: "percent" | "fixed"; value: string; maxUses: string; expires: string } = { code: "jamb 2026", kind: "percent", value: "10", maxUses: "", expires: "" };

test("the admin form accepts a good code and tidies it", () => {
  const r = checkNewCode(base);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.row, { code: "JAMB2026", kind: "percent", value: 10, max_uses: null, expires_at: null });
});

test("the admin form explains each mistake", () => {
  const err = (over: Partial<typeof base>) => { const r = checkNewCode({ ...base, ...over }); return r.ok ? "ok" : r.error; };
  assert.match(err({ code: "  " }), /Enter a code/);
  assert.match(err({ code: "ab" }), /at least 3/);
  assert.match(err({ code: "A$B!" }), /letters, numbers/);
  assert.match(err({ value: "" }), /percent/);
  assert.match(err({ value: "10abc" }), /percent/);
  assert.match(err({ value: "1.5" }), /whole number/);
  assert.match(err({ value: "0" }), /more than zero/);
  assert.match(err({ value: "101" }), /more than 100/);
  assert.match(err({ kind: "fixed", value: "abc" }), /naira/);
  assert.match(err({ maxUses: "abc" }), /Max uses/);
  assert.match(err({ maxUses: "0" }), /Max uses/);
  assert.match(err({ expires: "2020-01-01" }), /past/);
  assert.equal(err({ kind: "fixed", value: "200", maxUses: "50", expires: "2099-01-01" }), "ok");
});

test("a fixed code is stored in naira", () => {
  const r = checkNewCode({ ...base, kind: "fixed", value: "200", maxUses: "50" });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual([r.row.kind, r.row.value, r.row.max_uses], ["fixed", 200, 50]);
});

test("labels and status", () => {
  assert.equal(describeDiscount("percent", 10), "10% off");
  assert.equal(describeDiscount("fixed", 1500), "₦1,500 off");
  const now = at("2026-10-10T10:00:00Z");
  const c = { active: true, expires_at: null, max_uses: 5, used_count: 2 };
  assert.equal(codeStatus(c, now), "live");
  assert.equal(codeStatus({ ...c, active: false }, now), "off");
  assert.equal(codeStatus({ ...c, used_count: 5 }, now), "used-up");
  assert.equal(codeStatus({ ...c, expires_at: "2026-10-01T22:59:59Z" }, now), "expired");
});
