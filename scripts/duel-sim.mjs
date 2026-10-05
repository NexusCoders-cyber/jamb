/**
 * Duel engine regression test — no database or network needed.
 *
 *   node --experimental-strip-types scripts/duel-sim.mjs
 *
 * Plays whole duels against an in-memory table that behaves like the real
 * one (single-row compare-and-swap on status + host_index + guest_index),
 * including simultaneous answers, late/early answers, timeouts and solo.
 */
import assert from "node:assert/strict";
import { DUEL, armDeadline, currentRound, planAnswer, planTimeout, roundStartMs } from "../src/lib/duel.ts";

const T0 = Date.parse("2026-10-05T10:00:00Z");
const questions = Array.from({ length: 10 }, (_, i) => ({ answer: i % 4, options: ["a", "b", "c", "d"] }));

const fresh = (extra = {}) => ({
  status: "active", guest_id: "g", questions,
  host_index: 0, guest_index: 0, host_score: 0, guest_score: 0,
  host_finished: false, guest_finished: false,
  host_picks: [], guest_picks: [],
  turn_ends_at: armDeadline(T0, "first"),
  ...extra,
});

/** Same guard the API uses: apply only if the row is still in the state we read. */
function cas(db, read, updates) {
  const cur = db.row;
  if (cur.status !== read.status || cur.host_index !== read.host_index || cur.guest_index !== read.guest_index) return null;
  db.row = { ...cur, ...updates };
  return db.row;
}

/** One API call: read, plan, CAS-retry. `readAt` lets a test hand in a stale read. */
function answer(db, side, pick, now, stale) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const read = attempt === 0 && stale ? stale : db.row;
    const plan = planAnswer(read, side, pick, now);
    if (!plan.ok) return plan;
    const next = cas(db, read, plan.updates);
    if (next) return { ok: true, done: plan.done, row: next };
  }
  return { ok: false, status: 409, error: "busy" };
}

function tick(db, now) {
  for (let i = 0; i < 3; i++) {
    const plan = planTimeout(db.row, now);
    if (!plan) return null;
    const next = cas(db, db.row, plan.updates);
    if (next || Object.keys(plan.updates).length === 0) return plan;
  }
  return null;
}

const startOf = (row) => roundStartMs(row);
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ✓", name); };

console.log("duel engine");

test("timer is 25 seconds per question", () => {
  assert.equal(DUEL.ROUND_SECONDS, 25);
  const row = fresh();
  assert.equal(Date.parse(row.turn_ends_at) - startOf(row), 25_000);
});

test("full duel: both answer every question, higher score wins, ends exactly once", () => {
  const db = { row: fresh() };
  let now = T0;
  let doneCount = 0;
  for (let r = 0; r < 10; r++) {
    now = startOf(db.row) + 2000; // round is open
    assert.equal(currentRound(db.row), r);
    const h = answer(db, "host", questions[r].answer, now); // host always right
    assert.ok(h.ok, h.error);
    assert.equal(h.done, false);
    assert.equal(currentRound(db.row), r); // waiting for guest
    const g = answer(db, "guest", (questions[r].answer + 1) % 4, now + 1000); // guest always wrong
    assert.ok(g.ok, g.error);
    if (g.done) doneCount++;
  }
  assert.equal(doneCount, 1);
  assert.equal(db.row.host_score, 10);
  assert.equal(db.row.guest_score, 0);
  assert.deepEqual(db.row.host_picks, questions.map((q) => q.answer));
  assert.ok(db.row.host_finished && db.row.guest_finished);
});

test("each new round re-arms a full 25s clock after a short reveal", () => {
  const db = { row: fresh() };
  const now = startOf(db.row) + 3000;
  answer(db, "host", 0, now);
  answer(db, "guest", 1, now + 500);
  const gap = Date.parse(db.row.turn_ends_at) - (now + 500);
  assert.equal(gap, (DUEL.REVEAL_SECONDS + DUEL.ROUND_SECONDS) * 1000);
  assert.equal(currentRound(db.row), 1);
});

test("RACE: both answer at the same instant from the same stale read — nothing is skipped or lost", () => {
  const db = { row: fresh() };
  const now = startOf(db.row) + 1000;
  const snapshot = { ...db.row }; // both requests read this
  const a = answer(db, "host", 0, now, snapshot);
  const b = answer(db, "guest", 0, now, snapshot); // CAS fails first time, retries on fresh row
  assert.ok(a.ok && b.ok);
  assert.equal(db.row.host_index, 1);
  assert.equal(db.row.guest_index, 1);
  assert.equal(currentRound(db.row), 1);
  // the second writer must have re-armed the clock for round 2
  assert.ok(Date.parse(db.row.turn_ends_at) > now + 25_000);
  assert.equal(db.row.host_score + db.row.guest_score, 2);
});

test("a double-tap cannot answer twice", () => {
  const db = { row: fresh() };
  const now = startOf(db.row) + 1000;
  assert.ok(answer(db, "host", 0, now).ok);
  const again = answer(db, "host", 1, now + 100);
  assert.equal(again.ok, false);
  assert.equal(again.status, 409);
  assert.equal(db.row.host_index, 1);
});

test("late answer inside the grace window still counts (fixes silently-dropped answers)", () => {
  const db = { row: fresh() };
  const deadline = Date.parse(db.row.turn_ends_at);
  const r = answer(db, "host", 0, deadline + 900);
  assert.ok(r.ok);
  assert.equal(db.row.host_score, 1);
});

