"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { createAttempt, saveAnswers, submitAttempt, updateStreak } from "@/lib/queries";
import { ALOC_SUBJECTS } from "@/lib/aloc";

type Q = { id: string; prompt: string; options: string[]; answer: number; explanation: string | null };

const DAILY_COUNT = 10;

function getTodaySubject(): string {
  const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return ALOC_SUBJECTS[day % ALOC_SUBJECTS.length].name;
}

const FALLBACK: Q[] = [
  { id: "d1", prompt: "Choose the word nearest in meaning to BENEVOLENT.", options: ["Cruel", "Kind", "Angry", "Jealous"], answer: 1, explanation: "Benevolent means kind and generous." },
  { id: "d2", prompt: "Which sentence is grammatically correct?", options: ["He don't know.", "She doesn't knows.", "They doesn't like it.", "He doesn't know."], answer: 3, explanation: null },
  { id: "d3", prompt: "The plural of 'criterion' is:", options: ["criterias", "criterions", "criteria", "criterium"], answer: 2, explanation: "Criteria is the standard plural of criterion." },
  { id: "d4", prompt: "Identify the adverb in: 'She runs quickly.'", options: ["She", "runs", "quickly", "None"], answer: 2, explanation: null },
  { id: "d5", prompt: "'Ubiquitous' means:", options: ["Rare", "Everywhere", "Beautiful", "Ancient"], answer: 1, explanation: "Ubiquitous = present or found everywhere." },
  { id: "d6", prompt: "The antonym of 'verbose' is:", options: ["Talkative", "Concise", "Boring", "Loud"], answer: 1, explanation: "Verbose = using many words; antonym = concise." },
  { id: "d7", prompt: "A speech given at a funeral is called:", options: ["Elegy", "Eulogy", "Epistle", "Epitaph"], answer: 1, explanation: null },
  { id: "d8", prompt: "Which is a compound sentence?", options: ["He ran.", "She sang and danced.", "Because he left.", "Running fast."], answer: 1, explanation: null },
  { id: "d9", prompt: "'The wind whispered' is an example of:", options: ["Simile", "Metaphor", "Personification", "Hyperbole"], answer: 2, explanation: "Attributing human action to wind = personification." },
  { id: "d10", prompt: "Choose the correct spelling:", options: ["accomodate", "accommodate", "acomodate", "acommodate"], answer: 1, explanation: null },
];

