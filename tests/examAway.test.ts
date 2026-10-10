import test from "node:test";
import assert from "node:assert/strict";
import { awayVerdict, awaySecondsLeft, AWAY_LIMIT_MS } from "../src/lib/examAway.ts";

const t0 = Date.parse("2026-10-10T10:00:00Z");

test("coming back inside a minute carries on", () => {
  assert.equal(awayVerdict(t0, t0), "continue");
  assert.equal(awayVerdict(t0, t0 + 59_999), "continue");
});

test("one minute or more ends the exam", () => {
  assert.equal(awayVerdict(t0, t0 + AWAY_LIMIT_MS), "ended");
  assert.equal(awayVerdict(t0, t0 + 5 * 60_000), "ended");
  assert.equal(awayVerdict(t0, t0 + 3 * 24 * 3_600_000), "ended");
});

test("the countdown to come back", () => {
  assert.equal(awaySecondsLeft(t0, t0), 60);
  assert.equal(awaySecondsLeft(t0, t0 + 1_500), 59);
  assert.equal(awaySecondsLeft(t0, t0 + 59_001), 1);
  assert.equal(awaySecondsLeft(t0, t0 + 90_000), 0);
});
