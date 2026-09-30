"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import { getProfile, getSubjectStats, getScoreHistory, getUserAttempts } from "@/lib/queries";
import type { SubjectStats, ExamAttempt } from "@/lib/queries";
import { weightedJambEstimate, targetStatus, attemptJambScore, bestAttempt, scoreTrend } from "@/lib/scoring";

type ScorePoint = { score: number; question_count: number; submitted_at: string };

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useUser();

  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
  const [scoreHistory, setScoreHistory] = useState<ScorePoint[]>([]);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalExams, setTotalExams] = useState(0);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [targetScore, setTargetScore] = useState(300);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    const supabase = createSupabaseBrowserClient();

    Promise.all([
      getSubjectStats(supabase, user.id),
      getScoreHistory(supabase, user.id, 10),
      getUserAttempts(supabase, user.id, 100),
      getProfile(supabase, user.id),
    ]).then(([stats, history, attempts, profile]) => {
      if (profile) setTargetScore(profile.target_score);
      setSubjectStats(stats);
      setScoreHistory(history as ScorePoint[]);

      // Null-guards: an attempt saved without a score/question_count must not
      // poison the totals with NaN
      const answered = attempts.reduce((s, a) => s + (a.question_count ?? 0), 0);
      const correct = attempts.reduce((s, a) => s + (a.score ?? 0), 0);
      setTotalAnswered(answered);
      setTotalCorrect(correct);
      setTotalExams(attempts.length);
      setAttempts(attempts);
    }).finally(() => setLoading(false));
  }, [user, authLoading]);

  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const weakCount = subjectStats.filter((s) => s.accuracy < 60).length;
  const strongCount = subjectStats.filter((s) => s.accuracy >= 70).length;

  // Target tracking via the shared scoring engine
  const estimate = weightedJambEstimate(attempts);
  const status = targetStatus(estimate, targetScore);
  const best = bestAttempt(attempts);
  const trend = scoreTrend(attempts, 5);
  const trendDelta = trend.length >= 2 ? trend[trend.length - 1] - trend[0] : 0;

  // Chart: normalize history scores to percentages for bar heights
  const chartBars = scoreHistory.map((p) => ({
    pct: Math.round(((p.score ?? 0) / Math.max(p.question_count ?? 1, 1)) * 100),
    label: new Date(p.submitted_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" }),
  }));
  // Pad to at least 7 bars for visual consistency (empties on the left,
  // since history is ordered oldest → newest)
  while (chartBars.length < 7) chartBars.unshift({ pct: 0, label: "—" });

  const analyticsCards = [
    { label: "Accuracy", value: loading ? "…" : `${overallAccuracy}%` },
    { label: "JAMB estimate", value: loading ? "…" : `${estimate}/400` },
    { label: "Target", value: loading ? "…" : `${status.onTrack ? "🏆 " : ""}${targetScore}` },
    { label: "Exams taken", value: loading ? "…" : String(totalExams) },
    { label: "Questions answered", value: loading ? "…" : totalAnswered.toLocaleString() },
    { label: "Best JAMB score", value: loading ? "…" : best ? `${best.jamb}/400` : "—" },
  ];

  return (
    <AppShell title="Analytics">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-4xl lg:px-6">
        <h1 className="mb-5 text-2xl font-black text-slate-900 lg:text-3xl">Analytics</h1>
        <AuthGuard user={user} loading={authLoading}>
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {analyticsCards.map((item) => (
                <div key={item.label} className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Target tracking panel */}
            <section className="mt-6 rounded-[28px] bg-gradient-to-br from-[#41348f] to-[#6557d9] p-6 text-white shadow-lg shadow-violet-300/25">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200">Target tracking</p>
                  <h2 className="mt-1 text-2xl font-black">
                    {loading ? "Loading…" : status.headline}
                  </h2>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-black">{loading ? "—" : estimate}<span className="text-lg font-bold text-violet-200"> / {targetScore}</span></p>
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
                    {trend.length >= 2 ? `${trendDelta >= 0 ? "▲" : "▼"} ${Math.abs(trendDelta)} marks` : "Not enough data"}
                  </p>
                  <p className="text-[10px] text-violet-200">last {trend.length || 0} exams</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-200">Best score</p>
                  <p className="mt-1 text-lg font-black">{best ? `${best.jamb}/400` : "—"}</p>
                  <p className="text-[10px] text-violet-200">{best?.at ? new Date(best.at).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "no exams yet"}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-200">Weak subjects</p>
                  <p className="mt-1 text-lg font-black">{weakCount}</p>
                  <p className="text-[10px] text-violet-200">below 60% accuracy</p>
                </div>
              </div>
            </section>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {/* Score over time */}
              <div className="rounded-[28px] bg-slate-50 p-5 ring-1 ring-slate-200">
                <h2 className="mb-1 text-xl font-black text-slate-900">Score over time</h2>
                <p className="mb-4 text-xs text-slate-400">Last {chartBars.length} exams — percentage correct</p>
                {loading ? (
                  <div className="flex h-40 items-center justify-center text-sm text-slate-400">Loading…</div>
                ) : scoreHistory.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-sm text-slate-400">No exams yet</div>
                ) : (
                  <div className="flex h-40 items-end gap-2">
                    {chartBars.map((bar, i) => (
                      <div key={i} className="relative flex-1 group">
                        <div
                          className="w-full rounded-t-2xl bg-gradient-to-t from-violet-500 to-violet-300 transition-all"
                          style={{ height: `${Math.max(bar.pct, 4)}%` }}
                        />
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-violet-700 opacity-0 group-hover:opacity-100 transition">
                          {bar.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {scoreHistory.length > 0 && (
                  <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                    {chartBars.map((b, i) => <span key={i}>{b.label}</span>)}
                  </div>
                )}
              </div>

              {/* Subject trends */}
              <div className="rounded-[28px] bg-slate-50 p-5 ring-1 ring-slate-200">
                <h2 className="mb-4 text-xl font-black text-slate-900">Subject trends</h2>
                {loading ? (
                  <p className="text-sm text-slate-400">Loading…</p>
                ) : subjectStats.length === 0 ? (
                  <p className="text-sm text-slate-400">Complete exams to see subject trends.</p>
                ) : (
                  <div className="space-y-4">
                    {subjectStats.map((item) => (
                      <div key={item.subjectName}>
                        <div className="mb-2 flex justify-between text-sm font-semibold text-slate-700">
                          <span>{item.subjectName}</span>
                          <span>{item.accuracy}% <span className="text-xs font-normal text-slate-400">({item.correct}/{item.total})</span></span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full transition-all ${item.accuracy >= 70 ? "bg-emerald-500" : item.accuracy >= 50 ? "bg-violet-500" : "bg-rose-400"}`}
                            style={{ width: `${item.accuracy}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Exam history — every submitted attempt */}
            <div className="mt-8 rounded-[28px] bg-slate-50 p-5 ring-1 ring-slate-200">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900">Exam history</h2>
                <span className="text-xs font-semibold text-slate-400">{totalExams} submitted</span>
              </div>
              {loading ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : attempts.length === 0 ? (
                <p className="text-sm text-slate-400">No exams yet — your submitted attempts will appear here.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {attempts.map((a) => {
                    const q = a.question_count ?? 0;
                    const s = a.score ?? 0;
                    const pct = q > 0 ? Math.round((s / q) * 100) : 0;
                    return (
                      <div key={a.id} className="flex items-center gap-4 py-3">
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${
                          pct >= 70 ? "bg-emerald-100 text-emerald-700" : pct >= 50 ? "bg-violet-100 text-violet-700" : "bg-rose-100 text-rose-700"
                        }`}>
                          {pct}%
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900">{s}/{q} correct</p>
                          <p className="text-xs text-slate-400">
                            {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                          </p>
                        </div>
                        <Link href={`/review?attemptId=${a.id}`}
                          className="shrink-0 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-[10px] font-bold text-violet-700">
                          Review
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        </AuthGuard>
      </div>
    </AppShell>
  );
}
