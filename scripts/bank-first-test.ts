/**
 * Bank-first tests — no network, no keys. Run with:
 *
 *   npx tsx scripts/bank-first-test.ts
 *
 * Covers: when a request is answered from the bank, the QUESTION_SOURCE=live switch, English staying on ALOC,
 * failing open when Supabase is not configured, questions already saved never being stored again, and the
 * fill script's option parsing.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { NormalizedQuestion } from "../src/lib/aloc";
import {
  BANK_MIN_ANY_YEAR, bankFirstEnabled, bankServePlan, isEnglishSubject, saveNewToBank, serveFromBank,
} from "../src/lib/question-bank";
import { parseArgs, parseYears } from "./fill-bank";

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

async function run() {
  console.log("bank-first decision");

  await test("a named year is served once the bank has a paper's worth (40)", () => {
    assert.equal(bankServePlan({ subject: "Physics", year: "2019", want: 60, bankSize: 39 }).serve, false);
    const plan = bankServePlan({ subject: "Physics", year: "2019", want: 60, bankSize: 40 });
    assert.equal(plan.serve, true);
    assert.equal(plan.minReturn, 36); // 90% of 40 — a 60-question ask never demands more than a paper exists
  });

  await test("a small year request needs only that many", () => {
    assert.equal(bankServePlan({ subject: "Biology", year: "2020", want: 10, bankSize: 10 }).serve, true);
    assert.equal(bankServePlan({ subject: "Biology", year: "2020", want: 10, bankSize: 9 }).serve, false);
  });

  await test("random mix waits for a comfortably big pool", () => {
    assert.equal(bankServePlan({ subject: "Chemistry", year: null, want: 60, bankSize: BANK_MIN_ANY_YEAR - 1 }).serve, false);
    assert.equal(bankServePlan({ subject: "Chemistry", year: null, want: 60, bankSize: BANK_MIN_ANY_YEAR }).serve, true);
  });

  await test("a big pack request needs twice its size in the bank", () => {
    assert.equal(bankServePlan({ subject: "Chemistry", year: null, want: 200, bankSize: 399 }).serve, false);
    const plan = bankServePlan({ subject: "Chemistry", year: null, want: 200, bankSize: 400 });
    assert.equal(plan.serve, true);
    assert.equal(plan.minReturn, 180);
  });

  await test("requests above 200 are treated as 200", () => {
    assert.equal(bankServePlan({ subject: "Physics", year: null, want: 5000, bankSize: 400 }).serve, true);
  });

  await test("English is never served from the bank", () => {
    for (const s of ["English", "English Language", " english language ", "Use of English"]) {
      assert.equal(isEnglishSubject(s), true, s);
      assert.equal(bankServePlan({ subject: s, year: "2019", want: 40, bankSize: 9999 }).serve, false, s);
    }
    assert.equal(isEnglishSubject("Literature in English"), false);
    assert.equal(bankServePlan({ subject: "Literature in English", year: null, want: 40, bankSize: 500 }).serve, true);
  });

  console.log("switch and failing open");

  await test("QUESTION_SOURCE=live turns bank-first off; anything else leaves it on", () => {
    const old = process.env.QUESTION_SOURCE;
    process.env.QUESTION_SOURCE = "live";
    assert.equal(bankFirstEnabled(), false);
    process.env.QUESTION_SOURCE = " LIVE ";
    assert.equal(bankFirstEnabled(), false);
    process.env.QUESTION_SOURCE = "bank-first";
    assert.equal(bankFirstEnabled(), true);
    delete process.env.QUESTION_SOURCE;
    assert.equal(bankFirstEnabled(), true);
    if (old !== undefined) process.env.QUESTION_SOURCE = old;
  });

  await test("with no Supabase configured it returns null (the app then asks ALOC as before)", async () => {
    const saved = { u: process.env.NEXT_PUBLIC_SUPABASE_URL, k: process.env.SUPABASE_SERVICE_ROLE_KEY };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal(await serveFromBank("Mathematics", null, 40), null);
    assert.equal(await serveFromBank("Mathematics", "2019", 40), null);
    if (saved.u !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = saved.u;
    if (saved.k !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = saved.k;
  });

  console.log("never stored twice");

  await test("a question already saved is not stored again (only new ones are)", async () => {
    // A tiny stand-in for the database: inserts only keys it does not have (like ON CONFLICT DO NOTHING)
    // and answers with the rows it really inserted.
    const rows = new Map<string, unknown>();
    const writes: number[] = [];
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        const ignore = /ignore-duplicates/.test(String(req.headers["prefer"] ?? ""));
        const inserted: { key: string }[] = [];
        for (const r of JSON.parse(body) as { key: string }[]) {
          if (ignore && rows.has(r.key)) continue;
          rows.set(r.key, r);
          inserted.push({ key: r.key });
        }
        writes.push(inserted.length);
        res.writeHead(201, { "content-type": "application/json" });
        res.end(JSON.stringify(inserted));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const saved = { u: process.env.NEXT_PUBLIC_SUPABASE_URL, k: process.env.SUPABASE_SERVICE_ROLE_KEY };
    process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
    try {
      const q = (i: number): NormalizedQuestion => ({
        id: `id-${i}`, prompt: `What is ${i} + ${i}?`, options: [`${i}`, `${i * 2}`, `${i * 3}`, `${i * 4}`],
        answer: 1, explanation: null, year: "2019", source: "aloc",
      });
      const first = await saveNewToBank("Mathematics", [q(1), q(2), q(3)]);
      assert.deepEqual(first, { added: 3, existing: 0, ok: true });

      // same three again, plus one genuinely new question, and a repeat of the same question inside one batch
      const second = await saveNewToBank("Mathematics", [q(1), q(2), q(3), q(4), q(4)]);
      assert.deepEqual(second, { added: 1, existing: 3, ok: true });
      assert.equal(rows.size, 4);

      // an ALOC id change does not matter — it is the same question text and options
      const renamed = { ...q(2), id: "different-id" };
      assert.deepEqual(await saveNewToBank("Mathematics", [renamed]), { added: 0, existing: 1, ok: true });
      assert.equal(rows.size, 4);
    } finally {
      server.close();
      if (saved.u === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = saved.u;
      if (saved.k === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.k;
    }
  });

  console.log("fill script options");

  await test("years: ranges, lists, newest first", () => {
    assert.deepEqual(parseYears("2019-2021"), ["2021", "2020", "2019"]);
    assert.deepEqual(parseYears("2019,2023"), ["2023", "2019"]);
    assert.deepEqual(parseYears("2021-2019"), ["2021", "2020", "2019"]);
    assert.throws(() => parseYears("last year"));
  });

  await test("defaults and flags", () => {
    const d = parseArgs([]);
    assert.equal(d.perMinute, 20);
    assert.equal(d.force, false);
    assert.equal(d.dry, false);
    assert.equal(d.years[d.years.length - 1], "2001");
    const o = parseArgs(["--subject", "maths,Physics", "--years", "2020-2021", "--per-minute", "12", "--force", "--dry"]);
    assert.deepEqual(o.subjects, ["maths", "Physics"]);
    assert.deepEqual(o.years, ["2021", "2020"]);
    assert.equal(o.perMinute, 12);
    assert.equal(o.force && o.dry, true);
  });

  await test("bad options are rejected", () => {
    assert.throws(() => parseArgs(["--nope"]));
    assert.throws(() => parseArgs(["--per-minute", "0"]));
    assert.throws(() => parseArgs(["--per-minute", "abc"]));
  });

  console.log(`\n${passed} passed`);
}

run().catch((err) => {
  console.error("\n✖ FAILED:", err);
  process.exit(1);
});
