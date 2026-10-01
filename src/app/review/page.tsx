"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import ExplanationView from "@/components/ExplanationView";
import { getAttemptAnswers } from "@/lib/queries";
import { Check, XCircle } from "lucide-react";
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

type Section = { subject: string; items: AttemptAnswer[] };

function groupBySubject(answers: AttemptAnswer[]): Section[] {
  const order: string[] = [];
  const map = new Map<string, AttemptAnswer[]>();
  for (const a of answers) {
    const name = a.question?.subject_name ?? "General";
    if (!map.has(name)) {
      map.set(name, []);
      order.push(name);
    }
    map.get(name)!.push(a);
  }
  return order.map((subject) => ({ subject, items: map.get(subject)! }));
}

function ReviewContent() {
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useUser();
  const attemptId = searchParams.get("attemptId");

  const [answers, setAnswers] = useState<AttemptAnswer[]>([]);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !attemptId) { setLoading(false); return; }

    const supabase = createSupabaseBrowserClient();
    getAttemptAnswers(supabase, attemptId)
      .then((rows) => {
        setAnswers(rows);
        const firstWrong = rows.find((r) => !r.is_correct) ?? rows[0] ?? null;
        setSelectedId(firstWrong?.id ?? null);
        setActiveSubject(firstWrong?.question?.subject_name ?? rows[0]?.question?.subject_name ?? null);
      })
      .finally(() => setLoading(false));
  }, [user, authLoading, attemptId]);

  const sections = useMemo(() => groupBySubject(answers), [answers]);
  const activeSection = sections.find((s) => s.subject === activeSubject) ?? sections[0] ?? null;
  const selected = answers.find((a) => a.id === selectedId) ?? null;
  const localIndex = activeSection && selected ? activeSection.items.findIndex((a) => a.id === selected.id) : -1;

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef2ff]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthGuard user={null} loading={false}>
        <></>
      </AuthGuard>
    );
  }

  if (!attemptId || answers.length === 0) {
    return (
      <main className="min-h-screen px-4 py-6">
        <div className="mx-auto max-w-md rounded-[28px] bg-white p-8 text-center ring-1 ring-slate-200">
          <p className="text-lg font-bold text-slate-900">No answers to review</p>
          <p className="mt-2 text-sm text-slate-500">
            Complete an exam first, then open the correction room from your results page.
          </p>
          <Link href="/practice" className="mt-5 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">
            Start practising
          </Link>
        </div>
      </main>
    );
  }

  const q = selected?.question;

  return (
    <AppShell title="Review Answers" back={`/results?attemptId=${attemptId ?? ""}`}>
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-5xl lg:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-black text-slate-900">Review Answers</h1>
          {attemptId && (
            <Link href={`/results?attemptId=${attemptId}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
              Results
            </Link>
          )}
        </div>

        {sections.length > 1 && (
          <div className="mb-4 flex gap-2 overflow-x-auto rounded-[20px] bg-violet-50 p-2 ring-1 ring-violet-100">
            {sections.map((s) => {
              const sectionCorrect = s.items.filter((a) => a.is_correct).length;
              return (
                <button
                  key={s.subject}
                  type="button"
                  onClick={() => {
                    setActiveSubject(s.subject);
                    setSelectedId(s.items.find((a) => !a.is_correct)?.id ?? s.items[0]?.id ?? null);
                  }}
                  className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition ${
                    s.subject === activeSection?.subject ? "bg-white text-violet-900 shadow-sm ring-1 ring-violet-200" : "text-violet-500 hover:bg-white/60"
                  }`}
                >
                  {s.subject} <span className="ml-1 opacity-60">{sectionCorrect}/{s.items.length}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="rounded-[28px] bg-slate-50 p-5 ring-1 ring-slate-200">
            <h2 className="mb-4 text-xl font-black text-slate-900">{activeSection?.subject ?? "Question summary"}</h2>
            <div className="grid gap-2 overflow-y-auto" style={{ maxHeight: "600px" }}>
              {activeSection?.items.map((a, i) => {
                const status = statusFor(a);
                return (
                  <button key={a.id} type="button" onClick={() => setSelectedId(a.id)}
                    className={`flex items-center justify-between rounded-2xl p-3 ring-1 text-left transition ${selectedId === a.id ? "ring-violet-400 bg-violet-50" : "bg-white ring-slate-200"}`}>
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

          <section className="rounded-[28px] bg-slate-50 p-6 ring-1 ring-slate-200">
            {selected && q ? (
              <>
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">
                      {activeSection?.subject ?? "Question"} · Question {localIndex >= 0 ? localIndex + 1 : "—"} of {activeSection?.items.length ?? 0}
                    </p>
                    <h2 className="text-2xl font-black text-slate-900">
                      {q.subject_name ?? "Question"}
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
                        <div key={opt}
                          className={`rounded-2xl border p-3 ${
                            isCorrect ? "border-emerald-400 bg-emerald-50 font-semibold text-emerald-900"
                            : isSelected && !isCorrect ? "border-rose-300 bg-rose-50 text-rose-800"
                            : "border-slate-200 text-slate-700"
                          }`}>
                          {String.fromCharCode(65 + idx)}. {opt}
                          {isCorrect && (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                              <Check className="h-3.5 w-3.5" aria-hidden /> Correct
                            </span>
                          )}
                          {isSelected && !isCorrect && (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                              <XCircle className="h-3.5 w-3.5" aria-hidden /> Your answer
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="mt-5 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                      <p className="text-sm font-bold text-emerald-800">Explanation</p>
                      <ExplanationView text={q.explanation} subject={q.subject_name} className="mt-2.5" />
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
    </AppShell>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" /></div>}>
      <ReviewContent />
    </Suspense>
  );
}