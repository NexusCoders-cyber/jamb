import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blockUserCopy, deleteMessageCopy, deletePostCopy, formatReportReason, leaveExamCopy, leaveGameCopy,
  leaveStudyCopy, POST_REPORT_REASONS, signOutCopy,
} from "../src/lib/dialogCopy.ts";

test("exam exit says the answers are submitted, with the right count", () => {
  assert.match(leaveExamCopy(11).message, /11 answers/);
  assert.match(leaveExamCopy(1).message, /1 answer /);
  assert.match(leaveExamCopy(1).message, /submitted/);
  assert.equal(leaveExamCopy(3).primary, "cancel"); // the safe choice is the big button
});

test("study exit says progress is not saved", () => {
  assert.match(leaveStudyCopy(20).message, /20 questions/);
  assert.match(leaveStudyCopy().message, /not saved/);
});

test("destructive confirmations make the confirm button the main one", () => {
  for (const c of [deleteMessageCopy, deletePostCopy, blockUserCopy("Ada")]) {
    assert.equal(c.tone, "danger");
    assert.equal(c.primary, "confirm");
  }
  assert.match(blockUserCopy("Ada").title, /Ada/);
});

test("no copy starts with the browser-style site prefix or is empty", () => {
  const all = [leaveExamCopy(2), leaveStudyCopy(5), signOutCopy, deleteMessageCopy, deletePostCopy, blockUserCopy("X"),
    leaveGameCopy({ isDuel: true, live: true }), leaveGameCopy({ isDuel: true, live: false }), leaveGameCopy({ isDuel: false, live: false })];
  for (const c of all) {
    assert.ok(c.title.length > 0 && c.message.length > 0 && c.confirmLabel.length > 0 && c.cancelLabel.length > 0);
    assert.doesNotMatch(c.title + c.message, /The page at/i);
  }
});

test("arena wording follows the game state", () => {
  assert.match(leaveGameCopy({ isDuel: true, live: true }).message, /opponent wins/i);
  assert.match(leaveGameCopy({ isDuel: true, live: false }).title, /duel/);
  assert.match(leaveGameCopy({ isDuel: false, live: false }).title, /game/);
});

test("report reason text: label, optional note, capped at 300 characters", () => {
  assert.equal(formatReportReason(POST_REPORT_REASONS, "spam", ""), "Spam or advertising");
  assert.equal(formatReportReason(POST_REPORT_REASONS, "other", "  looks fake "), "Something else: looks fake");
  assert.equal(formatReportReason(POST_REPORT_REASONS, "other", "x".repeat(500)).length, 300);
  assert.equal(formatReportReason(POST_REPORT_REASONS, "unknown", ""), "unknown");
  assert.equal(new Set(POST_REPORT_REASONS.map((r) => r.id)).size, POST_REPORT_REASONS.length);
});
