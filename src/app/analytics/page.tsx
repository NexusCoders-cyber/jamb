"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSubjectStats, getScoreHistory, getUserAttempts } from "@/lib/queries";
import type { SubjectStats } from "@/lib/queries";

type ScorePoint = { score: number; question_count: number; submitted_at: string };

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useUser();

  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
  const [scoreHistory, setScoreHistory] = useState<ScorePoint[]>([]);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalExams, setTotalExams] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    const supabase = createSupabaseBrowserClient();

    Promise.all([
      getSubjectStats(supabase, user.id),
      getScoreHistory(supabase, user.id, 10),
      getUserAttempts(supabase, user.id, 100),
    ]).then(([stats, history, attempts]) => {
      setSubjectStats(stats);
      setScoreHistory(history as ScorePoint[]);

      const answered = attempts.reduce((s, a) => s + a.question_count, 0);
      const correct = attempts.reduce((s, a) => s + a.score, 0);
      setTotalAnswered(answered);
      setTotalCorrect(correct);
      setTotalExams(attempts.length);
    }).finally(() => setLoading(false));
  }, [user, authLoading]);

  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const weakCount = subjectStats.filter((s) => s.accuracy < 60).length;
  const strongCount = subjectStats.filter((s) => s.accuracy >= 70).length;

  // Chart: normalize history scores to percentages for bar heights
  const maxScore = scoreHistory.reduce((m, p) => Math.max(m, p.question_count), 1);
  const chartBars = scoreHistory.map((p) => ({
    pct: Math.round((p.score / Math.max(p.question_count, 1)) * 100),
    label: new Date(p.submitted_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" }),
  }));
  // Pad to at least 7 bars for visual consistency
  while (chartBars.length < 7) chartBars.unshift({ pct: 0, label: "—" });

  const analyticsCards = [
    { label: "Accuracy", value: loading ? "…" : `${overallAccuracy}%` },
    { label: "Exams taken", value: loading ? "…" : String(totalExams) },
    { label: "Questions answered", value: loading ? "…" : totalAnswered.toLocaleString() },
    { label: "Weak subjects", value: loading ? "…" : String(weakCount) },
    { label: "Strong subjects", value: loading ? "…" : String(strongCount) },
    { label: "Best score", value: loading || scoreHistory.length === 0 ? "—" : `${Math.max(...scoreHistory.map((p) => Math.round((p.score / Math.max(p.question_count, 1)) * 100)))}%` },
  ];

  return (
    <main className="min-h-screen bg-[#eef2ff] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[30px] bg-white p-6 ring-1 ring-slate-200 shadow-[0_18px_60px_rgba(93,74,228,0.1)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500">Performance</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Analytics</h1>
          </div>
          <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Dashboard
          </Link>
        </div>

        {!user && !authLoading ? (
          <div className="rounded-[24px] bg-slate-50 p-8 text-center ring-1 ring-slate-200">
            <p className="font-bold text-slate-700">Sign in to see your analytics</p>
            <Link href="/" className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">Sign in</Link>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {analyticsCards.map((item) => (
                <div key={item.label} className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>

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
          </>
        )}
      </div>
    </main>
  );
}
