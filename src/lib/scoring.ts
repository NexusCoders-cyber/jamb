/**
 * Shared scoring engine — the single source of truth for JAMB-scale
 * practice estimates and target tracking. Used by the dashboard hero card,
 * analytics, results, and the admin dashboard so every surface shows the
 * same number computed the same way.
 *
 * JAMB/UTME scale: 400 marks over 180 questions ⇒ each question is worth
 * 400/180 ≈ 2.22 marks. A session's JAMB score is therefore
 * score / question_count × 400 — identical to accuracy% × 400.
 */

import type { ExamAttempt } from "@/lib/queries";

export const JAMB_TOTAL = 400;
/** Questions in a full UTME paper (English 60 + 3 subjects × 40). */
export const JAMB_QUESTIONS = 180;

/** Convert an accuracy ratio (0..1) to the JAMB 400 scale. */
export function accuracyToJamb(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * JAMB_TOTAL);
}

/**
 * Question-weighted JAMB estimate: each attempt contributes in proportion to
 * its length, so a 180-question mock counts 36× more than a 5-question drill.
 * Falls back to the raw average when there is no question data.
 */
export function weightedJambEstimate(attempts: Pick<ExamAttempt, "score" | "question_count">[]): number {
  const totalQ = attempts.reduce((s, a) => s + (a.question_count ?? 0), 0);
  const totalC = attempts.reduce((s, a) => s + (a.score ?? 0), 0);
  return accuracyToJamb(totalC, totalQ);
}

export type TargetStatus = {
  estimate: number;
  target: number;
  progressPct: number;
  /** estimate >= target */
  onTrack: boolean;
  /** Marks still needed to hit the target (0 when reached). */
  marksRemaining: number;
  /** Headline for the dashboard card. */
  headline: string;
  /** Color bucket for progress bars / badges. */
  tone: "excellent" | "good" | "behind" | "none";
};

export function targetStatus(estimate: number, target: number): TargetStatus {
  const safeTarget = target > 0 ? target : JAMB_TOTAL;
  const progressPct = Math.min(100, Math.round((estimate / safeTarget) * 100));
  const onTrack = estimate >= safeTarget;
  const marksRemaining = Math.max(0, safeTarget - estimate);
  const tone: TargetStatus["tone"] =
    progressPct >= 90 ? "excellent" : progressPct >= 65 ? "good" : progressPct > 0 ? "behind" : "none";

  let headline: string;
  if (onTrack) headline = "Target reached — keep it up";
  else if (progressPct >= 90) headline = `So close — ${marksRemaining} marks to go`;
  else if (progressPct >= 65) headline = `${progressPct}% of your target`;
  else if (progressPct > 0) headline = `${progressPct}% to your target`;
  else headline = "Complete your first exam";

  return { estimate, target: safeTarget, progressPct, onTrack, marksRemaining, headline, tone };
}

/** Per-attempt JAMB-scale score, for tables/breakdowns. */
export function attemptJambScore(a: Pick<ExamAttempt, "score" | "question_count">): number {
  return accuracyToJamb(a.score ?? 0, a.question_count ?? 0);
}

/**
 * Best JAMB-scale score across attempts and the attempt that achieved it.
 */
export function bestAttempt(attempts: Pick<ExamAttempt, "id" | "score" | "question_count" | "submitted_at">[]) {
  let best: { id: string; jamb: number; at: string | null } | null = null;
  for (const a of attempts) {
    const jamb = attemptJambScore(a);
    if (!best || jamb > best.jamb) {
      best = { id: a.id, jamb, at: a.submitted_at ?? null };
    }
  }
  return best;
}

/**
 * Trend over the last N submitted attempts (oldest → newest), as JAMB-scale
 * scores. Returns [] when there is nothing to compare.
 */
export function scoreTrend(attempts: Pick<ExamAttempt, "score" | "question_count" | "submitted_at">[], n = 5): number[] {
  const chronological = [...attempts]
    .filter((a) => a.submitted_at)
    .sort((a, b) => new Date(a.submitted_at!).getTime() - new Date(b.submitted_at!).getTime());
  return chronological.slice(-n).map(attemptJambScore);
}
