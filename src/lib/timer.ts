/**
 * Optional session timer.
 *
 * A session is either untimed ("none"), timed at the recommended JAMB pace ("auto"),
 * or timed for a fixed number of minutes (a numeric string such as "30").
 * The choice travels in the `timer` URL parameter between the setup pages and /exam.
 */
/** The mock CBT is always exactly this long (JAMB gives 2 hours for 180 questions). It cannot be changed. */
export const MOCK_EXAM_MINUTES = 120;

export type TimerChoice = "none" | "auto" | string;

export const TIMER_PRESETS = [10, 15, 30, 45, 60, 90] as const;
export const TIMER_MIN = 1;
export const TIMER_MAX = 300;

/** The mock exam is fixed at 2 hours; practice and study are untimed unless the student picks a timer. */
export function defaultTimer(isExam: boolean): TimerChoice {
  return isExam ? String(MOCK_EXAM_MINUTES) : "none";
}

/** Read the `timer` URL value. Understands the older labels ("15 minutes", "1 hour", "Recommended timer"). */
export function parseTimerParam(raw: string | null | undefined, isExam: boolean): TimerChoice {
  if (isExam) return defaultTimer(true); // the mock exam ignores any timer in the link
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return defaultTimer(isExam);
  if (v === "none" || v === "off" || v === "no timer" || v === "untimed") return "none";
  if (v === "auto" || v === "recommended" || v === "recommended timer") return "auto";
  if (v === "1 hour") return "60";
  const m = v.match(/^(\d{1,3})(?:\s*(?:m|min|mins|minutes?))?$/);
  if (m) {
    const n = Number(m[1]);
    if (n >= TIMER_MIN && n <= TIMER_MAX) return String(n);
  }
  return defaultTimer(isExam);
}

/** Minutes for a choice, or null when the session is untimed. */
export function timerMinutes(choice: TimerChoice, totalQuestions: number, isExam: boolean): number | null {
  if (isExam) return MOCK_EXAM_MINUTES;
  if (choice === "none") return null;
  if (choice === "auto") {
    // JAMB pace is 2 minutes per 3 questions; short drills get a small floor.
    return Math.max(5, Math.round((totalQuestions * 2) / 3));
  }
  const n = Math.round(Number(choice));
  if (!Number.isFinite(n)) return null;
  return Math.min(TIMER_MAX, Math.max(TIMER_MIN, n));
}

/** Short label for summaries, e.g. "No timer", "30 min". */
export function timerLabel(choice: TimerChoice, totalQuestions: number, isExam: boolean): string {
  if (choice === "none") return "No timer";
  const mins = timerMinutes(choice, totalQuestions, isExam);
  if (mins === null) return "No timer";
  return choice === "auto" ? `${mins} min · recommended` : `${mins} min`;
}
