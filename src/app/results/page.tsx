"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getAttempt, getProfile, getSubjectStats } from "@/lib/queries";
import AppShell from "@/components/AppShell";
import { targetStatus } from "@/lib/scoring";
import type { SubjectStats } from "@/lib/queries";

function ResultsPageContent() {
  const searchParams = useSearchParams();
  const { user } = useUser();

  // URL params (always present – written by /exam on submit)
  const correct = Number(searchParams.get("score") ?? 0);
  const total = Number(searchParams.get("total") ?? 0);
  const subject = searchParams.get("subject") ?? "Full exam simulation";
  const answered = Number(searchParams.get("answered") ?? correct);
  const wrong = Number(searchParams.get("wrong") ?? Math.max(answered - correct, 0));
  const attemptId = searchParams.get("attemptId") ?? null;
  const unanswered = Math.max(total - answered, 0);
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  const practiceScore = total > 0 ? Math.round((correct / total) * 400) : 0;

  // Live subject stats from Supabase
  const [subjectBreakdown, setSubjectBreakdown] = useState<SubjectStats[]>([]);
  const [timeUsed, setTimeUsed] = useState<string | null>(null);
  const [targetScore, setTargetScore] = useState(300);
  // This attempt's result vs the student's target (shared scoring engine)
  const status = targetStatus(practiceScore, targetScore);

  useEffect(() => {
    if (!user) return;
    const supabase = createSupabaseBrowserClient();

    // Target score for the "vs target" panel
    getProfile(supabase, user.id).then((p) => {
      if (p?.target_score) setTargetScore(p.target_score);
    });

    // Fetch per-subject accuracy for the breakdown chart
    getSubjectStats(supabase, user.id).then((stats) => {
      if (stats.length > 0) setSubjectBreakdown(stats);
    });

    // Fetch the attempt to show time used
    if (attemptId) {
      getAttempt(supabase, attemptId).then((attempt) => {
        if (attempt?.submitted_at && attempt?.started_at) {
          const ms = new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime();
          const mins = Math.floor(ms / 60000);
          const secs = Math.floor((ms % 60000) / 1000);
          setTimeUsed(`${mins}m ${secs}s`);
        }
      });
    }
  }, [user, attemptId]);

  return (
    <AppShell title="Results" back="/practice">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-4xl lg:px-6">
        <h1 className="mb-4 text-2xl font-black text-slate-900">Exam Results</h1>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          {/* Score card */}
          <section className="rounded-[28px] bg-gradient-to-br from-emerald-800 to-emerald-600 p-6 text-white shadow-xl shadow-emerald-900/15">
            <p className="text-sm uppercase tracking-[0.22em] text-emerald-100">Overall performance</p>
            <p className="mt-2 text-sm font-semibold text-emerald-100">{subject}</p>
            <div className="mt-4 flex items-end gap-3">
              <h2 className="text-5xl font-black">{practiceScore}</h2>
              <span className="pb-1 text-xl font-semibold text-emerald-100">/ 400</span>
            </div>
            <p className="mt-2 text-sm text-emerald-100">Practice-performance estimate, not an official result.</p>

            {/* Score vs target — connects this exam to the student's goal */}
            <div className="mt-4 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
              <div className="flex items-center justify-between text-sm font-bold">
                <span className="text-emerald-100">Your target: {targetScore}</span>
                <span className={status.onTrack ? "text-emerald-300" : "text-[#f6c978]"}>
                  {status.onTrack ? "Beaten it! 🏆" : `${status.marksRemaining} marks to go`}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/15">
                <div className="h-full rounded-full bg-[#f6c978] transition-all" style={{ width: `${status.progressPct}%` }} />
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { label: "Correct", value: String(correct) },
                { label: "Wrong", value: String(wrong) },
                { label: "Unanswered", value: String(unanswered) },
                { label: "Time used", value: timeUsed ?? "—" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
                  <p className="text-xs uppercase tracking-[0.18em] text-violet-100">{item.label}</p>
                  <p className="mt-2 text-2xl font-black">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Summary */}
          <aside className="rounded-[28px] bg-slate-900 p-6 text-white">
            <p className="text-sm uppercase tracking-[0.22em] text-slate-300">Summary</p>
            <div className="mt-4 space-y-3">
              {[
                { label: "Percentage", value: `${percentage}%` },
                { label: "Practice level", value: `${practiceScore} / 400` },
                { label: "Subject", value: subject },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                  <p className="mt-2 text-xl font-bold">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3">
              {attemptId && (
                <Link
                  href={`/review?attemptId=${attemptId}`}
                  className="flex h-11 items-center justify-center rounded-2xl bg-violet-600 text-sm font-bold text-white"
                >
                  Review answers
                </Link>
              )}
              <Link href="/practice" className="flex h-11 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white hover:bg-white/15">
                Practice again
              </Link>
            </div>
          </aside>
        </div>

        {/* Subject breakdown */}
        <section className="mt-8 rounded-[28px] bg-slate-50 p-6 ring-1 ring-slate-200">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-2xl font-black text-slate-900">Subject performance</h3>
            {attemptId && (
              <Link href={`/review?attemptId=${attemptId}`} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
                Open correction room
              </Link>
            )}
          </div>

          {subjectBreakdown.length === 0 ? (
            <p className="text-sm text-slate-400">
              No subject breakdown available yet — complete more exams to see it here.
            </p>
          ) : (
            <div className="space-y-4">
              {subjectBreakdown.map((item) => (
                <div key={item.subjectName}>
                  <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
                    <span>{item.subjectName}</span>
                    <span>{item.accuracy}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400" style={{ width: `${item.accuracy}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" /></div>}>
      <ResultsPageContent />
    </Suspense>
  );
}
