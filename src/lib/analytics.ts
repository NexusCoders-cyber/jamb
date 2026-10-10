/**
 * Analytics maths, kept free of React and Supabase so it can be tested on its own.
 * Everything here works on the two lists the Analytics page loads:
 *   • attempts — one row per submitted exam / practice session
 *   • answers  — one light row per question in those attempts (subject, answered?, correct?)
 */
import type { AnswerLite, ExamAttempt } from "@/lib/queries";
import { accuracyToJamb, attemptJambScore } from "@/lib/scoring";

export const ENGLISH = "English Language";
/** Accuracy below this is "needs work"; from STRONG_FROM up is "strong" (same cut-offs the page always used) */
export const WEAK_BELOW = 60;
export const STRONG_FROM = 70;
/** A subject needs this many answered questions before it counts towards a projection or a trend */
export const MIN_ANSWERED = 10;

export type RangeKey = "7d" | "30d" | "all";
export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
];

const DAY = 24 * 60 * 60 * 1000;

export function filterAttempts(attempts: ExamAttempt[], range: RangeKey, now = Date.now()): ExamAttempt[] {
  if (range === "all") return attempts;
  const cutoff = now - (range === "7d" ? 7 : 30) * DAY;
  return attempts.filter((a) => a.submitted_at && new Date(a.submitted_at).getTime() >= cutoff);
}

export function filterAnswers(answers: AnswerLite[], attempts: ExamAttempt[]): AnswerLite[] {
  const ids = new Set(attempts.map((a) => a.id));
  return answers.filter((r) => ids.has(r.attempt_id));
}

// ─── Subjects ────────────────────────────────────────────────────────────────
export type SubjectRow = {
  name: string;
  answered: number;
  correct: number;
  wrong: number;
  unanswered: number;
  /** correct ÷ answered, whole percent */
  accuracy: number;
  /** accuracy over the latest sessions vs the ones before; null when there is not enough data */
  trend: number | null;
  level: "strong" | "average" | "weak";
};

export function levelOf(accuracy: number): SubjectRow["level"] {
  return accuracy >= STRONG_FROM ? "strong" : accuracy >= WEAK_BELOW ? "average" : "weak";
}

const pct = (correct: number, answered: number): number => (answered > 0 ? Math.round((correct / answered) * 100) : 0);

/** Weakest first, so the subject that needs attention is at the top. */
export function subjectRows(answers: AnswerLite[], attempts: ExamAttempt[]): SubjectRow[] {
  const when = new Map(attempts.map((a) => [a.id, a.submitted_at ? new Date(a.submitted_at).getTime() : 0]));
  type Acc = { answered: number; correct: number; unanswered: number; bySession: Map<string, { answered: number; correct: number }> };
  const bySubject = new Map<string, Acc>();
  for (const r of answers) {
    const acc = bySubject.get(r.subject) ?? { answered: 0, correct: 0, unanswered: 0, bySession: new Map() };
    if (r.answered) {
      acc.answered += 1;
      if (r.correct) acc.correct += 1;
      const s = acc.bySession.get(r.attempt_id) ?? { answered: 0, correct: 0 };
      s.answered += 1;
      if (r.correct) s.correct += 1;
      acc.bySession.set(r.attempt_id, s);
    } else {
      acc.unanswered += 1;
    }
    bySubject.set(r.subject, acc);
  }

  const rows: SubjectRow[] = [];
  bySubject.forEach((acc, name) => {
    if (acc.answered === 0 && acc.unanswered === 0) return;
    // trend: the latest sessions of this subject (up to 3) against the ones before them
    const sessions = Array.from(acc.bySession.entries()).sort((a, b) => (when.get(a[0]) ?? 0) - (when.get(b[0]) ?? 0));
    let trend: number | null = null;
    if (sessions.length >= 2) {
      const recentCount = Math.min(3, sessions.length - 1);
      const sum = (list: typeof sessions) => list.reduce((t, [, s]) => ({ a: t.a + s.answered, c: t.c + s.correct }), { a: 0, c: 0 });
      const recent = sum(sessions.slice(-recentCount));
      const earlier = sum(sessions.slice(0, sessions.length - recentCount));
      if (recent.a >= 5 && earlier.a >= 5) trend = pct(recent.c, recent.a) - pct(earlier.c, earlier.a);
    }
    const accuracy = pct(acc.correct, acc.answered);
    rows.push({
      name,
      answered: acc.answered,
      correct: acc.correct,
      wrong: acc.answered - acc.correct,
      unanswered: acc.unanswered,
      accuracy,
      trend,
      level: levelOf(accuracy),
    });
  });
  return rows.sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered);
}

