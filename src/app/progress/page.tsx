"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import { PaywallGate } from "@/components/Paywall";
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
    <PaywallGate feature="Progress">
    <AppShell title="Progress">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-4xl lg:px-6">
        <h1 className="mb-4 text-2xl font-black text-slate-900">Learning Journey</h1>
        <AuthGuard user={user} loading={authLoading}>
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
        </AuthGuard>
      </div>
    </AppShell>
    </PaywallGate>
  );
}
