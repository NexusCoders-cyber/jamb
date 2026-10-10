/**
 * Date and trend maths shared by the dashboard and the analytics page.
 *
 * Everything here is pure (no React, no network, no imports from other app files) so it can be unit-tested
 * with `npm test`. The one rule that matters: a "day" is a day in Lagos (UTC+1, no daylight saving), whatever
 * the phone's own clock says, so the dashboard, the analytics page and the streak always agree.
 */

export const LAGOS_TZ = "Africa/Lagos";
export const DAY_MS = 24 * 60 * 60 * 1000;
/** JAMB marks: 400 over 180 questions, so a session's mark is score ÷ questions × 400 */
export const JAMB_MAX = 400;
/** A session of at least this many questions counts as a full mock rather than a practice drill */
export const MOCK_MIN_QUESTIONS = 100;
export const DEFAULT_DAILY_GOAL = 20;

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: LAGOS_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat("en-NG", { timeZone: LAGOS_TZ, weekday: "short" });
const dateFmt = new Intl.DateTimeFormat("en-NG", { timeZone: LAGOS_TZ, day: "numeric", month: "short" });
const longDateFmt = new Intl.DateTimeFormat("en-NG", { timeZone: LAGOS_TZ, weekday: "short", day: "numeric", month: "short" });

/** "2026-10-10" — the Lagos calendar day a moment falls on */
export function lagosDayKey(t: number | Date | string): string {
  return dayFmt.format(typeof t === "number" || typeof t === "string" ? new Date(t) : t);
}

export const lagosWeekday = (t: number | Date): string => weekdayFmt.format(t);
export const lagosDate = (t: number | Date | string): string => dateFmt.format(typeof t === "number" || typeof t === "string" ? new Date(t) : t);
export const lagosLongDate = (t: number | Date): string => longDateFmt.format(t);

/** The Lagos day key `offset` days away from `key` (negative = earlier). Works on the calendar, so no clock drift. */
export function shiftDayKey(key: string, offset: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + offset));
  return dt.toISOString().slice(0, 10);
}

/** Noon UTC on a day key — a safe moment to format as that Lagos day */
const keyToMoment = (key: string): number => Date.parse(`${key}T12:00:00Z`);

export type DayInfo = { key: string; label: string; longLabel: string; isToday: boolean };

/** The last `n` Lagos days, oldest first, ending with today */
export function lastDays(n: number, now: number = Date.now()): DayInfo[] {
  const today = lagosDayKey(now);
  return Array.from({ length: n }, (_, i) => {
    const key = shiftDayKey(today, i - (n - 1));
    const moment = keyToMoment(key);
    return { key, label: lagosWeekday(moment), longLabel: lagosLongDate(moment), isToday: key === today };
  });
}

// ─── Score over time ────────────────────────────────────────────────────────────

export type AttemptLike = {
  id: string;
  question_count: number;
  score: number;
  submitted_at: string | null;
};

export type TrendPoint = {
  id: string;
  /** milliseconds since 1970 */
  t: number;
  label: string;
  /** mark out of 400 */
  jamb: number;
  /** percent correct */
  pct: number;
  correct: number;
  total: number;
  kind: "mock" | "practice";
};

export const toJamb = (correct: number, total: number): number => (total > 0 ? Math.round((correct / total) * JAMB_MAX) : 0);

/**
 * Finished sessions as chart points, oldest first. Keeps the latest `max` points.
 * `mocksOnly` drops short practice sessions, whose marks swing a lot because there are so few questions.
 */
export function scoreSeries(attempts: AttemptLike[], opts: { mocksOnly?: boolean; max?: number } = {}): TrendPoint[] {
  const max = opts.max ?? 20;
  const pts: TrendPoint[] = [];
  for (const a of attempts) {
    if (!a.submitted_at) continue;
    const t = new Date(a.submitted_at).getTime();
    if (Number.isNaN(t) || !(a.question_count > 0)) continue;
    const correct = Math.max(0, a.score ?? 0);
    pts.push({
      id: a.id,
      t,
      label: lagosDate(t),
      jamb: toJamb(correct, a.question_count),
      pct: Math.round((correct / a.question_count) * 100),
      correct,
      total: a.question_count,
      kind: a.question_count >= MOCK_MIN_QUESTIONS ? "mock" : "practice",
    });
  }
  pts.sort((a, b) => a.t - b.t);
  const filtered = opts.mocksOnly ? pts.filter((p) => p.kind === "mock") : pts;
  return filtered.slice(-max);
}

export type YScale = { min: number; max: number; ticks: number[] };

/**
 * A y-axis that fits the data and the target with some breathing room, in steps of 50 or 100 marks,
 * never outside 0–400 and never tighter than 150 marks (so a small wobble does not look like a cliff).
 */
