// Run with: npm test   (Node's built-in test runner; no extra packages)
import test from "node:test";
import assert from "node:assert/strict";
import {
  lagosDayKey, shiftDayKey, lastDays, scoreSeries, yScale, spreadX, nearestIndex, weekSummary, parseDailyGoal, toJamb,
  type AttemptLike,
} from "../src/lib/trends.ts";

const at = (iso: string) => Date.parse(iso);
const att = (id: string, iso: string, score: number, q: number): AttemptLike => ({ id, submitted_at: iso, score, question_count: q });

test("a day is a Lagos day, not the server's or the phone's", () => {
  // 23:30 UTC on the 9th is already 00:30 on the 10th in Lagos (UTC+1)
  assert.equal(lagosDayKey(at("2026-10-09T23:30:00Z")), "2026-10-10");
  assert.equal(lagosDayKey(at("2026-10-09T22:59:59Z")), "2026-10-09");
  assert.equal(lagosDayKey("2026-10-10T00:00:00+01:00"), "2026-10-10");
});

test("shiftDayKey moves along the calendar, across months and years", () => {
  assert.equal(shiftDayKey("2026-10-10", -6), "2026-10-04");
  assert.equal(shiftDayKey("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDayKey("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftDayKey("2028-02-28", 1), "2028-02-29");
});

test("lastDays gives 7 consecutive days ending today", () => {
  const days = lastDays(7, at("2026-10-10T08:00:00Z"));
  assert.equal(days.length, 7);
  assert.deepEqual(days.map((d) => d.key), ["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"]);
  assert.equal(days[6].isToday, true);
  assert.equal(days.filter((d) => d.isToday).length, 1);
  assert.deepEqual(days.map((d) => d.label), ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
});

test("marks out of 400 match the dashboard rule", () => {
  assert.equal(toJamb(90, 180), 200);
  assert.equal(toJamb(112, 180), 249);
  assert.equal(toJamb(0, 0), 0);
});

test("scoreSeries sorts by date, tags mocks and practice, and keeps the latest points", () => {
  const list = [
    att("c", "2026-10-09T10:00:00Z", 9, 20),
    att("a", "2026-10-01T10:00:00Z", 96, 180),
    att("b", "2026-10-05T10:00:00Z", 41, 60),
    { id: "x", submitted_at: null, score: 5, question_count: 10 },
    att("z", "2026-10-06T10:00:00Z", 5, 0),
  ];
  const all = scoreSeries(list);
  assert.deepEqual(all.map((p) => p.id), ["a", "b", "c"]);
  assert.deepEqual(all.map((p) => p.kind), ["mock", "practice", "practice"]);
  assert.equal(all[0].jamb, 213);
  assert.equal(all[0].pct, 53);
  assert.deepEqual(scoreSeries(list, { mocksOnly: true }).map((p) => p.id), ["a"]);
  assert.deepEqual(scoreSeries(list, { max: 2 }).map((p) => p.id), ["b", "c"]);
});

test("yScale fits the data, stays inside 0–400 and is never tighter than 150 marks", () => {
  const s = yScale([229, 273, 170], 300);
  assert.ok(s.min <= 140 && s.max >= 330 && s.min >= 0 && s.max <= 400);
  assert.ok(s.ticks.every((t) => t >= s.min && t <= s.max));
  const tight = yScale([250, 255], 260);
  assert.ok(tight.max - tight.min >= 150);
  const low = yScale([0, 10], 300);
  assert.equal(low.min, 0);
  const high = yScale([395], 400);
  assert.equal(high.max, 400);
  assert.ok(high.max - high.min >= 150);
  const none = yScale([]);
  assert.ok(none.max - none.min >= 150);
});

test("spreadX keeps real date spacing but never lets dots overlap", () => {
  assert.deepEqual(spreadX([]), []);
  assert.deepEqual(spreadX([5]), [0.5]);
  const xs = spreadX([0, 1000, 1001, 1002, 10000]);
  assert.equal(xs[0], 0);
  assert.equal(xs[xs.length - 1], 1);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= 0.06 - 1e-9, `gap ${i}`);
  assert.ok(xs.every((x) => x >= 0 && x <= 1));
  const same = spreadX([7, 7, 7]);
  assert.ok(same[2] - same[0] >= 0.12 - 1e-9);
  const many = spreadX(Array.from({ length: 30 }, (_, i) => i));
  assert.equal(many[0], 0);
  assert.equal(many[29], 1);
});

test("nearestIndex picks the closest point", () => {
  assert.equal(nearestIndex([0.1, 0.5, 0.9], 0.55), 1);
  assert.equal(nearestIndex([0.1, 0.5, 0.9], 2), 2);
  assert.equal(nearestIndex([], 0.5), -1);
});

test("weekSummary counts per Lagos day, flags the goal and compares with last week", () => {
  const now = at("2026-10-10T08:00:00Z"); // Saturday
  const list = [
    att("1", "2026-10-10T07:00:00Z", 12, 20), // today
    att("2", "2026-10-09T23:30:00Z", 10, 20), // 00:30 Saturday in Lagos -> today too
    att("3", "2026-10-08T12:00:00Z", 100, 180), // Thursday
    att("4", "2026-10-02T12:00:00Z", 30, 100), // previous week
    att("5", "2026-09-01T12:00:00Z", 30, 100), // long ago
    { id: "n", submitted_at: null, score: 1, question_count: 50 },
  ];
  const w = weekSummary(list, 20, now);
  assert.equal(w.days.length, 7);
  const today = w.days[6];
  assert.equal(today.questions, 40);
  assert.equal(today.correct, 22);
  assert.equal(today.accuracy, 55);
  assert.equal(today.hitGoal, true);
  assert.equal(w.days[4].questions, 180);
  assert.equal(w.total, 220);
  assert.equal(w.daysPractised, 2);
  assert.equal(w.best?.key, "2026-10-08");
  assert.equal(w.previousTotal, 100);
  assert.equal(w.changePct, 120);
  assert.equal(w.days[0].hitGoal, false);
  assert.equal(w.days[0].accuracy, null);
});

test("weekSummary with no history has no percentage change and no best day", () => {
  const w = weekSummary([], 20, at("2026-10-10T08:00:00Z"));
  assert.equal(w.total, 0);
  assert.equal(w.best, null);
  assert.equal(w.changePct, null);
  assert.equal(w.daysPractised, 0);
});

test("parseDailyGoal reads the saved goal and ignores rubbish", () => {
  assert.equal(parseDailyGoal('{"dailyGoal":30}'), 30);
  assert.equal(parseDailyGoal('{"dailyGoal":"50"}'), 50);
  assert.equal(parseDailyGoal('{"dailyGoal":0}'), 20);
  assert.equal(parseDailyGoal('{"dailyGoal":99999}'), 20);
  assert.equal(parseDailyGoal("not json"), 20);
  assert.equal(parseDailyGoal(null), 20);
});
