"use client";

/**
 * ScoreSummary — the hero shown the moment a CBT / practice session is submitted.
 *
 * Mobile-first (Android / iOS): everything fits a 360px-wide screen with no
 * horizontal scroll, uses dvh/safe-area friendly spacing and 44px+ tap targets.
 *
 *  - Animated score ring (JAMB scale, /400) that counts up on arrival
 *  - Grade headline + target tracking
 *  - Correct / Wrong / Unanswered tiles (+ time used when known)
 *  - Per-subject JAMB-style scores (/100 each) for multi-subject mocks
 *  - Primary actions: Review corrections, Try again, New session, Dashboard
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Clock, ListChecks, RotateCcw, Target, Trophy } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getProfile } from "@/lib/queries";
import { JAMB_TOTAL, targetStatus } from "@/lib/scoring";

export type SubjectScore = {
  name: string;
  correct: number;
  wrong: number;
  unanswered: number;
  total: number;
  pct: number;
};

type Props = {
  subject: string;
  /** Questions answered correctly */
  correct: number;
  /** Total questions in the session (blank ones included) */
  total: number;
  /** Questions left blank */
  unanswered: number;
  /** Questions answered wrongly. Derived from the other counts when omitted. */
  wrong?: number;
  /** Per-subject results (only passed for multi-subject mocks) */
  subjects?: SubjectScore[];
  /** Seconds the student spent, when known */
  timeUsedSeconds?: number | null;
  /** Restart handler. When omitted, `retryHref` is used as a normal link instead. */
  onRetry?: () => void;
  retryHref?: string;
  /** Scrolls to / opens the corrections section */
  onReview?: () => void;
  /** Link to the correction room, used when there is no in-page `onReview` */
  reviewHref?: string;
  /**
   * The student's target score. `undefined` → the card looks it up itself;
   * a number → shown as given; `null` → no target row (e.g. profile still loading).
   */
  target?: number | null;
};

const shortName = (n: string) => n.replace(" Language", "");

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

type Grade = { title: string; note: string; stroke: string };

function gradeFor(pct: number): Grade {
  if (pct >= 80) return { title: "Outstanding!", note: "You're performing at top-scorer level.", stroke: "#fcd34d" };
  if (pct >= 70) return { title: "Great performance!", note: "Strong result — keep the momentum going.", stroke: "#a7f3d0" };
  if (pct >= 50) return { title: "Keep pushing!", note: "You're getting there. Fix the weak spots below.", stroke: "#fde68a" };
  if (pct >= 40) return { title: "Fair attempt", note: "Review your corrections to climb higher.", stroke: "#fdba74" };
  return { title: "More practice needed", note: "Every correction you study is marks gained.", stroke: "#fda4af" };
}

/** Counts 0 → value once on mount; instant when the user prefers reduced motion. */
function useCountUp(value: number, ms = 1100): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 0 : ms;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return n;
}

