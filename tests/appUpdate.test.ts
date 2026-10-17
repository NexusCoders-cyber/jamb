import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  currentBuild, holdCardOnPath, isUpdateAvailable, justUpdatedRecently, MAX_NOTE_CHARS, MAX_NOTES, MIN_CHECK_GAP_MS,
  notesAreFresh, NOTES_FRESH_MS, parseNotes, parseVersionResponse, shouldCheck,
} from "../src/lib/appUpdate.ts";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);

test("the running build is only known when both its id and time were baked in", () => {
  assert.deepEqual(currentBuild({ NEXT_PUBLIC_BUILD_ID: "abc123", NEXT_PUBLIC_BUILD_TIME: "1000" }), { build: "abc123", builtAt: 1000 });
  assert.equal(currentBuild({}), null);
  assert.equal(currentBuild({ NEXT_PUBLIC_BUILD_ID: "abc123" }), null);
  assert.equal(currentBuild({ NEXT_PUBLIC_BUILD_ID: " ", NEXT_PUBLIC_BUILD_TIME: "1000" }), null);
  assert.equal(currentBuild({ NEXT_PUBLIC_BUILD_ID: "abc", NEXT_PUBLIC_BUILD_TIME: "soon" }), null);
  assert.equal(currentBuild({ NEXT_PUBLIC_BUILD_ID: "abc", NEXT_PUBLIC_BUILD_TIME: "0" }), null);
});

test("an update is offered only for a different AND newer build", () => {
  const mine = { build: "aaa", builtAt: 1000 };
  assert.equal(isUpdateAvailable(mine, { build: "bbb", builtAt: 2000 }), true);
  assert.equal(isUpdateAvailable(mine, { build: "aaa", builtAt: 2000 }), false, "same build is never an update");
  assert.equal(isUpdateAvailable(mine, { build: "bbb", builtAt: 1000 }), false, "same time: not newer");
  assert.equal(isUpdateAvailable(mine, { build: "bbb", builtAt: 500 }), false, "a rollback or older preview is not an update");
  assert.equal(isUpdateAvailable(null, { build: "bbb", builtAt: 2000 }), false, "unknown current build: never guess");
  assert.equal(isUpdateAvailable(mine, null), false);
});

test("the version answer is read strictly; anything odd means no card", () => {
  assert.deepEqual(parseVersionResponse({ build: "bbb", builtAt: 2000, notes: ["One", "Two"] }), { build: "bbb", builtAt: 2000, notes: ["One", "Two"] });
  assert.deepEqual(parseVersionResponse({ build: "bbb", builtAt: "2000" }), { build: "bbb", builtAt: 2000, notes: [] });
  for (const bad of [null, undefined, "x", 5, {}, { build: "", builtAt: 2000 }, { build: "bbb" }, { build: "bbb", builtAt: "never" }, { build: 7, builtAt: 2000 }]) {
    assert.equal(parseVersionResponse(bad), null, JSON.stringify(bad));
  }
  const r = parseVersionResponse({ build: "bbb", builtAt: 2000, notes: ["ok", 5, null, "x".repeat(500), "a", "b", "c", "d"] });
  assert.ok(r);
  assert.equal(r.notes.length <= MAX_NOTES, true);
  assert.ok(r.notes.every((n) => typeof n === "string" && n.length <= MAX_NOTE_CHARS));
});

test("admin notes: one per line, bullets stripped, short, at most five", () => {
  assert.deepEqual(parseNotes("- New Chemistry questions\n* Faster loading\n• Fixed the timer\n1. Dark mode fix\n2) Smaller app"), [
    "New Chemistry questions", "Faster loading", "Fixed the timer", "Dark mode fix", "Smaller app",
  ]);
  assert.deepEqual(parseNotes("  \n\nOnly this\r\n\r\n"), ["Only this"]);
  assert.equal(parseNotes("1\n2\n3\n4\n5\n6\n7").length, MAX_NOTES);
  const long = parseNotes("y".repeat(400))[0];
  assert.equal(long.length, MAX_NOTE_CHARS);
  assert.ok(long.endsWith("…"));
  for (const bad of [null, undefined, 5, {}, ""]) assert.deepEqual(parseNotes(bad), []);
});