test("answer after the grace window is rejected", () => {
  const db = { row: fresh() };
  const deadline = Date.parse(db.row.turn_ends_at);
  const r = answer(db, "host", 0, deadline + DUEL.ANSWER_GRACE_MS + 50);
  assert.equal(r.ok, false);
  assert.equal(r.status, 409);
});

test("answering during the get-ready / reveal pause is rejected", () => {
  const db = { row: fresh() };
  const r = answer(db, "host", 0, T0 + 1000);
  assert.equal(r.ok, false);
  assert.equal(r.status, 425);
});

test("timeout: a silent player is skipped with no score, the round moves on", () => {
  const db = { row: fresh() };
  const now = startOf(db.row) + 5000;
  assert.ok(answer(db, "host", 0, now).ok); // host answers, guest goes quiet
  assert.equal(tick(db, now + 1000), null); // clock still running
  const after = Date.parse(db.row.turn_ends_at) + DUEL.ANSWER_GRACE_MS + 10;
  const plan = tick(db, after);
  assert.ok(plan && !plan.done);
  assert.equal(db.row.guest_index, 1);
  assert.equal(db.row.guest_score, 0);
  assert.deepEqual(db.row.guest_picks, [-1]);
  assert.equal(currentRound(db.row), 1);
  assert.ok(Date.parse(db.row.turn_ends_at) > after);
});

test("timeout when neither answers: both skipped, one tick, round advances", () => {
  const db = { row: fresh() };
  const after = Date.parse(db.row.turn_ends_at) + DUEL.ANSWER_GRACE_MS + 10;
  tick(db, after);
  assert.equal(db.row.host_index, 1);
  assert.equal(db.row.guest_index, 1);
  assert.deepEqual([db.row.host_picks, db.row.guest_picks], [[-1], [-1]]);
});

test("two clients ticking at once only advance the round once", () => {
  const db = { row: fresh() };
  const after = Date.parse(db.row.turn_ends_at) + DUEL.ANSWER_GRACE_MS + 10;
  const stale = { ...db.row };
  const p1 = planTimeout(stale, after);
  const p2 = planTimeout(stale, after);
  assert.ok(cas(db, stale, p1.updates));
  assert.equal(cas(db, stale, p2.updates), null); // loser is rejected
  assert.equal(db.row.host_index, 1);
});

test("last question times out for everyone: match is flagged done", () => {
  const db = { row: fresh({ host_index: 9, guest_index: 9, host_picks: Array(9).fill(0), guest_picks: Array(9).fill(0), turn_ends_at: armDeadline(T0, "reveal") }) };
  const after = Date.parse(db.row.turn_ends_at) + DUEL.ANSWER_GRACE_MS + 10;
  const plan = tick(db, after);
  assert.ok(plan.done);
  assert.ok(db.row.host_finished && db.row.guest_finished);
});

test("self-heal: all questions resolved but match never settled → done", () => {
  const db = { row: fresh({ host_index: 10, guest_index: 10 }) };
  const plan = planTimeout(db.row, T0);
  assert.ok(plan && plan.done && Object.keys(plan.updates).length === 0);
});

test("player who finishes the last question first waits; the match ends when the other answers", () => {
  const db = { row: fresh({ host_index: 9, guest_index: 9, host_picks: Array(9).fill(0), guest_picks: Array(9).fill(0), turn_ends_at: armDeadline(T0, "reveal") }) };
  const now = startOf(db.row) + 1000;
  const h = answer(db, "host", questions[9].answer, now);
  assert.ok(h.ok && !h.done);
  assert.equal(db.row.host_finished, true);
  const g = answer(db, "guest", 0, now + 4000);
  assert.ok(g.ok && g.done);
});

test("skip counts as an answered question with no score", () => {
  const db = { row: fresh() };
  const now = startOf(db.row) + 1000;
  assert.ok(answer(db, "host", -1, now).ok);
  assert.equal(db.row.host_score, 0);
  assert.deepEqual(db.row.host_picks, [-1]);
});

test("invalid choices are rejected", () => {
  const db = { row: fresh() };
  const now = startOf(db.row) + 1000;
  assert.equal(answer(db, "host", 9, now).status, 400);
  assert.equal(answer(db, "host", 1.5, now).status, 400);
});

test("answers to a finished / waiting match are rejected", () => {
  for (const status of ["waiting", "completed", "expired", "declined"]) {
    const db = { row: fresh({ status }) };
    assert.equal(answer(db, "host", 0, startOf(db.row) + 1000).status, 400);
  }
});

test("solo: runs at the player's own pace, one question per round", () => {
  const db = { row: fresh({ guest_id: null }) };
  let last;
  for (let r = 0; r < 10; r++) {
    last = answer(db, "host", questions[r].answer, startOf(db.row) + 1000);
    assert.ok(last.ok, last.error);
  }
  assert.ok(last.done);
  assert.equal(db.row.host_score, 10);
});

test("works on a database without the picks columns (picks are just extra)", () => {
  const row = fresh();
  delete row.host_picks; delete row.guest_picks;
  const db = { row };
  const now = startOf(db.row) + 1000;
  assert.ok(answer(db, "host", 0, now).ok);
  assert.ok(answer(db, "guest", 1, now).ok);
  assert.equal(currentRound(db.row), 1);
});

console.log(`\n${passed} tests passed`);