export default function ScoreSummary({
  subject,
  correct,
  total,
  unanswered,
  wrong: wrongProp,
  subjects = [],
  timeUsedSeconds = null,
  onRetry,
  retryHref = "/practice",
  onReview,
  reviewHref,
  target: targetProp,
}: Props) {
  const { user } = useUser();
  const [fetchedTarget, setFetchedTarget] = useState<number | null>(null);
  const target = targetProp !== undefined ? targetProp : fetchedTarget;
  const [armed, setArmed] = useState(false);

  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const jamb = total > 0 ? Math.round((correct / total) * JAMB_TOTAL) : 0;
  const answered = Math.max(total - unanswered, 0);
  const wrong = wrongProp ?? Math.max(answered - correct, 0);
  const grade = useMemo(() => gradeFor(pct), [pct]);
  const shown = useCountUp(jamb);

  // Student's own target (optional — the hero works without it)
  useEffect(() => {
    if (!user || targetProp !== undefined) return;
    let cancelled = false;
    try {
      const supabase = createSupabaseBrowserClient();
      getProfile(supabase, user.id)
        .then((p) => {
          if (!cancelled && p?.target_score) setFetchedTarget(p.target_score);
        })
        .catch(() => {});
    } catch {
      /* env missing — skip target */
    }
    return () => {
      cancelled = true;
    };
  }, [user, targetProp]);

  // Arm the ring one frame after mount so the stroke animates in
  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const status = target ? targetStatus(jamb, target) : null;

  // Ring geometry
  const R = 54;
  const C = 2 * Math.PI * R;
  const dash = armed ? C * (1 - Math.min(jamb / JAMB_TOTAL, 1)) : C;

  // Fixed colours on purpose: this card sits on its own green gradient in both light and dark themes,
  // so it must not be touched by the dark-mode class remapper.
  const tiles = [
    { label: "Correct", value: String(correct), bg: "rgba(2, 44, 34, 0.30)", edge: "rgba(110, 231, 183, 0.35)", dot: "#6ee7b7" },
    { label: "Wrong", value: String(wrong), bg: "rgba(76, 5, 25, 0.25)", edge: "rgba(253, 164, 175, 0.35)", dot: "#fda4af" },
    { label: "Skipped", value: String(unanswered), bg: "rgba(2, 6, 23, 0.25)", edge: "rgba(255, 255, 255, 0.22)", dot: "#cbd5e1" },
  ];
  const barColor = (p: number) => (p >= 70 ? "#a7f3d0" : p >= 50 ? "#fde68a" : "#fda4af");

  return (
    <section
      aria-labelledby="score-title"
      className="mb-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-600 text-white shadow-xl shadow-emerald-900/20"
    >
      {/* Header strip */}
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-100/90">
          Results · {subject}
        </p>
        {timeUsedSeconds != null && timeUsedSeconds > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-emerald-50 ring-1 ring-white/15">
            <Clock className="h-3 w-3" aria-hidden /> {formatDuration(timeUsedSeconds)}
          </span>
        )}
      </div>

      {/* Score ring */}
      <div className="flex flex-col items-center px-5 pb-2 pt-4">
        <div className="relative h-44 w-44 sm:h-48 sm:w-48" role="img" aria-label={`Score ${jamb} out of ${JAMB_TOTAL}`}>
          <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
            <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="10" />
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              stroke={grade.stroke}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={dash}
              style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span id="score-title" className="text-5xl font-black leading-none tabular-nums sm:text-6xl">
              {shown}
            </span>
            <span className="mt-1 text-sm font-bold text-emerald-100">out of {JAMB_TOTAL}</span>
          </div>
        </div>

        <p className="mt-3 text-center text-xl font-black leading-tight">{grade.title}</p>
        <p className="mt-1 max-w-xs text-center text-sm text-emerald-100">{grade.note}</p>
        <p className="mt-2 text-center text-sm font-bold">
          {correct} / {total} correct · {pct}%
        </p>
      </div>

      {/* Target tracking */}
      {status && (
        <div className="mx-5 mt-3 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15">
          <div className="flex items-center justify-between gap-2 text-sm font-bold">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-emerald-50">
              <Target className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">Your target: {status.target}</span>
            </span>
            <span className={`shrink-0 ${status.onTrack ? "text-amber-200" : "text-emerald-50"}`}>
              {status.onTrack ? (
                <span className="inline-flex items-center gap-1">
                  <Trophy className="h-4 w-4" aria-hidden /> Target beaten!
                </span>
              ) : (
                `${status.marksRemaining} marks to go`
              )}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full"
              style={{
                backgroundColor: "#fde68a",
                width: armed ? `${status.progressPct}%` : "0%",
                transition: "width 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </div>
        </div>
      )}

      {/* Correct / Wrong / Skipped */}
      <div className="mt-4 grid grid-cols-3 gap-2.5 px-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl px-2 py-3 text-center" style={{ backgroundColor: t.bg, boxShadow: `inset 0 0 0 1px ${t.edge}` }}>
            <p className="text-2xl font-black tabular-nums leading-none">{t.value}</p>
            <p className="mt-1.5 inline-flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-50/90">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.dot }} aria-hidden />
              {t.label}
            </p>
          </div>
        ))}
      </div>

      {/* Subject scores — each subject out of 100, like the real UTME slip */}
      {subjects.length > 1 && (
        <div className="mt-4 px-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-100/90">Score by subject</p>
          <ul className="space-y-2.5">
            {subjects.map((s) => (
              <li key={s.name} className="rounded-2xl bg-white/10 px-3.5 py-3 ring-1 ring-white/10">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-bold">{shortName(s.name)}</span>
                  <span className="shrink-0 tabular-nums">
                    <span className="text-lg font-black">{s.pct}</span>
                    <span className="text-xs font-bold text-emerald-100/80">/100</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: barColor(s.pct),
                      width: armed ? `${s.pct}%` : "0%",
                      transition: "width 1.1s cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] font-semibold text-emerald-100/80">
                  {s.correct}/{s.total} correct · {s.wrong} wrong · {s.unanswered} skipped
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="mt-5 grid gap-2.5 px-5" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        {(onReview || reviewHref) && (
          // Inline colours on purpose: this button must stay white-on-green in dark mode too
          onReview ? (
            <button
              type="button"
              onClick={onReview}
              style={{ backgroundColor: "#ffffff", color: "#064e3b" }}
              className="flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black shadow-lg shadow-black/10 active:scale-[0.99]"
            >
              <ListChecks className="h-4 w-4" aria-hidden /> Review corrections <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <Link
              href={reviewHref as string}
              style={{ backgroundColor: "#ffffff", color: "#064e3b" }}
              className="flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black shadow-lg shadow-black/10 active:scale-[0.99]"
            >
              <ListChecks className="h-4 w-4" aria-hidden /> Review corrections <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )
        )}
        <div className="grid grid-cols-2 gap-2.5">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="flex min-h-12 touch-manipulation items-center justify-center gap-1.5 rounded-2xl border border-white/30 px-3 text-sm font-bold text-white active:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" aria-hidden /> Try again
            </button>
          ) : (
            <Link
              href={retryHref}
              className="flex min-h-12 touch-manipulation items-center justify-center gap-1.5 rounded-2xl border border-white/30 px-3 text-sm font-bold text-white active:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" aria-hidden /> Practice again
            </Link>
          )}
          <Link
            href="/practice"
            className="flex min-h-12 touch-manipulation items-center justify-center rounded-2xl border border-white/30 px-3 text-sm font-bold text-white active:bg-white/10"
          >
            New session
          </Link>
        </div>
        <Link
          href="/dashboard"
          className="flex min-h-11 touch-manipulation items-center justify-center rounded-2xl text-sm font-bold text-emerald-100 underline-offset-4 hover:underline"
        >
          Back to dashboard
        </Link>
        <p className="text-center text-[11px] leading-4 text-emerald-100/70">
          Practice estimate on the JAMB 400 scale — not an official result.
        </p>
      </div>
    </section>
  );
}
