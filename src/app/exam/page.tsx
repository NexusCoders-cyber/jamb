"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, Suspense, useEffect, useRef, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { createAttempt, saveAnswers, submitAttempt, updateStreak } from "@/lib/queries";
import { ALOC_SUBJECTS } from "@/lib/aloc";

type ExamQuestion = { id: string; prompt: string; options: string[]; answer: number; explanation: string | null };
type SubjectItem = { name: string; slug: string; count: number };

const FALLBACK: ExamQuestion[] = [
  { id: "f1", prompt: "Which statement best explains consensus?", options: ["Immediate agreement", "Failure to agree", "A postponed discussion", "Approval without debate"], answer: 0, explanation: null },
  { id: "f2", prompt: "If 2x + 6 = 18, what is the value of x?", options: ["3", "6", "9", "12"], answer: 1, explanation: "2x = 12, so x = 6." },
  { id: "f3", prompt: "What is the SI unit of electric current?", options: ["Volt", "Ohm", "Ampere", "Watt"], answer: 2, explanation: "Ampere (A) is the SI unit." },
  { id: "f4", prompt: "Which compound is an alkane?", options: ["C2H4", "C2H2", "C2H6", "C6H6"], answer: 2, explanation: "Alkanes: CnH2n+2. C2H6 = ethane." },
  { id: "f5", prompt: "Photosynthesis in green plants produces:", options: ["CO2 and water", "Glucose and oxygen", "Starch and CO2", "Oxygen only"], answer: 1, explanation: null },
];

const ALL_SUBJECTS: SubjectItem[] = ALOC_SUBJECTS.map((s) => ({
  name: s.name, slug: s.slug, count: s.name === "English Language" ? 60 : 40,
}));

function calcExpr(input: string): string | number {
  const tokens = input.match(/\d+(?:\.\d+)?|[+\-*/]/g);
  if (!tokens || tokens.join("") !== input.replace(/\s/g, "")) return "-";
  let r = Number(tokens[0]);
  for (let i = 1; i < tokens.length; i += 2) {
    const n = Number(tokens[i + 1]);
    if (tokens[i] === "+") r += n;
    else if (tokens[i] === "-") r -= n;
    else if (tokens[i] === "*") r *= n;
    else if (tokens[i] === "/") { if (n === 0) return "-"; r /= n; }
  }
  return Number.isFinite(r) ? r : "-";
}

function ExamPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useUser();

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(["English Language", "Biology", "Chemistry", "Physics"]);
  const [selectedSubject, setSelectedSubject] = useState(searchParams.get("subject") ?? "English Language");
  const questionCache = useRef<Map<string, ExamQuestion[]>>(new Map());
  const [questions, setQuestions] = useState<ExamQuestion[]>(FALLBACK);
  const [loadingQ, setLoadingQ] = useState(false);
  const [qError, setQError] = useState("");

  const questionTotal = Math.max(1, Math.min(Number(searchParams.get("count") ?? 40), 180));
  const timerPref = searchParams.get("timer") ?? "Recommended timer";

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(timerPref === "No timer" ? null : 120 * 60);
  const [showCalc, setShowCalc] = useState(false);
  const [calcVal, setCalcVal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const attemptIdRef = useRef<string | null>(null);

  const q = questions[currentQuestion % questions.length];
  const answeredCount = Object.keys(answers).length;

  // Restore saved subjects
  useEffect(() => {
    try {
      const s = localStorage.getItem("jamb_user");
      if (s) {
        const p = JSON.parse(s) as { subjects?: string[] };
        if (Array.isArray(p.subjects) && p.subjects.length === 4) startTransition(() => setSelectedSubjects(p.subjects!));
      }
    } catch { /* ignore */ }
  }, []);

  // Load questions from ALOC
  useEffect(() => {
    // Wait for auth to resolve — question endpoints require a session
    if (authLoading) return;

    const cached = questionCache.current.get(selectedSubject);
    if (cached) { startTransition(() => setQuestions(cached)); return; }
    let mounted = true;
    setLoadingQ(true); setQError("");
    fetch(`/api/aloc?endpoint=questions&subject=${encodeURIComponent(selectedSubject)}&type=utme`)
      .then((r) => r.json())
      .then((res: { ok: boolean; data?: ExamQuestion[]; error?: string }) => {
        if (!mounted) return;
        if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
          questionCache.current.set(selectedSubject, res.data);
          startTransition(() => setQuestions(res.data!));
        } else {
          setQError(res.error ?? "Could not load questions — showing samples.");
        }
      })
      .catch(() => { if (mounted) setQError("Network error — showing sample questions."); })
      .finally(() => { if (mounted) setLoadingQ(false); });
    return () => { mounted = false; };
  }, [selectedSubject, authLoading]);

  // Create attempt on first real question load
  useEffect(() => {
    if (!user || questions === FALLBACK || attemptIdRef.current) return;
    try {
      const supabase = createSupabaseBrowserClient();
      createAttempt(supabase, user.id, null, questionTotal).then((a) => { if (a) attemptIdRef.current = a.id; });
    } catch { /* env not set */ }
  }, [user, questions, questionTotal]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const id = window.setInterval(() => setTimeLeft((v) => (v === null ? null : v - 1)), 1000);
    return () => clearInterval(id);
  }, [timeLeft]);

  const doSubmitRef = useRef<() => Promise<void>>();

  useEffect(() => {
    if (timeLeft === 0) void doSubmitRef.current?.();
  }, [timeLeft]);

  async function doSubmit() {
    if (submitting) return;
    setSubmitting(true);
    const correct = Object.entries(answers).filter(([idx, ans]) => questions[Number(idx) % questions.length].answer === ans).length;
    try {
      if (user && attemptIdRef.current) {
        const supabase = createSupabaseBrowserClient();
        const rows = Object.entries(answers).map(([idx, sel]) => {
          const qn = questions[Number(idx) % questions.length];
          return { question_id: qn.id, selected_option: sel, is_correct: qn.answer === sel, marked_for_review: marked.has(Number(idx)) };
        });
        await saveAnswers(supabase, attemptIdRef.current, rows);
        await submitAttempt(supabase, attemptIdRef.current, correct);
        await updateStreak(supabase, user.id);
      }
    } catch { /* ignore DB errors, still navigate */ }
    router.push(`/results?score=${correct}&total=${questionTotal}&subject=${encodeURIComponent(selectedSubject)}&answered=${answeredCount}&wrong=${Math.max(answeredCount - correct, 0)}${attemptIdRef.current ? `&attemptId=${attemptIdRef.current}` : ""}`);
  }

  // Keep the ref pointing to the latest closure so the timer effect always
  // calls the version of doSubmit that has up-to-date state.
  doSubmitRef.current = doSubmit;

  function toggleSubject(name: string) {
    if (name === "English Language") return;
    setSelectedSubjects((c) => c.includes(name) ? c.filter((s) => s !== name) : c.length < 4 ? [...c, name] : c);
  }
  function chooseAnswer(idx: number) {
    setAnswers((p) => ({ ...p, [currentQuestion]: idx }));
    setSkipped((p) => { const n = new Set(p); n.delete(currentQuestion); return n; });
  }
  function moveNext() {
    if (answers[currentQuestion] === undefined) setSkipped((p) => new Set(p).add(currentQuestion));
    setCurrentQuestion((v) => Math.min(v + 1, questionTotal - 1));
  }
  function toggleMark() {
    setMarked((p) => { const n = new Set(p); n.has(currentQuestion) ? n.delete(currentQuestion) : n.add(currentQuestion); return n; });
  }

  const fmt = timeLeft === null ? "No timer"
    : `${String(Math.floor(timeLeft / 3600)).padStart(2, "0")}:${String(Math.floor((timeLeft % 3600) / 60)).padStart(2, "0")}:${String(timeLeft % 60).padStart(2, "0")}`;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Full exam simulation</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Orbit CBT</h1>
          </div>
          <div className="flex items-center gap-2">
            {qError && <span className="hidden rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 sm:inline-flex">Sample Qs</span>}
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700 ring-1 ring-emerald-100">{fmt}</div>
          </div>
        </header>

        {/* All 17 ALOC subjects */}
        <section className="mb-6 rounded-[28px] bg-violet-50 p-5 ring-1 ring-violet-100">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600">Choose your subjects</p>
              <h2 className="mt-1 text-xl font-black text-slate-900">English + three subjects</h2>
            </div>
            <span className="text-xs font-bold text-slate-600">{selectedSubjects.length - 1} of 3 selected</span>
          </div>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {ALL_SUBJECTS.map((s) => (
              <button key={s.name} type="button" onClick={() => toggleSubject(s.name)}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${selectedSubjects.includes(s.name) ? "border-violet-400 bg-white text-violet-900" : "border-transparent bg-white/60 text-slate-600 hover:border-violet-200 hover:bg-white"}`}>
                <span className="truncate">{s.name}</span>
                {s.name === "English Language" && <span className="ml-1 shrink-0 text-[9px] text-violet-400">Req</span>}
              </button>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.7fr_0.7fr]">
          <section className="rounded-[28px] bg-white p-5 ring-1 ring-slate-200 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">{currentQuestion + 1}</span>
                <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Q {currentQuestion + 1} / {questionTotal}{loadingQ ? " · Loading…" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{selectedSubject}</div>
                <button type="button" onClick={() => setShowCalc((v) => !v)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">Calc</button>
              </div>
            </div>

            <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
              <p className="text-lg leading-8 text-slate-800">{q.prompt}</p>
            </div>

            <div className="mt-6 grid gap-3">
              {q.options.map((opt, idx) => (
                <button key={`${q.id}-${idx}`} type="button" onClick={() => chooseAnswer(idx)}
                  className={`flex items-center rounded-2xl border p-4 text-left text-sm font-medium transition ${answers[currentQuestion] === idx ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50"}`}>
                  <span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">{String.fromCharCode(65 + idx)}</span>
                  {String.fromCharCode(65 + idx)}. {opt}
                </button>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-3">
                <button type="button" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion((v) => v - 1)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">Prev</button>
                <button type="button" onClick={toggleMark} className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${marked.has(currentQuestion) ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-700"}`}>
                  {marked.has(currentQuestion) ? "Marked ★" : "Mark"}
                </button>
              </div>
              <button type="button" onClick={moveNext} disabled={currentQuestion === questionTotal - 1} className="rounded-2xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white disabled:opacity-40">Next</button>
            </div>
          </section>

          <aside className="space-y-5">
            {/* Subject switcher */}
            <div className="rounded-[28px] bg-white p-5 ring-1 ring-slate-200">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900">Subjects</h3>
                <span className="text-xs font-semibold text-slate-500">{answeredCount} answered</span>
              </div>
              <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 260 }}>
                {ALL_SUBJECTS.map((s) => (
                  <button key={s.name} type="button" onClick={() => setSelectedSubject(s.name)}
                    className={`flex w-full items-center justify-between rounded-2xl p-3 text-left text-xs transition ${s.name === selectedSubject ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-slate-50 hover:bg-slate-100"}`}>
                    <div>
                      <p className="font-semibold text-slate-800">{s.name}</p>
                      <p className="text-slate-400">{s.count} questions</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.name === selectedSubject ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {s.name === selectedSubject ? "Active" : "Ready"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Navigator */}
            <div className="rounded-[28px] bg-white p-5 ring-1 ring-slate-200">
              <h3 className="mb-4 text-base font-black text-slate-900">Navigator</h3>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: Math.min(questionTotal, 60) }, (_, i) => (
                  <button key={i} type="button" onClick={() => setCurrentQuestion(i)}
                    className={`flex h-9 items-center justify-center rounded-xl text-xs font-bold ${i === currentQuestion ? "bg-emerald-700 text-white" : skipped.has(i) ? "bg-rose-100 text-rose-700" : marked.has(i) ? "bg-amber-100 text-amber-800" : answers[i] !== undefined ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{i + 1}</button>
                ))}
              </div>
              {questionTotal > 60 && <p className="mt-2 text-xs text-slate-400">Showing first 60 of {questionTotal}</p>}
            </div>

            <button type="button" onClick={doSubmit} disabled={submitting} className="flex h-12 w-full items-center justify-center rounded-2xl bg-rose-500 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-60">
              {submitting ? "Submitting…" : "Submit Exam"}
            </button>
            <Link href="/dashboard" className="flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700">Exit</Link>

            {showCalc && (
              <div className="rounded-[28px] bg-slate-900 p-4 text-white">
                <p className="mb-2 text-sm font-bold">Calculator</p>
                <input value={calcVal} onChange={(e) => setCalcVal(e.target.value)} placeholder="e.g. 200 / 50" className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm outline-none" />
                <p className="mt-3 text-right text-lg font-black">{calcVal ? calcExpr(calcVal) : "0"}</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function ExamPage() {
  return (
    <Suspense fallback={<main className="min-h-screen px-4 py-6" />}>
      <ExamPageContent />
    </Suspense>
  );
}