test("admin notes stop showing after three weeks, and an unreadable date counts as stale", () => {
  assert.equal(notesAreFresh(new Date(NOW - 1000).toISOString(), NOW), true);
  assert.equal(notesAreFresh(new Date(NOW - NOTES_FRESH_MS).toISOString(), NOW), true);
  assert.equal(notesAreFresh(new Date(NOW - NOTES_FRESH_MS - 1).toISOString(), NOW), false);
  assert.equal(notesAreFresh(new Date(NOW + 3_600_000).toISOString(), NOW), false, "a date from the future is not trusted");
  for (const bad of [null, undefined, "", "garbage"]) assert.equal(notesAreFresh(bad as string, NOW), false);
});

test("checks are spaced out, but the first one at app open is never skipped", () => {
  assert.equal(shouldCheck(NOW, NOW + 1000), false);
  assert.equal(shouldCheck(NOW, NOW + MIN_CHECK_GAP_MS), true);
  assert.equal(shouldCheck(NOW, NOW + 1000, true), true);
  assert.equal(shouldCheck(0, NOW), true);
  assert.equal(shouldCheck(NOW + 99_999, NOW), true, "a clock that moved backwards must not block checking");
});

test("the card never pops up over an exam, a practice session, a duel or the daily challenge", () => {
  for (const p of ["/exam", "/exam/", "/practice/study", "/practice/mock", "/daily-challenge", "/speed-training", "/arena", "/arena/abc"]) {
    assert.equal(holdCardOnPath(p), true, p);
  }
  for (const p of ["/", "/dashboard", "/practice", "/practice/", "/profile", "/settings", "/leaderboard", "/results", "/examination", "/messages", "/premium", null, undefined, ""]) {
    assert.equal(holdCardOnPath(p), false, String(p));
  }
});

test("'You're on the latest version' is only said right after an update", () => {
  assert.equal(justUpdatedRecently(String(NOW - 5000), NOW), true);
  assert.equal(justUpdatedRecently(String(NOW - 10 * 60 * 1000), NOW), false);
  assert.equal(justUpdatedRecently(String(NOW + 5000), NOW), false);
  for (const bad of [null, undefined, "", "abc", "0"]) assert.equal(justUpdatedRecently(bad, NOW), false);
});

test("the live version answer is public, uncached and reads nothing but the notes from settings", () => {
  const route = read("../src/app/api/version/route.ts");
  assert.ok(route.includes("no-store"), "must never be cached");
  assert.ok(route.includes('export const dynamic = "force-dynamic"'));
  assert.ok(route.includes('.eq("key", NOTES_SETTING_KEY)'), "may only read the notes row of admin_settings");
  assert.ok(!/paystack|secret|service_role/i.test(route.replace(/serviceRoleKey/g, "")), "must not touch payment keys");
  assert.equal((route.match(/\.from\("/g) ?? []).length, 1, "exactly one table is read");
});

test("the card is wired in once, root-wide, and is dismissible every way", () => {
  assert.ok(read("../src/app/layout.tsx").includes("<UpdateCard />"));
  const card = read("../src/components/UpdateCard.tsx");
  for (const needle of ["Not now", 'aria-label="Close"', 'e.key === "Escape"', "onClick={close}", "holdCardOnPath(", "isUpdateAvailable("]) {
    assert.ok(card.includes(needle), `UpdateCard is missing: ${needle}`);
  }
  assert.ok(card.includes("process.env.NEXT_PUBLIC_BUILD_ID"), "build id must be read with dotted access so the bundler can inline it");
  assert.ok(card.includes("process.env.NEXT_PUBLIC_BUILD_TIME"));
  const cfg = read("../next.config.ts");
  assert.ok(cfg.includes("NEXT_PUBLIC_BUILD_ID") && cfg.includes("NEXT_PUBLIC_BUILD_TIME"), "the build must bake both values in");
});
