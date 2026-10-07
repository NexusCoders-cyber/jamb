"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getAttempt, getAttemptAnswers, getProfile, getSubjectStats } from "@/lib/queries";
import AppShell from "@/components/AppShell";
import ScoreSummary from "@/components/ScoreSummary";
import type { SubjectScore } from "@/components/ScoreSummary";
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
  const [breakdownTitle, setBreakdownTitle] = useState("Subject performance");
  const [timeUsed, setTimeUsed] = useState<string | null>(null);
  const [timeSeconds, setTimeSeconds] = useState<number | null>(null);
  const [targetScore, setTargetScore] = useState(300);
  const [targetLoaded, setTargetLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createSupabaseBrowserClient();

    // Target score for the "vs target" panel
    getProfile(supabase, user.id)
      .then((p) => {
        if (p?.target_score) setTargetScore(p.target_score);
      })
      .catch(() => undefined)
      .finally(() => setTargetLoaded(true));

    // Per-subject breakdown. For a just-finished exam show THAT exam (English 45/60, Biology 30/40 …),
    // not lifetime totals; fall back to lifetime accuracy when the attempt has no saved answers.
    const lifetime = () =>
      getSubjectStats(supabase, user.id).then((stats) => {
        if (stats.length > 0) setSubjectBreakdown(stats);
      });
    if (attemptId) {
      getAttemptAnswers(supabase, attemptId)
        .then((rows) => {
          const bySubject = new Map<string, { total: number; correct: number; unanswered: number }>();
          for (const r of rows) {
            const name = r.question?.subject_name || "Questions";
            const entry = bySubject.get(name) ?? { total: 0, correct: 0, unanswered: 0 };
            entry.total += 1; // blank questions count against the subject, like the exam score does
            if (r.is_correct) entry.correct += 1;
            if (r.selected_option === null || r.selected_option === undefined) entry.unanswered += 1;
            bySubject.set(name, entry);
          }
          if (bySubject.size === 0) return lifetime();
          setBreakdownTitle("This exam by subject");
          setSubjectBreakdown(
            Array.from(bySubject.entries()).map(([subjectName, v]) => ({
              subjectName,
              total: v.total,
              correct: v.correct,
              unanswered: v.unanswered,
              accuracy: Math.round((v.correct / v.total) * 100),
            })),
          );
        })
        .catch(() => lifetime());
    } else {
      lifetime();
    }

    // Fetch the attempt to show time used
    if (attemptId) {
      getAttempt(supabase, attemptId).then((attempt) => {
        if (attempt?.submitted_at && attempt?.started_at) {
          const ms = new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime();
          const mins = Math.floor(ms / 60000);
          const secs = Math.floor((ms % 60000) / 1000);
          setTimeUsed(`${mins}m ${secs}s`);
          setTimeSeconds(Math.max(0, Math.round(ms / 1000)));
        }
      });
    }
  }, [user, attemptId]);

  // Per-subject scores for the hero card — only meaningful for THIS exam (not lifetime stats)
  const cardSubjects: SubjectScore[] =
    breakdownTitle === "This exam by subject"
      ? subjectBreakdown.map((s) => {
          const unans = s.unanswered ?? 0;
          return {
            name: s.subjectName,
            correct: s.correct,
            unanswered: unans,
            wrong: Math.max(s.total - s.correct - unans, 0),
            total: s.total,
            pct: s.accuracy,
          };
        })
      : [];

  return (
    <AppShell title="Results" back="/practice">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-4xl lg:px-6">
        <h1 className="mb-4 text-2xl font-black text-slate-900">Exam Results</h1>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          {/* Score card — animated ring, target, counts, per-subject scores (see ScoreSummary) */}
          <div className="lg:col-start-1">
            <ScoreSummary
              subject={subject}
              correct={correct}
              total={total}
              unanswered={unanswered}
              wrong={wrong}
              subjects={cardSubjects}
              timeUsedSeconds={timeSeconds}
              target={targetLoaded ? targetScore : null}
              reviewHref={attemptId ? `/review?attemptId=${attemptId}` : undefined}
              retryHref="/practice"
            />
          </div>

          {/* Summary */}
          <aside className="rounded-[28px] bg-slate-900 p-6 text-white">
            <p className="text-sm uppercase tracking-[0.22em] text-slate-300">Summary</p>
            <div className="mt-4 space-y-3">
              {[
                { label: "Percentage", value: `${percentage}%` },
                { label: "Practice level", value: `${practiceScore} / 400` },
                { label: "Subject", value: subject },
                { label: "Time used", value: timeUsed ?? "—" },
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
            <h3 className="text-2xl font-black text-slate-900">{breakdownTitle}</h3>
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
                    <span className="tabular-nums">
                      {breakdownTitle !== "Subject performance" ? `${item.correct}/${item.total} · ` : ""}
                      {item.accuracy}%
                    </span>
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
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" /></div>}>
      <ResultsPageContent />
    </Suspense>
  );
}