export function yScale(values: number[], target?: number): YScale {
  const all = [...values, ...(target !== undefined ? [target] : [])].filter((v) => Number.isFinite(v));
  let lo = all.length ? Math.min(...all) : 0;
  let hi = all.length ? Math.max(...all) : JAMB_MAX;
  lo = Math.max(0, Math.floor((lo - 30) / 50) * 50);
  hi = Math.min(JAMB_MAX, Math.ceil((hi + 30) / 50) * 50);
  if (hi - lo < 150) {
    lo = Math.round(((lo + hi) / 2 - 75) / 50) * 50;
    hi = lo + 150;
    if (lo < 0) {
      lo = 0;
      hi = 150;
    }
    if (hi > JAMB_MAX) {
      hi = JAMB_MAX;
      lo = JAMB_MAX - 150;
    }
  }
  const step = hi - lo > 250 ? 100 : 50;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  return { min: lo, max: hi, ticks };
}

/** Index of the point whose x is closest to `x` (all in the same units); -1 for an empty list */
export function nearestIndex(xs: number[], x: number): number {
  let best = -1;
  let bestDist = Infinity;
  xs.forEach((px, i) => {
    const d = Math.abs(px - x);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

/**
 * Horizontal positions (0..1) for the chart points. Points sit at their real dates, but never closer than
 * `minGap` so two sessions on the same day stay separate dots you can tap.
 */
export function spreadX(times: number[], minGap = 0.06): number[] {
  const n = times.length;
  if (n === 0) return [];
  if (n === 1) return [0.5];
  const t0 = times[0];
  const span = times[n - 1] - t0;
  let xs = times.map((t) => (span > 0 ? (t - t0) / span : 0));
  // too many points to keep the gap → fall back to even spacing
  if (minGap * (n - 1) >= 1) return times.map((_, i) => i / (n - 1));
  // push right where needed, then pull back from the right edge
  for (let i = 1; i < n; i++) xs[i] = Math.max(xs[i], xs[i - 1] + minGap);
  if (xs[n - 1] > 1) {
    xs[n - 1] = 1;
    for (let i = n - 2; i >= 0; i--) xs[i] = Math.min(xs[i], xs[i + 1] - minGap);
  }
  xs = xs.map((x) => Math.min(1, Math.max(0, x)));
  return xs;
}

// ─── This week ────────────────────────────────────────────────────────────────

export type DayBar = DayInfo & {
  questions: number;
  correct: number;
  /** percent correct that day, null when nothing was answered */
  accuracy: number | null;
  hitGoal: boolean;
};

export type WeekSummary = {
  days: DayBar[];
  total: number;
  daysPractised: number;
  best: DayBar | null;
  previousTotal: number;
  /** percent change against the 7 days before; null when there was no activity before to compare with */
  changePct: number | null;
};

/** Questions per Lagos day for the last 7 days, plus the totals the summary row needs */
export function weekSummary(attempts: AttemptLike[], goal: number = DEFAULT_DAILY_GOAL, now: number = Date.now()): WeekSummary {
  const perDay = new Map<string, { q: number; c: number }>();
  for (const a of attempts) {
    if (!a.submitted_at || !(a.question_count > 0)) continue;
    const key = lagosDayKey(a.submitted_at);
    const cur = perDay.get(key) ?? { q: 0, c: 0 };
    cur.q += a.question_count;
    cur.c += Math.max(0, a.score ?? 0);
    perDay.set(key, cur);
  }
  const days: DayBar[] = lastDays(7, now).map((d) => {
    const v = perDay.get(d.key);
    return {
      ...d,
      questions: v?.q ?? 0,
      correct: v?.c ?? 0,
      accuracy: v && v.q > 0 ? Math.round((v.c / v.q) * 100) : null,
      hitGoal: (v?.q ?? 0) >= goal && goal > 0,
    };
  });
  const total = days.reduce((s, d) => s + d.questions, 0);
  const prevKeys = lastDays(14, now).slice(0, 7).map((d) => d.key);
  const previousTotal = prevKeys.reduce((s, k) => s + (perDay.get(k)?.q ?? 0), 0);
  const best = days.reduce<DayBar | null>((b, d) => (d.questions > 0 && (!b || d.questions > b.questions) ? d : b), null);
  return {
    days,
    total,
    daysPractised: days.filter((d) => d.questions > 0).length,
    best,
    previousTotal,
    changePct: previousTotal > 0 ? Math.round(((total - previousTotal) / previousTotal) * 100) : null,
  };
}

/** The daily question goal from the saved preferences string (`orbit_prefs`), 20 if missing or silly */
export function parseDailyGoal(raw: string | null | undefined): number {
  try {
    const n = Number((JSON.parse(raw ?? "{}") as { dailyGoal?: unknown }).dailyGoal);
    return Number.isFinite(n) && n >= 5 && n <= 500 ? Math.round(n) : DEFAULT_DAILY_GOAL;
  } catch {
    return DEFAULT_DAILY_GOAL;
  }
}
