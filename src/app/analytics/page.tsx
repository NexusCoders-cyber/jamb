"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import ScoreChart from "@/components/analytics/ScoreChart";
import WeekChart from "@/components/analytics/WeekChart";
import { useDailyGoal } from "@/lib/dailyGoal";
import { PaywallGate } from "@/components/Paywall";
import { getAnalyticsData, getProfile } from "@/lib/queries";
import type { AnswerLite, ExamAttempt } from "@/lib/queries";
import { weightedJambEstimate, targetStatus, bestAttempt, scoreTrend, attemptJambScore } from "@/lib/scoring";
import {
  RANGES,
  attemptLabel,
  attemptSubjects,
  filterAnswers,
  filterAttempts,
  insightItems as buildInsights,
  projectedJamb,
  subjectRows,
  totals as buildTotals,
  WEAK_BELOW,
} from "@/lib/analytics";
import type { RangeKey } from "@/lib/analytics";

const HISTORY_PAGE = 8;

const levelBar = (accuracy: number) => (accuracy >= 70 ? "bg-emerald-500" : accuracy >= WEAK_BELOW ? "bg-violet-500" : "bg-rose-400");
const levelChip = (level: "strong" | "average" | "weak") =>
  level === "strong" ? "bg-emerald-100 text-emerald-700" : level === "average" ? "bg-violet-100 text-violet-700" : "bg-rose-100 text-rose-700";
