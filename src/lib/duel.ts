/**
 * Arena — duel rules (pure, no I/O).
 *
 * Imported by BOTH the /api/quiz/* routes and the Arena UI, so the timer and
 * the round logic can never drift apart between server and screen.
 *
 * How a duel works
 * ────────────────
 * Both players are shown the SAME question at the SAME time and get
 * ROUND_SECONDS (25s) to answer. A round ends when both have answered or the
 * clock runs out (an unanswered question scores nothing). Between rounds
 * there is a short reveal (REVEAL_SECONDS) showing the right answer and what
 * each player picked. After the last round the higher score wins.
 *
 * No extra database columns are needed to track a round:
 *   • host_index / guest_index = how many questions each player has resolved
 *   • current round            = the lower of the two (solo: the host's)
 *   • turn_ends_at             = the server deadline of the current round
 *     (the round opens ROUND_SECONDS before that — see roundStartMs)
 * Every state change bumps one of the indexes, so (status, host_index,
 * guest_index) uniquely identifies a state and works as an optimistic-lock
 * key for simultaneous answers.
 */

export const DUEL = {
  QUESTIONS: 10,
  /** Time each player gets to answer a question. */
  ROUND_SECONDS: 25,
  /** "Get ready" countdown before question 1, once both players are in. */
  FIRST_COUNTDOWN_SECONDS: 5,
  /** Reveal pause between questions (right answer + both picks). */
  REVEAL_SECONDS: 4,
  /** Network allowance: an answer may land this long after the deadline. */
  ANSWER_GRACE_MS: 1200,
  /** Answers may arrive this much before the round opens (clock jitter). */
  EARLY_TOLERANCE_MS: 800,
  /** An open duel nobody joins is retired after this long. */
  WAITING_EXPIRY_MS: 15 * 60 * 1000,
  /** Opponent must be gone this long before the stayer can claim the win. */
  CLAIM_GRACE_SECONDS: 30,
} as const;

export type Side = "host" | "guest";

/** The slice of a quiz_matches row the engine needs. */
export type DuelMatch = {
  id?: string;
  status: string;
  guest_id: string | null;
  questions: Array<{ answer: number; options?: string[] }>;
  host_index: number;
  guest_index: number;
  host_score: number;
  guest_score: number;
  host_finished?: boolean;
  guest_finished?: boolean;
  turn_ends_at: string | null;
  /** Per-question picks (-1 = no answer). Present once duel_upgrades.sql ran. */
  host_picks?: number[] | null;
  guest_picks?: number[] | null;
};

export type Plan =
  | { ok: true; updates: Record<string, unknown>; done: boolean }
  | { ok: false; status: number; error: string };

const ROUND_MS = DUEL.ROUND_SECONDS * 1000;

export const isSolo = (m: Pick<DuelMatch, "guest_id">) => !m.guest_id;

/** 0-based number of the question currently in play. */
export function currentRound(m: Pick<DuelMatch, "guest_id" | "host_index" | "guest_index">): number {
  const hi = m.host_index ?? 0;
  const gi = m.guest_index ?? 0;
  return isSolo(m) ? hi : Math.min(hi, gi);
}

/** Server deadline for a round that opens after the given lead-in. */
export function armDeadline(nowMs: number, lead: "first" | "reveal"): string {
  const leadSeconds = lead === "first" ? DUEL.FIRST_COUNTDOWN_SECONDS : DUEL.REVEAL_SECONDS;
  return new Date(nowMs + (leadSeconds + DUEL.ROUND_SECONDS) * 1000).toISOString();
}

/** Epoch ms when the current round opens for answers (NaN if no timer). */
export function roundStartMs(m: Pick<DuelMatch, "turn_ends_at">): number {
  return m.turn_ends_at ? Date.parse(m.turn_ends_at) - ROUND_MS : Number.NaN;
}

function withPick(picks: number[] | null | undefined, idx: number, pick: number): number[] {
  const out = Array.isArray(picks) ? picks.slice(0, idx) : [];
  while (out.length < idx) out.push(-1);
  out[idx] = pick;
  return out;
}

/**
 * Plan a player's answer (pick >= 0) or skip (pick = -1).
 * Returns the column updates to apply atomically, or an HTTP-style error.
 */
export function planAnswer(m: DuelMatch, side: Side, pick: number, nowMs: number): Plan {
  if (m.status !== "active") return { ok: false, status: 400, error: "Match is not active" };

  const total = m.questions.length;
  const idx = side === "host" ? m.host_index : m.guest_index;
  const round = currentRound(m);

  if (idx >= total) return { ok: false, status: 409, error: "You've already answered every question" };
  if (idx > round) return { ok: false, status: 409, error: "You already answered this question" };

  if (m.turn_ends_at) {
    const deadline = Date.parse(m.turn_ends_at);
    if (nowMs < deadline - ROUND_MS - DUEL.EARLY_TOLERANCE_MS) {
      return { ok: false, status: 425, error: "The next question hasn't opened yet" };
    }
    if (nowMs > deadline + DUEL.ANSWER_GRACE_MS) {
      return { ok: false, status: 409, error: "Time's up for this question" };
    }
  }

  const q = m.questions[idx];
  if (pick >= 0 && !(Number.isInteger(pick) && pick < (q.options?.length ?? 4))) {
    return { ok: false, status: 400, error: "Invalid answer choice" };
  }

  const correct = pick >= 0 && pick === q.answer;
  const score = (side === "host" ? m.host_score : m.guest_score) + (correct ? 1 : 0);
  const picks = withPick(side === "host" ? m.host_picks : m.guest_picks, idx, pick);

  const updates: Record<string, unknown> = {
    [`${side}_index`]: idx + 1,
    [`${side}_score`]: score,
    [`${side}_finished`]: idx + 1 >= total,
    [`${side}_picks`]: picks,
    current_turn: null,
  };

  // The round is over once everyone taking part has answered.
  const otherIdx = side === "host" ? m.guest_index : m.host_index;
  const resolved = isSolo(m) || otherIdx > round;
  let done = false;
  if (resolved) {
    if (round + 1 >= total) done = true;
    else updates.turn_ends_at = armDeadline(nowMs, "reveal");
  }
  return { ok: true, updates, done };
}

/**
 * If the round clock has run out (plus the answer grace), plan the skip for
 * whoever hasn't answered. `updates: {}` with done=true means every question
 * is already resolved but the match was never settled (self-heal).
 * Returns null when nothing needs doing.
 */
export function planTimeout(m: DuelMatch, nowMs: number): (Extract<Plan, { ok: true }>) | null {
  if (m.status !== "active") return null;
  const total = m.questions.length;
  const round = currentRound(m);

  if (round >= total) return { ok: true, updates: {}, done: true };

  if (!m.turn_ends_at) return null;
  if (nowMs <= Date.parse(m.turn_ends_at) + DUEL.ANSWER_GRACE_MS) return null;

  const updates: Record<string, unknown> = { current_turn: null };
  const sides: Side[] = isSolo(m) ? ["host"] : ["host", "guest"];
  for (const side of sides) {
    const idx = side === "host" ? m.host_index : m.guest_index;
    if (idx !== round) continue; // already answered this round
    updates[`${side}_index`] = idx + 1;
    updates[`${side}_finished`] = idx + 1 >= total;
    updates[`${side}_picks`] = withPick(side === "host" ? m.host_picks : m.guest_picks, idx, -1);
  }

  let done = false;
  if (round + 1 >= total) done = true;
  else updates.turn_ends_at = armDeadline(nowMs, "reveal");
  return { ok: true, updates, done };
}
