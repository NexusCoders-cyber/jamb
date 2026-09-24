"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getAttemptAnswers } from "@/lib/queries";
import type { AttemptAnswer } from "@/lib/queries";

const STATUS_STYLES: Record<string, string> = {
  Correct: "bg-emerald-100 text-emerald-700",
  Wrong: "bg-rose-100 text-rose-700",
  Unanswered: "bg-slate-200 text-slate-700",
  Marked: "bg-violet-100 text-violet-700",
};

function statusFor(a: AttemptAnswer): string {
  if (a.selected_option === null || a.selected_option === undefined) return "Unanswered";
  if (a.marked_for_review) return "Marked";
  return a.is_correct ? "Correct" : "Wrong";
}

function ReviewContent() {
  const searchParams = useSearchParams();
  const { user } = useUser();
  const attemptId = searchParams.get("attemptId");

  const [answers, setAnswers] = useState<AttemptAnswer[]>([]);
  const [selected, setSelected] = useState<AttemptAnswer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !attemptId) { setLoading(false); return; }

    const supabase = createSupabaseBrowserClient();
    getAttemptAnswers(supabase, attemptId)
      .then((rows) => {
        setAnswers(rows);
        setSelected(rows.find((r) => !r.is_correct) ?? rows[0] ?? null);
      })
      .finally(() => setLoading(false));
  }, [user, attemptId]);

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-6">
        <p className="mt-20 text-center text-sm text-slate-400">Loading review…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen px-4 py-6">
        <div className="mx-auto max-w-md rounded-[28px] bg-white p-8 text-center ring-1 ring-slate-200">
          <p className="text-lg font-bold text-slate-900">Sign in to review your answers</p>
          <Link href="/" className="mt-5 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">Sign in</Link>
        </div>
      </main>
    );
  }

  if (!attemptId || answers.length === 0) {
    return (
      <main className="min-h-screen px-4 py-6">
        <div className="mx-auto max-w-md rounded-[28px] bg-white p-8 text-center ring-1 ring-slate-200">
          <p className="text-lg font-bold text-slate-900">No answers to review</p>
          <p className="mt-2 text-sm text-slate-500">Complete an exam first, then open the correction room from your results page.</p>
          <Link href="/practice" className="mt-5 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">Start practising</Link>
        </div>
      </main>
    );
  }

  const q = selected?.question;

  return (
    <main className="min-h-screen bg-[#eef2ff] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[30px] bg-white p-6 ring-1 ring-slate-200 shadow-[0_18px_60px_rgba(93,74,228,0.1)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500">Review</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Review Answers</h1>
          </div>
          <Link href={`/results?attemptId=${attemptId}`} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Results
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          {/* Question list */}
          <aside className="rounded-[28px] bg-slate-50 p-5 ring-1 ring-slate-200">
            <h2 className="mb-4 text-xl font-black text-slate-900">Question summary</h2>
            <div className="grid gap-2 overflow-y-auto" style={{ maxHeight: "600px" }}>
              {answers.map((a, i) => {
                const status = statusFor(a);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelected(a)}
                    className={`flex items-center justify-between rounded-2xl p-3 ring-1 text-left transition ${selected?.id === a.id ? "ring-violet-400 bg-violet-50" : "bg-white ring-slate-200"}`}
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">Q{i + 1}</p>
                      <p className="text-xs text-slate-500 truncate max-w-[120px]">{a.question?.prompt?.slice(0, 30) ?? "—"}…</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${STATUS_STYLES[status] ?? ""}`}>
                      {status}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Question detail */}
          <section className="rounded-[28px] bg-slate-50 p-6 ring-1 ring-slate-200">
            {selected && q ? (
              <>
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Question {answers.indexOf(selected) + 1}</p>
                    <h2 className="text-2xl font-black text-slate-900">
                      {/* subject name from nested join */}
                      {(q as unknown as { subject?: { name: string } }).subject?.name ?? "Question"}
                    </h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[statusFor(selected)] ?? ""}`}>
                    {statusFor(selected)}
                  </span>
                </div>

                <div className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200">
                  <p className="text-lg leading-8 text-slate-800">{q.prompt}</p>

                  <div className="mt-5 space-y-3 text-sm">
                    {q.options.map((opt, idx) => {
                      const isCorrect = idx === q.correct_option;
                      const isSelected = idx === selected.selected_option;
                      return (
                        <div
                          key={opt}
                          className={`rounded-2xl border p-3 ${
                            isCorrect
                              ? "border-emerald-400 bg-emerald-50 font-semibold text-emerald-900"
                              : isSelected && !isCorrect
                                ? "border-rose-300 bg-rose-50 text-rose-800"
                                : "border-slate-200 text-slate-700"
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}. {opt}
                          {isCorrect && <span className="ml-2 text-xs font-bold text-emerald-700">✓ Correct</span>}
                          {isSelected && !isCorrect && <span className="ml-2 text-xs font-bold text-rose-600">✗ Your answer</span>}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="mt-5 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                      <p className="text-sm font-bold text-emerald-800">Explanation</p>
                      <p className="mt-2 text-sm text-emerald-900">{q.explanation}</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">Select a question on the left to review it.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<main className="min-h-screen px-4 py-6" />}>
      <ReviewContent />
    </Suspense>
  );
}