const levelText = { strong: "Strong", average: "Getting there", weak: "Needs work" } as const;
const short = (name: string) => name.replace(" Language", "");

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useUser();

  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [answers, setAnswers] = useState<AnswerLite[]>([]);
  const [targetScore, setTargetScore] = useState(300);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [range, setRange] = useState<RangeKey>("all");
  const [shown, setShown] = useState(HISTORY_PAGE);
  const dailyGoal = useDailyGoal();

  const load = useCallback(() => {
    if (!user) return;
    const supabase = createSupabaseBrowserClient();
    Promise.all([getAnalyticsData(supabase, user.id), getProfile(supabase, user.id)])
      .then(([data, profile]) => {
        if (profile?.target_score) setTargetScore(profile.target_score);
        setAttempts(data.attempts);
        setAnswers(data.answers);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoaded(true));
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
  }, [user, authLoading, load]);

  const retry = () => {
    setLoaded(false);
    setFailed(false);
    load();
  };

  // Signed-out visitors have nothing to load (AuthGuard shows the sign-in prompt)
  const loading = authLoading ? true : !!user && !loaded;

  // Everything below is derived from the two lists and the chosen time range
  const view = useMemo(() => {
    const inRange = filterAttempts(attempts, range);
    const rangeAnswers = filterAnswers(answers, inRange);
    const rows = subjectRows(rangeAnswers, inRange);
    const t = buildTotals(rangeAnswers, inRange);
    return {
      attempts: inRange,
      rows,
      totals: t,
      estimate: weightedJambEstimate(inRange),
      best: bestAttempt(inRange),
      trend: scoreTrend(inRange, 5),
      projection: projectedJamb(rows),
      perAttempt: attemptSubjects(answers),
      tips: buildInsights(rows, t, inRange),
    };
  }, [attempts, answers, range]);

  const status = targetStatus(view.estimate, targetScore);
  const trendDelta = view.trend.length >= 2 ? view.trend[view.trend.length - 1] - view.trend[0] : 0;
  const weakCount = view.rows.filter((r) => r.level === "weak" && r.name !== "Unknown").length;
  const empty = !loading && attempts.length === 0;
  const v = (text: string) => (loading ? "…" : text);

  const cards = [
    { label: "Accuracy", value: v(`${view.totals.accuracy}%`), hint: loading ? "" : `${view.totals.correct} of ${view.totals.answered} answered` },
    { label: "JAMB estimate", value: v(`${view.estimate}/400`), hint: loading ? "" : "from your exam results" },
    { label: "Exams taken", value: v(String(view.attempts.length)), hint: loading ? "" : range === "all" ? "all time" : `last ${range === "7d" ? "7" : "30"} days` },
    { label: "Questions answered", value: v(view.totals.answered.toLocaleString()), hint: loading || view.totals.unanswered === 0 ? "" : `${view.totals.unanswered} left blank` },
  ];

  return (
    <PaywallGate feature="Analytics">
    <AppShell title="Analytics">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-4xl lg:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black text-slate-900 lg:text-3xl">Analytics</h1>
          <div className="flex gap-1.5 rounded-full bg-white p-1 ring-1 ring-slate-200" role="tablist" aria-label="Time range">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                role="tab"
                aria-selected={range === r.key}
                onClick={() => {
                  setRange(r.key);
                  setShown(HISTORY_PAGE);
                }}
                className={`touch-manipulation rounded-full px-3.5 py-1.5 text-xs font-bold transition ${range === r.key ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <AuthGuard user={user} loading={authLoading}>
          <>
            {failed && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
                <span>Could not load your analytics.</span>
                <button type="button" onClick={retry} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold ring-1 ring-rose-200">
                  Try again
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {cards.map((item) => (
                <div key={item.label} className="rounded-[22px] bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                  <p className="mt-1.5 text-2xl font-black tabular-nums text-slate-900 lg:text-3xl">{item.value}</p>
                  {item.hint && <p className="mt-0.5 truncate text-[11px] text-slate-400">{item.hint}</p>}
                </div>
              ))}
            </div>

            {/* Target tracking */}
            <section className="mt-5 rounded-[28px] bg-gradient-to-br from-[#41348f] to-[#6557d9] p-5 text-white shadow-lg shadow-violet-300/25 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200">Target tracking</p>
                  <h2 className="mt-1 text-xl font-black sm:text-2xl">{loading ? "Loading…" : view.attempts.length === 0 ? "No exams in this period" : status.headline}</h2>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-black tabular-nums">
                    {loading ? "—" : view.estimate}
                    <span className="text-lg font-bold text-violet-200"> / {targetScore}</span>
                  </p>
                  <p className={`text-xs font-bold ${status.onTrack ? "text-emerald-300" : "text-violet-200"}`}>
                    {loading ? "" : status.onTrack ? "On track 🏆" : `${status.marksRemaining} marks to go`}
                  </p>
                </div>
              </div>
              <div className="mt-4 h-2.5 rounded-full bg-white/15">
                <div className="h-full rounded-full bg-[#f6c978] transition-all" style={{ width: `${status.progressPct}%` }} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-200">Recent trend</p>
                  <p className="mt-1 text-lg font-black">
                    {view.trend.length >= 2 ? `${trendDelta >= 0 ? "▲" : "▼"} ${Math.abs(trendDelta)} marks` : "Not enough data"}
                  </p>
                  <p className="text-[10px] text-violet-200">last {view.trend.length || 0} exams</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-200">Best score</p>
                  <p className="mt-1 text-lg font-black">{view.best ? `${view.best.jamb}/400` : "—"}</p>
                  <p className="text-[10px] text-violet-200">
                    {view.best?.at ? new Date(view.best.at).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "no exams yet"}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-200">Weak subjects</p>
                  <p className="mt-1 text-lg font-black">{weakCount}</p>
                  <p className="text-[10px] text-violet-200">below {WEAK_BELOW}% accuracy</p>
                </div>
              </div>
            </section>

            {/* What to do next */}
            {!loading && view.tips.length > 0 && (
              <section className="mt-5 rounded-[24px] bg-amber-50 p-5 ring-1 ring-amber-100">
                <h2 className="text-sm font-black uppercase tracking-[0.14em] text-amber-800">What to focus on</h2>
                <ul className="mt-2 space-y-1.5">
                  {view.tips.map((tip) => (
                    <li key={tip.text} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm leading-6 text-amber-950">
                      <span className="flex min-w-0 flex-1 basis-56 gap-2">
                        <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        <span>{tip.text}</span>
                      </span>
                      {tip.href && tip.cta && (
                        <Link href={tip.href} className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-white px-3 text-xs font-black text-amber-900 ring-1 ring-amber-300 active:scale-[0.98]">
                          {tip.cta}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Subject performance + projection */}
            <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
              <section className="rounded-[28px] bg-slate-50 p-5 ring-1 ring-slate-200">
                <h2 className="text-xl font-black text-slate-900">Subject performance</h2>
                <p className="mb-4 mt-0.5 text-xs text-slate-400">Accuracy on the questions you answered, weakest first.</p>
                {loading ? (
                  <p className="text-sm text-slate-400">Loading…</p>
                ) : view.rows.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <p className="text-sm text-slate-400">{empty ? "Complete exams to see subject performance." : "No answers in this period."}</p>
                    <Link href="/practice" className="rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700">
                      Start practising
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {view.rows.map((r) => (
                      <div key={r.name}>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-bold text-slate-800">{r.name}</span>
                            <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold sm:inline ${levelChip(r.level)}`}>{levelText[r.level]}</span>
                          </div>
                          <span className="shrink-0 text-sm font-black tabular-nums text-slate-900">
                            {r.accuracy}%
                            {r.trend !== null && Math.abs(r.trend) >= 3 && (
                              <span className={`ml-1.5 text-[11px] font-bold ${r.trend > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                {r.trend > 0 ? "▲" : "▼"}
                                {Math.abs(r.trend)}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                          <div className={`h-full rounded-full transition-all ${levelBar(r.accuracy)}`} style={{ width: `${r.accuracy}%` }} />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                          <span>
                            {r.correct} correct · {r.wrong} wrong{r.unanswered > 0 ? ` · ${r.unanswered} blank` : ""}
                          </span>
                          {r.name !== "Unknown" && (
                            <Link
                              href={`/exam?mode=study&subject=${encodeURIComponent(r.name)}&count=20`}
                              className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50"
                            >
                              Practise
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-[28px] bg-slate-900 p-5 text-white">
                <h2 className="text-xl font-black">Projected UTME score</h2>
                <p className="mb-4 mt-0.5 text-xs text-slate-400">English plus your three strongest subjects, each out of 100.</p>
                {loading ? (
                  <p className="text-sm text-slate-400">Loading…</p>
                ) : !view.projection ? (
                  <p className="py-6 text-sm text-slate-400">Answer at least 10 questions in a subject to see a projection.</p>
                ) : (
                  <>
                    <p className="text-5xl font-black tabular-nums">
                      {view.projection.total}
                      <span className="text-lg font-bold text-slate-400"> / 400</span>
                    </p>
                    <div className="mt-4 space-y-2.5">
                      {view.projection.parts.map((p) => (
                        <div key={p.name}>
                          <div className="mb-1 flex justify-between text-xs font-semibold text-slate-300">
                            <span>{short(p.name)}</span>
                            <span className="tabular-nums">{p.score}/100</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-[#f6c978]" style={{ width: `${p.score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {!view.projection.complete && (
                      <p className="mt-4 rounded-xl bg-white/5 p-3 text-xs leading-5 text-slate-300">
                        Based on {view.projection.parts.length} subject{view.projection.parts.length === 1 ? "" : "s"} so far. Practise English and three other subjects for a full projection.
                      </p>
                    )}
                  </>
                )}
              </section>
            </div>

            {/* Score over time + activity */}
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <section className="min-w-0 rounded-[28px] bg-slate-50 p-5 ring-1 ring-slate-200">
                <h2 className="mb-0.5 text-xl font-black text-slate-900">Score over time</h2>
                <p className="mb-4 text-xs text-slate-500">Each dot is a finished session, marked out of 400. Tap the chart to read one.</p>
                {loading ? (
                  <div className="flex h-48 items-center justify-center text-sm text-slate-400">Loading…</div>
                ) : view.attempts.length === 0 ? (
                  <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
                    <p className="text-sm text-slate-500">{empty ? "No exams yet. Take a mock exam to start your trend line." : "No exams in this period."}</p>
                    <Link href="/exam" className="rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700">
                      Take a mock exam
                    </Link>
                  </div>
                ) : (
                  <ScoreChart attempts={view.attempts} target={targetScore} />
                )}
              </section>

              <section className="min-w-0 rounded-[28px] bg-slate-50 p-5 ring-1 ring-slate-200">
                <h2 className="mb-0.5 text-xl font-black text-slate-900">This week</h2>
                <p className="mb-4 text-xs text-slate-500">Questions you answered each day, against your daily goal.</p>
                {loading ? (
                  <div className="flex h-48 items-center justify-center text-sm text-slate-400">Loading…</div>
                ) : (
                  <WeekChart attempts={attempts} goal={dailyGoal} />
                )}
              </section>
            </div>

            {/* Exam history */}
            <section className="mt-5 rounded-[28px] bg-slate-50 p-5 ring-1 ring-slate-200">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900">Exam history</h2>
                <span className="text-xs font-semibold text-slate-400">{view.attempts.length} submitted</span>
              </div>
              {loading ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : view.attempts.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <p className="text-sm text-slate-400">{empty ? "No exams yet. Your submitted attempts will appear here." : "No exams in this period."}</p>
                  <Link href="/exam" className="rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700">
                    Take your first exam
                  </Link>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-100">
                    {view.attempts.slice(0, shown).map((a) => {
                      const q = a.question_count ?? 0;
                      const s = a.score ?? 0;
                      const p = q > 0 ? Math.round((s / q) * 100) : 0;
                      const subjects = view.perAttempt.get(a.id);
                      const label = attemptLabel(a, subjects);
                      return (
                        <div key={a.id} className="flex items-start gap-3 py-3.5">
                          <span className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl text-sm font-black leading-none ${p >= 70 ? "bg-emerald-100 text-emerald-700" : p >= WEAK_BELOW ? "bg-violet-100 text-violet-700" : "bg-rose-100 text-rose-700"}`}>
                            {p}%
                            <span className="mt-0.5 text-[9px] font-bold opacity-70">{attemptJambScore(a)}/400</span>
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="truncate text-sm font-bold text-slate-900">{label.title}</p>
                              {label.kind === "mock" && <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">Mock</span>}
                            </div>
                            <p className="text-xs text-slate-500">
                              {s}/{q} correct ·{" "}
                              {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                            </p>
                            {subjects && subjects.length > 1 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {subjects.map((sub) => (
                                  <span key={sub.name} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                                    {short(sub.name)} {sub.correct}/{sub.answered}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <Link
                            href={`/review?attemptId=${a.id}`}
                            className="shrink-0 rounded-full border border-violet-200 bg-white px-3.5 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50"
                          >
                            Review
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                  {shown < view.attempts.length && (
                    <button
                      type="button"
                      onClick={() => setShown((n) => n + HISTORY_PAGE)}
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Show more ({view.attempts.length - shown} older)
                    </button>
                  )}
                </>
              )}
            </section>
          </>
        </AuthGuard>
      </div>
    </AppShell>
    </PaywallGate>
  );
}
