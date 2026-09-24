"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getUserAttempts, getProfile } from "@/lib/queries";

export default function ProgressPage() {
  const { user, loading: authLoading } = useUser();

  const [totalAnswered, setTotalAnswered] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [mockExams, setMockExams] = useState(0);
  const [overallAccuracy, setOverallAccuracy] = useState(0);
  const [targetScore, setTargetScore] = useState(300);
  const [practiceLevel, setPracticeLevel] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    const supabase = createSupabaseBrowserClient();
    Promise.all([getUserAttempts(supabase, user.id, 100), getProfile(supabase, user.id)])
      .then(([attempts, profile]) => {
        const answered = attempts.reduce((s, a) => s + a.question_count, 0);
        const correct = attempts.reduce((s, a) => s + a.score, 0);
        const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
        const level = Math.min(400, Math.round((accuracy / 100) * 400));

        setTotalAnswered(answered);
        setTotalSessions(attempts.length);
        setMockExams(attempts.filter((a) => a.question_count >= 40).length);
        setOverallAccuracy(accuracy);
        setPracticeLevel(level);
        if (profile) setTargetScore(profile.target_score);
      })
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const progressPct = targetScore > 0 ? Math.min(100, Math.round((practiceLevel / targetScore) * 100)) : 0;
  const nextMilestone = Math.min(400, Math.ceil(practiceLevel / 20) * 20 + 20);

  const stats = [
    { label: "Questions answered", value: loading ? "…" : totalAnswered.toLocaleString() },
    { label: "Practice sessions", value: loading ? "…" : String(totalSessions) },
    { label: "Mock exams", value: loading ? "…" : String(mockExams) },
    { label: "Accuracy", value: loading ? "…" : `${overallAccuracy}%` },
  ];

  return (
    <main className="min-h-screen bg-[#eef2ff] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[30px] bg-white p-6 ring-1 ring-slate-200 shadow-[0_18px_60px_rgba(93,74,228,0.1)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500">My Progress</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Learning journey</h1>
          </div>
          <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Dashboard
          </Link>
        </div>

        {!user && !authLoading ? (
          <div className="rounded-[24px] bg-slate-50 p-8 text-center ring-1 ring-slate-200">
            <p className="font-bold text-slate-700">Sign in to track your progress</p>
            <Link href="/" className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">Sign in</Link>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((item) => (
                <div key={item.label} className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-[28px] bg-slate-50 p-6 ring-1 ring-slate-200">
              <h2 className="mb-5 text-xl font-black text-slate-900">Road to {targetScore}</h2>
              <div className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-600">
                <span>{practiceLevel} current → {targetScore} target</span>
                <span>{progressPct}% there</span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="mt-4 text-sm text-slate-600">
                Next milestone: <span className="font-bold">{nextMilestone}</span>
              </div>

              {totalAnswered === 0 && (
                <div className="mt-6">
                  <Link href="/practice" className="inline-flex h-11 items-center rounded-xl bg-violet-600 px-5 text-sm font-bold text-white">
                    Start your first session
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