export default function DailyChallengePage() {
  const { user, loading: authLoading } = useUser();
  const todaySubject = getTodaySubject();
  const todayLabel = new Intl.DateTimeFormat("en-NG", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  const [questions, setQuestions] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showExpl, setShowExpl] = useState(false);

  useEffect(() => {
    // Wait for auth to resolve before calling the gated /api/aloc endpoint
    if (authLoading) return;
    // Guests fall back to sample questions immediately
    if (!user) { setQuestions(FALLBACK); setLoading(false); return; }

    fetch(`/api/aloc?endpoint=questions-count&subject=${encodeURIComponent(todaySubject)}&count=${DAILY_COUNT}&type=utme`)
      .then((r) => r.json())
      .then((res: { ok: boolean; data?: Q[] }) => {
        const pool = res.ok && Array.isArray(res.data) && res.data.length >= DAILY_COUNT
          ? res.data.slice(0, DAILY_COUNT) : FALLBACK;
        setQuestions(pool);
      })
      .catch(() => setQuestions(FALLBACK))
      .finally(() => setLoading(false));
  }, [authLoading, user, todaySubject]);

  const q = questions[current];
  const correct = Object.entries(answers).filter(([i, a]) => questions[Number(i)]?.answer === a).length;
  const accuracy = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
  const answered = answers[current] !== undefined;

  async function finish() {
    if (submitting) return;
    setSubmitting(true); setFinished(true);
    try {
      if (user && questions.length > 0) {
        const supabase = createSupabaseBrowserClient();
        const attempt = await createAttempt(supabase, user.id, null, questions.length);
        if (attempt) {
          const rows = Object.entries(answers).map(([i, sel]) => ({
            question_id: questions[Number(i)].id, selected_option: sel,
            is_correct: questions[Number(i)].answer === sel, marked_for_review: false,
          }));
          await saveAnswers(supabase, attempt.id, rows);
          await submitAttempt(supabase, attempt.id, correct);
          await updateStreak(supabase, user.id);
        }
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  }

  function choose(idx: number) { setAnswers((p) => ({ ...p, [current]: idx })); setShowExpl(false); }
  function next() { setShowExpl(false); if (current < questions.length - 1) setCurrent((c) => c + 1); else void finish(); }

  return (
    <main className="min-h-screen bg-[#eef2ff] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-[30px] bg-white p-6 ring-1 ring-slate-200 shadow-[0_18px_60px_rgba(93,74,228,0.1)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500">Daily Challenge</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Today&apos;s Challenge</h1>
            <p className="mt-1 text-sm text-slate-400">{todayLabel} · {todaySubject}</p>
          </div>
          <Link href="/dashboard" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Dashboard</Link>
        </div>

        <section className="mb-6 rounded-[28px] bg-gradient-to-r from-violet-600 to-violet-500 p-6 text-white shadow-xl shadow-violet-300/25">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-violet-100">{DAILY_COUNT} Questions · {todaySubject}</p>
              <h2 className="mt-2 text-3xl font-black">Daily challenge</h2>
            </div>
            <div className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold">
              {finished ? "Done ✓" : started ? `${current + 1}/${questions.length}` : "Live"}
            </div>
          </div>
          {finished && (
            <div className="mt-6 grid gap-4 sm:grid-cols-4">
              {[
                { label: "Score", value: `${correct} / ${questions.length}` },
                { label: "Accuracy", value: `${accuracy}%` },
                { label: "Subject", value: todaySubject },
                { label: "Result", value: accuracy >= 70 ? "Great! 🎉" : accuracy >= 50 ? "Keep going!" : "Practice more 💪" },
              ].map((c) => (
                <div key={c.label} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
                  <p className="text-xs uppercase tracking-[0.18em] text-violet-100">{c.label}</p>
                  <p className="mt-2 text-xl font-black">{c.value}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {!started && !finished && (
          <div className="space-y-4">
            <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
              <p className="font-bold text-slate-800">10 questions · {todaySubject} · No timer</p>
              <p className="mt-1 text-sm text-slate-500">Answer each question, then see the explanation before moving on.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStarted(true)} disabled={loading}
                className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white disabled:opacity-60">
                {loading ? "Loading questions…" : "Start challenge"}
              </button>
              <Link href="/community" className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700">
                Discuss in community
              </Link>
            </div>
          </div>
        )}

        {started && !finished && q && (
          <div className="rounded-[28px] bg-slate-50 p-6 ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500">Q {current + 1} of {questions.length}</span>
              <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
              </div>
            </div>
            <p className="mb-6 text-lg leading-8 text-slate-800">{q.prompt}</p>
            <div className="space-y-3">
              {q.options.map((opt, idx) => {
                const isSelected = answers[current] === idx;
                const isCorrectOpt = idx === q.answer;
                const showResult = answered && showExpl;
                return (
                  <button key={opt} type="button" onClick={() => !answered && choose(idx)}
                    className={`flex w-full items-center rounded-2xl border p-4 text-left text-sm font-medium transition
                      ${showResult && isCorrectOpt ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                        : showResult && isSelected && !isCorrectOpt ? "border-rose-300 bg-rose-50 text-rose-800"
                        : isSelected ? "border-violet-500 bg-violet-50 text-violet-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-violet-200"}`}>
                    <span className="mr-3 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {opt}
                    {showResult && isCorrectOpt && <span className="ml-auto text-xs font-bold text-emerald-600">✓ Correct</span>}
                    {showResult && isSelected && !isCorrectOpt && <span className="ml-auto text-xs font-bold text-rose-600">✗ Wrong</span>}
                  </button>
                );
              })}
            </div>

            {answered && q.explanation && (
              <div className="mt-4">
                {!showExpl ? (
                  <button onClick={() => setShowExpl(true)} className="text-sm font-bold text-violet-600 hover:underline">Show explanation</button>
                ) : (
                  <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                    <p className="text-sm font-bold text-emerald-800">Explanation</p>
                    <p className="mt-1 text-sm text-emerald-900">{q.explanation}</p>
                  </div>
                )}
              </div>
            )}

            <button type="button" onClick={next} disabled={!answered || submitting}
              className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-violet-600 text-sm font-bold text-white disabled:opacity-40">
              {current === questions.length - 1 ? (submitting ? "Saving…" : "Finish challenge") : "Next question →"}
            </button>
          </div>
        )}

        {finished && (
          <div className="flex gap-3">
            <Link href={`/results?score=${correct}&total=${questions.length}&subject=${encodeURIComponent(todaySubject)}&answered=${Object.keys(answers).length}&wrong=${Object.keys(answers).length - correct}`}
              className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
              View full results
            </Link>
            <Link href="/practice" className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700">
              Continue practising
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
