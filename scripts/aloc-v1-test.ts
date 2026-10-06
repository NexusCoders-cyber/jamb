/**
 * ALOC v1 client tests — no network, no real key. Run with:
 *
 *   npx tsx scripts/aloc-v1-test.ts
 *
 * A fake ALOC server (replacing global fetch) proves the behaviours that matter:
 * off-by-default, correct requests, answer mapping, validation, rate limiting,
 * 429/401/500 handling, the circuit breaker, and that the key never leaks.
 */
import assert from "node:assert/strict";
import {
  SlidingWindowLimiter, __resetV1ForTests, mapV1Question, resolveV1Subject, runV1Diagnostics, tryV1Questions, v1Enabled,
} from "../src/lib/aloc-v1";

const KEY = "aloc_TEST_KEY_do_not_leak_123";
const origFetch = globalThis.fetch;
const origWarn = console.warn;

type Call = { url: string; method: string; headers: Record<string, string>; body?: Record<string, unknown> };
let calls: Call[] = [];
let handler: (c: Call) => Response | Promise<Response> = () => new Response("{}", { status: 500 });

globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries((init.headers ?? {}) as Record<string, string>)) headers[k.toLowerCase()] = String(v);
  const call: Call = { url: String(input), method: init.method ?? "GET", headers, body: init.body ? JSON.parse(String(init.body)) : undefined };
  calls.push(call);
  return handler(call);
}) as typeof fetch;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const SUBJECTS = {
  data: [
    { name: "mathematics", displayName: "Mathematics", code: "MTH", aliases: ["maths", "math"] },
    { name: "physics", displayName: "Physics", code: "PHY" },
    { name: "chemistry", displayName: "Chemistry", code: "CHM" },
    { name: "english", displayName: "English Language", code: "ENG", aliases: ["use of english"] },
    { name: "literature-in-english", displayName: "Literature in English", code: "LIT" },
  ],
};

const q = (i: number, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: `id-${i}`,
  text: `Question ${i}: what is ${i} + 1?`,
  options: { a: `${i}`, b: `${i + 1}`, c: `${i + 2}`, d: `${i + 3}` },
  correctAnswer: "b",
  examType: "jamb",
  subject: "mathematics",
  year: 2019,
  country: "NG",
  ...over,
});
const paper = (n: number, over: (i: number) => Record<string, unknown> = () => ({})) => ({
  data: { id: "asm1", totalQuestions: n, questions: Array.from({ length: n }, (_, i) => q(i + 1, over(i))) },
  meta: { creditsUsed: 1, creditsRemaining: 49_000, tier: "developer", requestId: "r1" },
});

function ok(url: string): Response | null {
  if (url.endsWith("/subjects")) return json(SUBJECTS);
  return null;
}

function setup(env: Record<string, string | undefined> = {}) {
  __resetV1ForTests();
  calls = [];
  process.env.ALOC_V1_API_KEY = KEY;
  process.env.ALOC_PROVIDER = "auto";
  delete process.env.ALOC_V1_BASE_URL;
  process.env.ALOC_V1_RATE_PER_MIN = "25";
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

const warnings: string[] = [];
console.warn = (...a: unknown[]) => { warnings.push(a.join(" ")); };

let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  warnings.length = 0;
  await fn();
  passed++;
  console.log("  ✓", name);
}

