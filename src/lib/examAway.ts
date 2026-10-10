/**
 * The "stay on the exam" rule, like a real JAMB CBT centre: a student who leaves the exam screen
 * (switches app, locks the phone, opens another tab) has ONE minute to come back. After that the exam ends
 * and what they have answered so far is submitted. Pure, so `npm test` can check it.
 */

export const AWAY_LIMIT_MS = 60_000;

export type AwayVerdict = "continue" | "ended";

/** Did the student come back in time? `leftAt` and `now` are milliseconds since 1970. */
export function awayVerdict(leftAt: number, now: number): AwayVerdict {
  // a clock that moved backwards is treated as "just left", never as a free pass
  return now - leftAt >= AWAY_LIMIT_MS ? "ended" : "continue";
}

/** Whole seconds left to come back, never below 0 */
export function awaySecondsLeft(leftAt: number, now: number): number {
  return Math.max(0, Math.ceil((AWAY_LIMIT_MS - (now - leftAt)) / 1000));
}

export const AWAY_RULE = "Stay on the exam screen. If you leave the app for more than 1 minute, the exam ends and your answers so far are submitted.";
export const AWAY_ENDED_NOTE = "Your exam ended because you were away from the exam screen for more than 1 minute. Your answers so far were submitted.";