// ─── Projection ──────────────────────────────────────────────────────────────
export type Projection = {
  /** Estimated UTME score out of 400 */
  total: number;
  /** The subjects used, English first, each scored out of 100 */
  parts: { name: string; score: number }[];
  /** true when English + three other subjects each had enough answers */
  complete: boolean;
};

/**
 * UTME is English + 3 subjects, each scored out of 100. Take English and the three strongest other
 * subjects that have enough answers. With fewer than four, average what exists and scale to 400.
 */
export function projectedJamb(rows: SubjectRow[]): Projection | null {
  const usable = rows.filter((r) => r.answered >= MIN_ANSWERED);
  if (usable.length === 0) return null;
  const english = usable.find((r) => r.name === ENGLISH);
  const others = usable
    .filter((r) => r.name !== ENGLISH && r.name !== "Unknown")
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, english ? 3 : 4);
  const chosen = english ? [english, ...others] : others;
  if (chosen.length === 0) return null;
  const mean = chosen.reduce((t, r) => t + r.accuracy, 0) / chosen.length;
  return {
    total: Math.round(mean * 4),
    parts: chosen.map((r) => ({ name: r.name, score: r.accuracy })),
    complete: !!english && chosen.length === 4,
  };
}

// ─── Charts ──────────────────────────────────────────────────────────────────
export type ChartPoint = { id: string; pct: number; jamb: number; label: string };

export function chartPoints(attempts: ExamAttempt[], n = 10): ChartPoint[] {
  return attempts
    .filter((a) => a.submitted_at)
    .sort((a, b) => new Date(a.submitted_at!).getTime() - new Date(b.submitted_at!).getTime())
    .slice(-n)
    .map((a) => ({
      id: a.id,
      pct: a.question_count > 0 ? Math.round(((a.score ?? 0) / a.question_count) * 100) : 0,
      jamb: attemptJambScore(a),
      label: new Date(a.submitted_at!).toLocaleDateString("en-NG", { day: "numeric", month: "short" }),
    }));
}

export type ActivityDay = { key: string; label: string; questions: number; isToday: boolean };

/** Questions attempted per day over the last `days` days (oldest → today). */
export function activityDays(attempts: ExamAttempt[], days = 7, now = Date.now()): ActivityDay[] {
  const dayKey = (t: number) => {
    const d = new Date(t);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };
  const totals = new Map<string, number>();
  for (const a of attempts) {
    if (!a.submitted_at) continue;
    const k = dayKey(new Date(a.submitted_at).getTime());
    totals.set(k, (totals.get(k) ?? 0) + (a.question_count ?? 0));
  }
  const out: ActivityDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const t = now - i * DAY;
    out.push({
      key: dayKey(t),
      label: new Date(t).toLocaleDateString("en-NG", { weekday: "short" }),
      questions: totals.get(dayKey(t)) ?? 0,
      isToday: i === 0,
    });
  }
  return out;
}

// ─── Attempts (history list) ─────────────────────────────────────────────────
export type AttemptSubject = { name: string; correct: number; answered: number };

/** Subjects inside each attempt, English first then alphabetical (database row order is random). */
export function attemptSubjects(answers: AnswerLite[]): Map<string, AttemptSubject[]> {
  const byAttempt = new Map<string, Map<string, AttemptSubject>>();
  for (const r of answers) {
    if (r.subject === "Unknown") continue;
    const subjects = byAttempt.get(r.attempt_id) ?? new Map<string, AttemptSubject>();
    const s = subjects.get(r.subject) ?? { name: r.subject, correct: 0, answered: 0 };
    if (r.answered) {
      s.answered += 1;
      if (r.correct) s.correct += 1;
    }
    subjects.set(r.subject, s);
    byAttempt.set(r.attempt_id, subjects);
  }
  const out = new Map<string, AttemptSubject[]>();
  byAttempt.forEach((subjects, id) => {
    out.set(
      id,
      Array.from(subjects.values()).sort((a, b) => (a.name === ENGLISH ? -1 : b.name === ENGLISH ? 1 : a.name.localeCompare(b.name))),
    );
  });
  return out;
}

export type AttemptLabel = { kind: "mock" | "practice"; title: string };