(async () => {
  console.log("aloc v1 client");

  await test("OFF by default: no ALOC_PROVIDER → null and zero network calls", async () => {
    setup({ ALOC_PROVIDER: undefined });
    assert.equal(v1Enabled(), false);
    assert.equal(await tryV1Questions("Mathematics", 40), null);
    assert.equal(calls.length, 0);
  });

  await test("OFF without a key even when ALOC_PROVIDER=auto", async () => {
    setup({ ALOC_V1_API_KEY: "" });
    assert.equal(await tryV1Questions("Mathematics", 40), null);
    assert.equal(calls.length, 0);
  });

  await test("happy path: right request, X-API-Key header, answers mapped to the right option", async () => {
    setup();
    handler = (c) => ok(c.url) ?? json(paper(40));
    const out = await tryV1Questions("Mathematics", 40);
    assert.ok(out && out.length === 40);
    const gen = calls.find((c) => c.url.endsWith("/assessments/generate"))!;
    assert.equal(gen.method, "POST");
    assert.equal(gen.headers["x-api-key"], KEY);
    assert.equal(gen.body?.subject, "mathematics");
    assert.equal(gen.body?.examType, "jamb");
    assert.equal(gen.body?.preset, "jamb_standard_40");
    assert.equal(gen.body?.shuffleOptions, true);
    assert.ok(String(gen.body?.seed).length > 6);
    // correctAnswer "b" must resolve to index 1 whose text is "2" for question 1
    assert.equal(out![0].answer, 1);
    assert.equal(out![0].options[out![0].answer], "2");
  });

  await test("preset mapping: 10 → micro_test_10, other sizes → custom with count", async () => {
    setup();
    handler = (c) => ok(c.url) ?? json(paper(Number(c.body?.count ?? 10)));
    await tryV1Questions("Physics", 10);
    await tryV1Questions("Physics", 60);
    const gens = calls.filter((c) => c.url.endsWith("/generate"));
    assert.equal(gens[0].body?.preset, "micro_test_10");
    assert.equal(gens[0].body?.count, undefined);
    assert.equal(gens[1].body?.preset, "custom");
    assert.equal(gens[1].body?.count, 60);
  });

  await test("a caller-supplied seed is passed through (same set for everyone)", async () => {
    setup();
    handler = (c) => ok(c.url) ?? json(paper(10));
    await tryV1Questions("Chemistry", 10, { seed: "daily_2026-10-06" });
    assert.equal(calls.find((c) => c.url.endsWith("/generate"))!.body?.seed, "daily_2026-10-06");
  });

  await test("diagram + passage fields survive the mapping", async () => {
    const m = mapV1Question(q(1, { imageUrl: "https://cdn.example.com/fig1.png", section: "Read the passage…", hasPassage: true, questionNumber: 3, category: "passage-a" }));
    assert.ok(m);
    assert.equal(m!.image, "https://cdn.example.com/fig1.png");
    assert.equal(m!.hasPassage, true);
    assert.equal(m!.questionNub, 3);
    assert.equal(m!.category, "passage-a");
  });

  await test("validation: bad answer key / missing options / no id are rejected", () => {
    assert.equal(mapV1Question(q(1, { correctAnswer: "e" })), null); // 'e' has no text
    assert.equal(mapV1Question(q(1, { correctAnswer: "z" })), null);
    assert.equal(mapV1Question(q(1, { correctAnswer: undefined })), null);
    assert.equal(mapV1Question(q(1, { options: { a: "1", b: "2", c: "3" } })), null);
    assert.equal(mapV1Question(q(1, { options: { a: "1", b: "", c: "3", d: "4" } })), null);
    assert.equal(mapV1Question(q(1, { text: "" })), null);
    assert.equal(mapV1Question(q(1, { id: undefined })), null);
    assert.ok(mapV1Question(q(1, { correctAnswer: "B" }))); // case-insensitive
    assert.ok(mapV1Question(q(1, { text: "", imageUrl: "https://cdn.example.com/a.png" }))); // image-only prompt is fine
  });

  await test("a mostly-invalid batch is rejected whole (falls back to v2)", async () => {
    setup();
    handler = (c) => ok(c.url) ?? json(paper(40, (i) => (i % 2 === 0 ? { correctAnswer: "z" } : {})));
    assert.equal(await tryV1Questions("Mathematics", 40), null);
  });

  await test("a few bad questions are dropped but the batch is still used", async () => {
    setup();
    handler = (c) => ok(c.url) ?? json(paper(40, (i) => (i < 3 ? { correctAnswer: "z" } : {})));
    const out = await tryV1Questions("Mathematics", 40);
    assert.ok(out && out.length === 37);
  });

  await test("English and huge sets never go to v1", async () => {
    setup();
    handler = (c) => ok(c.url) ?? json(paper(10));
    assert.equal(await tryV1Questions("English Language", 60), null);
    assert.equal(await tryV1Questions("Mathematics", 200), null);
    assert.equal(calls.length, 0);
  });

  await test("unknown subject on v1 → null without spending a generate call", async () => {
    setup();
    handler = (c) => ok(c.url) ?? json(paper(10));
    assert.equal(await tryV1Questions("Insurance", 40), null);
    assert.equal(calls.some((c) => c.url.endsWith("/generate")), false);
  });

  await test("subject names resolve via aliases (Literature in English → literature-in-english)", async () => {
    setup();
    handler = (c) => ok(c.url) ?? json(paper(10));
    assert.equal(await resolveV1Subject("englishlit"), "literature-in-english");
    assert.equal(await resolveV1Subject("mathematics"), "mathematics");
    assert.equal(calls.filter((c) => c.url.endsWith("/subjects")).length, 1); // list is cached
  });

  await test("429 → null, then v1 is skipped (no more requests) until Retry-After passes", async () => {
    setup();
    handler = (c) => ok(c.url) ?? json({ error: "rate_limited", message: "slow down" }, 429, { "retry-after": "30" });
    assert.equal(await tryV1Questions("Mathematics", 40), null);
    const before = calls.length;
    assert.equal(await tryV1Questions("Mathematics", 40), null);
    assert.equal(calls.length, before, "second call must not hit the network while cooling down");
  });

  await test("401 (bad key) → null and a long cooldown; the key is never logged", async () => {
    setup();
    handler = (c) => ok(c.url) ?? json({ error: "unauthorized", message: "bad key" }, 401);
    assert.equal(await tryV1Questions("Mathematics", 40), null);
    const before = calls.length;
    assert.equal(await tryV1Questions("Mathematics", 40), null);
    assert.equal(calls.length, before);
    assert.ok(!warnings.join("\n").includes(KEY), "API key leaked into logs");
  });

  await test("402 (credits exhausted) → null and cooldown", async () => {
    setup();
    handler = (c) => ok(c.url) ?? json({ error: "payment_required" }, 402);
    assert.equal(await tryV1Questions("Mathematics", 40), null);
    const before = calls.length;
    assert.equal(await tryV1Questions("Mathematics", 40), null);
    assert.equal(calls.length, before);
  });

  await test("circuit breaker: three 500s stop v1 for a while", async () => {
    setup();
    handler = (c) => ok(c.url) ?? new Response("boom", { status: 500 });
    for (let i = 0; i < 3; i++) await tryV1Questions("Mathematics", 40);
    const before = calls.length;
    assert.equal(await tryV1Questions("Mathematics", 40), null);
    assert.equal(calls.length, before, "breaker should be open");
  });

  await test("a success resets the failure count", async () => {
    setup();
    let fail = true;
    handler = (c) => ok(c.url) ?? (fail ? new Response("x", { status: 500 }) : json(paper(40)));
    await tryV1Questions("Mathematics", 40);
    await tryV1Questions("Mathematics", 40);
    fail = false;
    assert.ok(await tryV1Questions("Mathematics", 40));
    fail = true;
    await tryV1Questions("Mathematics", 40);
    await tryV1Questions("Mathematics", 40);
    fail = false;
    assert.ok(await tryV1Questions("Mathematics", 40), "two failures after a success must not trip the breaker");
  });

  await test("network error / unreadable body / missing questions array → null, never throws", async () => {
    setup();
    handler = (c) => { if (c.url.endsWith("/subjects")) return json(SUBJECTS); throw new Error("ECONNRESET"); };
    assert.equal(await tryV1Questions("Mathematics", 40), null);
    setup();
    handler = (c) => ok(c.url) ?? new Response("<html>nope</html>", { status: 200 });
    assert.equal(await tryV1Questions("Mathematics", 40), null);
    setup();
    handler = (c) => ok(c.url) ?? json({ data: { questions: "nope" } });
    assert.equal(await tryV1Questions("Mathematics", 40), null);
  });

  await test("rate limiter: allows `limit` per window, then makes callers wait or give up", async () => {
    let t = 1_000;
    const slept: number[] = [];
    const lim = new SlidingWindowLimiter(() => t, async (ms) => { slept.push(ms); t += ms; });
    for (let i = 0; i < 3; i++) assert.equal(await lim.acquire(3, 60_000, 5_000), true);
    // 4th: next slot is ~60s away — beyond a 5s budget → refuse immediately
    assert.equal(await lim.acquire(3, 60_000, 5_000), false);
    assert.equal(slept.length, 0);
    // with a long budget it waits for the window to roll, then succeeds
    assert.equal(await lim.acquire(3, 60_000, 120_000), true);
    const sleptCount: number = slept.length;
    assert.ok(sleptCount === 1 && slept[0] >= 59_000);
  });

  await test("the module honours ALOC_V1_RATE_PER_MIN (2/min → third request is refused)", async () => {
    setup({ ALOC_V1_RATE_PER_MIN: "2" });
    handler = (c) => ok(c.url) ?? json(paper(10));
    // /subjects takes one slot, first generate the second → the next generate must be refused
    assert.ok(await tryV1Questions("Mathematics", 10));
    assert.equal(await tryV1Questions("Mathematics", 10), null);
    assert.equal(calls.filter((c) => c.url.endsWith("/generate")).length, 1);
  });

  await test("credits are tracked from response meta", async () => {
    setup();
    handler = (c) => ok(c.url) ?? json(paper(10));
    await tryV1Questions("Mathematics", 10);
    const { getV1Status } = await import("../src/lib/aloc-v1");
    assert.equal(getV1Status().credits?.creditsRemaining, 49_000);
  });

  await test("diagnostics: detects a correct shuffle (same option text as the canonical record)", async () => {
    setup();
    handler = (c) => {
      if (c.url.endsWith("/health")) return json({ status: "healthy" });
      if (c.url.endsWith("/subjects")) return json(SUBJECTS);
      if (c.url.endsWith("/assessments/generate")) return json(paper(10));
      const m = c.url.match(/\/questions\/(id-\d+)$/);
      if (m) { const i = Number(m[1].split("-")[1]); return json({ data: q(i, { options: { a: `${i + 1}`, b: "x", c: "y", d: "z" }, correctAnswer: "a" }) }); }
      return new Response("?", { status: 404 });
    };
    const d = await runV1Diagnostics("mathematics");
    assert.equal(d.ok, true);
    assert.equal(d.answerCheck?.matched, 3);
    assert.equal(d.answerCheck?.mismatched, 0);
  });

  await test("diagnostics: FLAGS a shuffle that breaks the answer key", async () => {
    setup();
    handler = (c) => {
      if (c.url.endsWith("/health")) return json({ status: "healthy" });
      if (c.url.endsWith("/subjects")) return json(SUBJECTS);
      if (c.url.endsWith("/assessments/generate")) return json(paper(10));
      const m = c.url.match(/\/questions\/(id-\d+)$/);
      if (m) return json({ data: q(1, { options: { a: "WRONG", b: "x", c: "y", d: "z" }, correctAnswer: "a" }) });
      return new Response("?", { status: 404 });
    };
    const d = await runV1Diagnostics("mathematics");
    assert.equal(d.ok, false);
    assert.ok((d.answerCheck?.mismatched ?? 0) > 0);
    assert.match(d.answerCheck?.note ?? "", /DO NOT enable/);
  });

  await test("diagnostics never include the API key", async () => {
    setup();
    handler = (c) => (c.url.endsWith("/health") ? json({ status: "healthy" }) : ok(c.url) ?? json(paper(10)));
    const d = await runV1Diagnostics("mathematics");
    assert.ok(!JSON.stringify(d).includes(KEY));
    assert.equal(d.status.keyConfigured, true);
  });

  globalThis.fetch = origFetch;
  console.warn = origWarn;
  console.log(`\n${passed} tests passed`);
})().catch((e) => {
  globalThis.fetch = origFetch;
  console.warn = origWarn;
  console.error("\nFAILED:", e);
  process.exit(1);
});
