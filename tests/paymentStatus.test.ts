import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PAID_STATUS } from "../src/lib/paymentStatus.ts";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("the paid status is one the database accepts", () => {
  const sql = read("../supabase/schema_safe.sql");
  const m = /create type public\.payment_status as enum \(([^)]*)\)/.exec(sql);
  assert.ok(m, "payment_status enum not found in schema_safe.sql");
  const labels = m[1].split(",").map((s) => s.trim().replace(/^'|'$/g, ""));
  assert.ok(labels.includes(PAID_STATUS), `"${PAID_STATUS}" is not one of: ${labels.join(", ")}`);
  assert.ok(labels.includes("pending"));
});

test("no payment code writes the old status word that the database refuses", () => {
  for (const file of ["../src/lib/payment-finalize.ts", "../src/app/api/premium/confirm/route.ts", "../src/app/api/payments/verify/route.ts", "../src/app/api/payments/webhook/route.ts", "../src/app/admin/payments/page.tsx"]) {
    const src = read(file);
    assert.ok(!/status\s*(===|!==|:)\s*"paid"/.test(src), `${file} still uses the status "paid"`);
    assert.ok(!/\.(eq|neq)\("status",\s*"paid"\)/.test(src), `${file} still filters on the status "paid"`);
  }
});

test("finalizing a payment uses the shared status for every status read and write", () => {
  const src = read("../src/lib/payment-finalize.ts");
  assert.ok(src.includes("PAID_STATUS"));
  assert.equal((src.match(/PAID_STATUS/g) ?? []).length >= 5, true);
});