export function attemptLabel(a: Pick<ExamAttempt, "question_count">, subjects: AttemptSubject[] | undefined): AttemptLabel {
  const n = subjects?.length ?? 0;
  if (n >= 3 || a.question_count >= 100) return { kind: "mock", title: "Mock exam" };
  if (n === 1) return { kind: "practice", title: subjects![0].name };
  if (n === 2) return { kind: "practice", title: subjects!.map((s) => s.name.replace(" Language", "")).join(" + ") };
  return { kind: "practice", title: "Practice session" };
}

// ─── Totals & insights ───────────────────────────────────────────────────────
export type Totals = { answered: number; correct: number; unanswered: number; accuracy: number };

/** Prefer the per-question rows; older attempts without rows fall back to the attempt totals. */
export function totals(answers: AnswerLite[], attempts: ExamAttempt[]): Totals {
  if (answers.length > 0) {
    const answered = answers.filter((r) => r.answered).length;
    const correct = answers.filter((r) => r.answered && r.correct).length;
    return { answered, correct, unanswered: answers.length - answered, accuracy: pct(correct, answered) };
  }
  const q = attempts.reduce((t, a) => t + (a.question_count ?? 0), 0);
  const c = attempts.reduce((t, a) => t + (a.score ?? 0), 0);
  return { answered: q, correct: c, unanswered: 0, accuracy: pct(c, q) };
}

export type InsightItem = { text: string; /** where a one-tap action goes, when there is one */ href?: string; cta?: string };

const studyHref = (subject: string) => `/exam?mode=study&subject=${encodeURIComponent(subject)}&count=20`;
const shortName = (n: string) => n.replace(" Language", "");

/** What to focus on, each with a one-tap action where one makes sense. */
export function insightItems(rows: SubjectRow[], t: Totals, attempts: ExamAttempt[], now = Date.now()): InsightItem[] {
  const out: InsightItem[] = [];
  const ranked = rows.filter((r) => r.answered >= MIN_ANSWERED && r.name !== "Unknown");
  if (ranked.length >= 2) {
    const best = ranked[ranked.length - 1];
    const worst = ranked[0];
    if (best.accuracy >= STRONG_FROM) out.push({ text: `Your strongest subject is ${shortName(best.name)} at ${best.accuracy}%.` });
    if (worst.accuracy < WEAK_BELOW)
      out.push({ text: `${shortName(worst.name)} needs the most work (${worst.accuracy}%). Practise it next.`, href: studyHref(worst.name), cta: `Practise ${shortName(worst.name)}` });
  } else if (ranked.length === 1 && ranked[0].accuracy < WEAK_BELOW) {
    out.push({
      text: `${shortName(ranked[0].name)} is at ${ranked[0].accuracy}%. A few more practice sessions will lift it.`,
      href: studyHref(ranked[0].name),
      cta: `Practise ${shortName(ranked[0].name)}`,
    });
  }
  const improved = rows
    .filter((r) => r.trend !== null && r.trend >= 5 && r.name !== "Unknown")
    .sort((a, b) => (b.trend ?? 0) - (a.trend ?? 0))[0];
  if (improved) out.push({ text: `${shortName(improved.name)} is improving: up ${improved.trend} points lately.` });
  const slipping = rows
    .filter((r) => r.trend !== null && r.trend <= -5 && r.name !== "Unknown")
    .sort((a, b) => (a.trend ?? 0) - (b.trend ?? 0))[0];
  if (slipping)
    out.push({ text: `${shortName(slipping.name)} dropped ${Math.abs(slipping.trend ?? 0)} points lately. Revise it.`, href: studyHref(slipping.name), cta: `Revise ${shortName(slipping.name)}` });
  const total = t.answered + t.unanswered;
  if (total >= 20 && t.unanswered / total >= 0.1) {
    out.push({ text: `You left ${Math.round((t.unanswered / total) * 100)}% of questions blank. UTME has no negative marking, so always pick an answer.` });
  }
  const week = attempts.filter((a) => a.submitted_at && new Date(a.submitted_at).getTime() >= now - 7 * DAY).length;
  if (attempts.length > 0 && week === 0)
    out.push({ text: "You have not practised in the last 7 days. A short session today keeps your streak alive.", href: "/practice", cta: "Start a session" });
  return out.slice(0, 4);
}

/** Plain-text version of insightItems (kept for callers that only need the sentences). */
export function insights(rows: SubjectRow[], t: Totals, attempts: ExamAttempt[], now = Date.now()): string[] {
  return insightItems(rows, t, attempts, now).map((i) => i.text);
}

export { accuracyToJamb };
