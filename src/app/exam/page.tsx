"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, Suspense, useEffect, useRef, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { createAttempt, saveAnswers, submitAttempt, updateStreak } from "@/lib/queries";
import { ALOC_SUBJECTS } from "@/lib/aloc";
import AppShell from "@/components/AppShell";
import {
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Layers,
  Play,
  XCircle,
} from "lucide-react";

/**
 * JAMB UTME standard: Use of English (60) + three other subjects (40 each)
 * = 180 questions in 2 hours. The lobby lets candidates pick the three
 * subjects and per-subject question counts before starting.
 */
const ENGLISH = "English Language";
const OTHER_SUBJECTS = ALOC_SUBJECTS.filter((s) => s.name !== ENGLISH).map((s) => s.name);

type ExamQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string | null;
  image?: string | null;
  section?: string | null;
  year?: string | null;
  subject?: string | null; // set at combine time
};

const FALLBACK: ExamQuestion[] = [
  { id: "f1", prompt: "Which statement best explains consensus?", options: ["Immediate agreement", "Failure to agree", "A postponed discussion", "Approval without debate"], answer: 0, explanation: null },
  { id: "f2", prompt: "If 2x + 6 = 18, what is the value of x?", options: ["3", "6", "9", "12"], answer: 1, explanation: "2x = 12, so x = 6." },
  { id: "f3", prompt: "What is the SI unit of electric current?", options: ["Volt", "Ohm", "Ampere", "Watt"], answer: 2, explanation: "Ampere (A) is the SI unit." },
  { id: "f4", prompt: "Which compound is an alkane?", options: ["C2H4", "C2H2", "C2H6", "C6H6"], answer: 2, explanation: "Alkanes: CnH2n+2. C2H6 = ethane." },
  { id: "f5", prompt: "Photosynthesis in green plants produces:", options: ["CO2 and water", "Glucose and oxygen", "Starch and CO2", "Oxygen only"], answer: 1, explanation: null },
];

// ─── Calculator ───────────────────────────────────────────────────────────────

function calcExpr(input: string): string | number {
  const tokens = input.match(/\d+(?:\.\d+)?|[+\-*/]/g);
  if (!tokens) return "-";
  if (tokens.join("") !== input.replace(/\s/g, "")) return "-";
  let r = Number(tokens[0]);
  for (let i = 1; i < tokens.length; i += 2) {
    const n = Number(tokens[i + 1]);
    if (Number.isNaN(n)) return "-";
    if (tokens[i] === "+") r += n;
    else if (tokens[i] === "-") r -= n;
    else if (tokens[i] === "*") r *= n;
    else if (tokens[i] === "/") { if (n === 0) return "-"; r /= n; }
    else return "-";
  }
  return Number.isFinite(r) ? Math.round(r * 1e10) / 1e10 : "-";
}

function CalculatorPad({ onClose }: { onClose: () => void }) {
  const [expr, setExpr] = useState("");
  const keys = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "=", "+"];
  function press(k: string) {
    if (k === "=") {
      const result = calcExpr(expr);
      if (typeof result === "number") setExpr(String(result));
      return;
    }
    setExpr((e) => e + k);
  }
  return (
    <div className="rounded-[28px] bg-slate-900 p-4 text-white">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold">Calculator</p>
        <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold" aria-label="Close calculator">Hide</button>
      </div>
      <div className="mb-3 min-h-[2.5rem] rounded-xl bg-white/10 px-3 py-2 text-right font-mono text-lg font-bold break-all">
        {expr || "0"}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {keys.map((k) => (
          <button key={k} type="button" onClick={() => press(k)}
            className={`h-11 rounded-xl text-base font-bold ${k === "=" ? "bg-emerald-500 text-white" : "bg-white/10 active:bg-white/20"}`}>
            {k === "*" ? "×" : k === "/" ? "÷" : k}
          </button>
        ))}
        <button type="button" onClick={() => setExpr((e) => e.slice(0, -1))} className="col-span-2 h-11 rounded-xl bg-white/10 text-sm font-bold">Backspace</button>
        <button type="button" onClick={() => setExpr("")} className="col-span-2 h-11 rounded-xl bg-rose-500/80 text-sm font-bold">Clear</button>
      </div>
    </div>
  );
}

// ─── Media (passage + image) ──────────────────────────────────────────────────

function QuestionMedia({ question }: { question: ExamQuestion }) {
  return (
    <>
      {question.section && (
        <div className="mb-4 max-h-72 overflow-y-auto whitespace-pre-line rounded-[20px] bg-amber-50 p-4 ring-1 ring-amber-100">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Passage</p>
          <p className="text-sm leading-7 text-slate-800">{question.section}</p>
        </div>
      )}
      {question.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={question.image}
          alt="Question illustration"
          className="mb-4 max-h-72 w-auto max-w-full rounded-2xl ring-1 ring-slate-200"
          loading="lazy"
        />
      )}
    </>
  );
}

// ─── Inline review screen ─────────────────────────────────────────────────────
type ReviewEntry = { question: ExamQuestion; selectedIdx: number | null; questionIdx: number };

function InlineReview({
  entries,
  score,
  total,
  subject,
  onRetry,
}: {
  entries: ReviewEntry[];
  score: number;
  total: number;
  subject: string;
  onRetry: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "wrong" | "correct">("all");
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const practiceScore = Math.round((score / total) * 400);

  const visible = entries.filter((e) => {
    if (filter === "wrong") return e.selectedIdx !== e.question.answer;
    if (filter === "correct") return e.selectedIdx === e.question.answer;
    return true;
  });

  return (
    <AppShell title="Results" back="/practice">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-3xl lg:px-6">
        <div className="mb-6 rounded-[28px] bg-gradient-to-br from-emerald-800 to-emerald-600 p-6 text-white shadow-xl">
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-100">Results · {subject}</p>
          <div className="mt-3 flex items-end gap-4">
            <h1 className="text-5xl font-black">{practiceScore}<span className="ml-1 text-2xl font-semibold text-emerald-200">/400</span></h1>
            <div className="pb-1">
              <p className="text-lg font-bold">{score} / {total} correct · {pct}%</p>
              <p className="text-sm text-emerald-100">{pct >= 70 ? "Great performance!" : pct >= 50 ? "Keep pushing!" : "More practice needed"}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { label: "Correct", value: score, color: "bg-emerald-700/60" },
              { label: "Wrong", value: total - score, color: "bg-rose-500/40" },
              { label: "Skipped", value: entries.filter((e) => e.selectedIdx === null).length, color: "bg-slate-600/40" },
            ].map((s) => (
              <div key={s.label} className={`rounded-2xl ${s.color} p-3 text-center ring-1 ring-white/10`}>
                <p className="text-2xl font-black">{s.value}</p>
                <p className="text-xs uppercase tracking-[0.14em] text-emerald-100">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={onRetry}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-emerald-800 hover:bg-emerald-50">
              Try again
            </button>
            <Link href="/practice" className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10">
              New session
            </Link>
            <Link href="/dashboard" className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10">
              Dashboard
            </Link>
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          {(["all", "wrong", "correct"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${filter === f
                ? f === "wrong" ? "bg-rose-600 text-white" : f === "correct" ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"}`}>
              {f === "all" ? `All (${entries.length})` : f === "wrong" ? `Wrong (${entries.filter((e) => e.selectedIdx !== e.question.answer).length})` : `Correct (${score})`}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {visible.map((entry) => {
            const { question: q, selectedIdx, questionIdx } = entry;
            const isCorrect = selectedIdx === q.answer;
            const isSkipped = selectedIdx === null;

            return (
              <div key={`${q.id}-${questionIdx}`}
                className={`rounded-[24px] border p-5 ${isCorrect ? "border-emerald-200 bg-emerald-50" : isSkipped ? "border-slate-200 bg-white" : "border-rose-200 bg-rose-50"}`}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${isCorrect ? "bg-emerald-200 text-emerald-800" : isSkipped ? "bg-slate-200 text-slate-700" : "bg-rose-200 text-rose-800"}`}>
                    Q{questionIdx + 1} · {isCorrect ? "Correct" : isSkipped ? "Skipped" : "Wrong"}
                  </span>
                  <div className="flex gap-1.5">
                    {q.subject && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">{q.subject}</span>}
                    {q.year && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{q.year}</span>}
                  </div>
                </div>

                <QuestionMedia question={q} />
                <p className="text-base font-semibold leading-7 text-slate-800">{q.prompt}</p>

                <div className="mt-4 grid gap-2">
                  {q.options.map((opt, idx) => {
                    const isCorrectOpt = idx === q.answer;
                    const isYours = idx === selectedIdx;
                    return (
                      <div key={idx}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium
                          ${isCorrectOpt ? "border-emerald-400 bg-emerald-100 text-emerald-900"
                            : isYours && !isCorrectOpt ? "border-rose-300 bg-rose-100 text-rose-800"
                            : "border-slate-200 bg-white text-slate-600"}`}>
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black
                          ${isCorrectOpt ? "bg-emerald-500 text-white"
                            : isYours && !isCorrectOpt ? "bg-rose-400 text-white"
                            : "bg-slate-100 text-slate-500"}`}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        {opt}
                        {isCorrectOpt && (
                          <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                            <Check className="h-3.5 w-3.5" aria-hidden /> Correct answer
                          </span>
                        )}
                        {isYours && !isCorrectOpt && (
                          <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                            <XCircle className="h-3.5 w-3.5" aria-hidden /> Your answer
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {q.explanation && (
                  <div className="mt-4 rounded-xl bg-white/80 p-4 ring-1 ring-emerald-200">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Explanation</p>
                    <p className="mt-1.5 text-sm leading-6 text-slate-700">{q.explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {visible.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">No questions in this filter.</p>
        )}
      </div>
    </AppShell>
  );
}

// ─── Main exam content ────────────────────────────────────────────────────────

type SubjectPlan = { name: string; count: number };

function ExamPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useUser();

  const mode = searchParams.get("mode") === "study" ? "study" : "exam";
  const isStudyMode = mode === "study";

  const urlSubject = searchParams.get("subject") ?? ENGLISH;
  const urlCount = Math.max(1, Math.min(Number(searchParams.get("count") ?? 40), 60));
  const urlTimer = searchParams.get("timer") ?? "Recommended timer";
  const urlYear = searchParams.get("year") ?? "All years";

  // ── Lobby state ──
  const [started, setStarted] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState("");

  // Exam mode: JAMB standard 4-subject plan. English is always subject 1.
  const [plan, setPlan] = useState<SubjectPlan[]>([
    { name: ENGLISH, count: 60 },
    { name: "Biology", count: 40 },
    { name: "Chemistry", count: 40 },
    { name: "Physics", count: 40 },
  ]);

  // Study mode: single subject
  const [studySubject, setStudySubject] = useState(urlSubject);
  const [studyCount, setStudyCount] = useState(urlCount);

  const questionCache = useRef<Map<string, ExamQuestion[]>>(new Map());
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [subjectTabs, setSubjectTabs] = useState<{ name: string; start: number }[]>([]);
  const [sessionLabel, setSessionLabel] = useState(urlSubject);

  const [questionTotal, setQuestionTotal] = useState(urlCount);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [revealedInStudy, setRevealedInStudy] = useState<Set<number>>(new Set());
  const [showCalc, setShowCalc] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const attemptIdRef = useRef<string | null>(null);

  const [reviewEntries, setReviewEntries] = useState<ReviewEntry[] | null>(null);
  const [reviewScore, setReviewScore] = useState(0);

  const q = questions[currentQuestion];
  const answeredCount = Object.keys(answers).length;
  const isRevealed = isStudyMode && revealedInStudy.has(currentQuestion);

  const planTotal = plan.reduce((s, p) => s + p.count, 0);
  const autoMinutes = Math.max(15, Math.round((planTotal * 2) / 3)); // JAMB: 180q ≈ 120 min

  // Restore saved 4-subject combination
  useEffect(() => {
    try {
      const s = localStorage.getItem("orbit_prefs");
      if (s) {
        const p = JSON.parse(s) as { subjects?: string[] };
        if (Array.isArray(p.subjects) && p.subjects.length === 4) {
          const others = p.subjects.filter((n) => n !== ENGLISH).slice(0, 3);
          setPlan((prev) => [
            prev[0],
            ...[0, 1, 2].map((i) => ({ name: others[i] ?? prev[i + 1].name, count: prev[i + 1].count })),
          ]);
        }
      }
    } catch (_e) { /* ignore */ }
  }, []);

  // ── Start: fetch per-subject questions, tag them, build tabs ────────────────
  async function startSession() {
    setPreparing(true);
    setPrepareError("");
    try {
      const entries = isStudyMode ? [{ name: studySubject, count: studyCount }] : plan;
      const perSubject = await Promise.all(
        entries.map(async ({ name, count }) => {
          const cached = questionCache.current.get(name);
          const pool: ExamQuestion[] =
            cached ??
            await fetch(`/api/aloc?endpoint=questions&subject=${encodeURIComponent(name)}&type=utme`)
              .then((r) => r.json())
              .then((res: { ok: boolean; data?: ExamQuestion[]; error?: string }) => {
                if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
                  questionCache.current.set(name, res.data);
                  return res.data;
                }
                throw new Error(res.error ?? `No questions for ${name}`);
              });
          return pool.slice(0, count).map((qn) => ({ ...qn, subject: name }));
        }),
      );

      const combined = perSubject.flat();
      if (combined.length === 0) throw new Error("Could not load any questions. Check your connection.");

      const tabs: { name: string; start: number }[] = [];
      let offset = 0;
      for (const group of perSubject) {
        if (group.length > 0) {
          tabs.push({ name: group[0].subject ?? "", start: offset });
          offset += group.length;
        }
      }

      startTransition(() => {
        setQuestions(combined);
        setSubjectTabs(tabs);
        setQuestionTotal(combined.length);
        setSessionLabel(
          isStudyMode
            ? studySubject
            : entries.length > 1
              ? `Mock exam · ${entries.map((e) => e.name.replace(" Language", "")).join(" + ")}`
              : entries[0].name,
        );
        if (!isStudyMode) {
          const mins = urlTimer === "1 hour" ? 60 : urlTimer === "30 minutes" ? 30 : urlTimer === "15 minutes" ? 15 : autoMinutes;
          setTimeLeft(mins * 60);
        } else {
          setTimeLeft(null);
        }
        setCurrentQuestion(0);
        setStarted(true);
      });
    } catch (err) {
      setPrepareError(err instanceof Error ? err.message : "Could not prepare the exam. Try again.");
    } finally {
      setPreparing(false);
    }
  }

  // Create attempt once questions are ready
  useEffect(() => {
    if (!user || !started || questions.length === 0 || attemptIdRef.current) return;
    try {
      const supabase = createSupabaseBrowserClient();
      createAttempt(supabase, user.id, null, questionTotal).then((a) => { if (a) attemptIdRef.current = a.id; });
    } catch { /* env not set */ }
  }, [user, started, questions, questionTotal]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const id = window.setInterval(() => setTimeLeft((v) => (v === null ? null : v - 1)), 1000);
    return () => clearInterval(id);
  }, [timeLeft]);

  // Auto-submit when time expires
  useEffect(() => {
    if (timeLeft === 0 && !submitting) void doSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // ── Lobby ───────────────────────────────────────────────────────────────────
  if (!started && !reviewEntries) {
    return (
      <AppShell title={isStudyMode ? "Study Mode" : "Mock Exam"} back="/practice">
        <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-3xl lg:px-6">
          <div className="mb-5 rounded-[28px] bg-gradient-to-br from-violet-600 to-violet-500 p-6 text-white shadow-xl shadow-violet-300/25">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-100">
              {isStudyMode ? "Study mode — answers shown as you go" : "JAMB standard · 4 subjects"}
            </p>
            <h1 className="mt-2 text-3xl font-black">Ready to begin?</h1>
            <p className="mt-2 text-sm text-violet-100">
              {isStudyMode
                ? "Answer at your own pace and see the correct answer immediately after each question."
                : "Use of English is compulsory. Choose your three other subjects and how many questions per subject."}
            </p>
          </div>

          {isStudyMode ? (
            <div className="mb-5 rounded-[24px] bg-white p-5 ring-1 ring-slate-200">
              <h2 className="mb-4 text-base font-black text-slate-900">Session settings</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Subject</span>
                  <select value={studySubject} onChange={(e) => setStudySubject(e.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-500">
                    {ALOC_SUBJECTS.map((s) => <option key={s.name}>{s.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Questions</span>
                  <select value={studyCount} onChange={(e) => setStudyCount(Number(e.target.value))}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-500">
                    {[10, 20, 40, 60].map((n) => <option key={n} value={n}>{n} questions</option>)}
                  </select>
                </label>
              </div>
            </div>
          ) : (
            <div className="mb-5 rounded-[24px] bg-white p-5 ring-1 ring-slate-200">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-black text-slate-900">Your four subjects</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-100">
                  <Layers className="h-3.5 w-3.5" aria-hidden /> {planTotal} questions
                </span>
              </div>

              {/* English — compulsory */}
              <div className="mb-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-xs font-black text-white">EN</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900">{ENGLISH}</p>
                    <p className="text-[11px] font-semibold text-violet-600">Compulsory</p>
                  </div>
                  <select
                    value={plan[0].count}
                    onChange={(e) => setPlan((p) => p.map((row, i) => (i === 0 ? { ...row, count: Number(e.target.value) } : row)))}
                    className="h-10 w-28 rounded-xl border border-violet-200 bg-white px-2 text-sm font-bold text-slate-800 outline-none focus:border-violet-500"
                    aria-label="English questions"
                  >
                    {[40, 50, 60].map((n) => <option key={n} value={n}>{n} Qs</option>)}
                  </select>
                </div>
              </div>

              {/* Three optional subjects with dropdowns */}
              {[1, 2, 3].map((slot) => (
                <div key={slot} className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-500">{slot + 1}</span>
                  <select
                    value={plan[slot].name}
                    onChange={(e) =>
                      setPlan((p) => p.map((row, i) => (i === slot ? { ...row, name: e.target.value } : row)))
                    }
                    className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-sm font-bold text-slate-800 outline-none focus:border-violet-500"
                    aria-label={`Subject ${slot + 1}`}
                  >
                    {OTHER_SUBJECTS.map((n) => (
                      <option key={n} value={n} disabled={plan.some((row, i) => i > 0 && i !== slot && row.name === n)}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <select
                    value={plan[slot].count}
                    onChange={(e) => setPlan((p) => p.map((row, i) => (i === slot ? { ...row, count: Number(e.target.value) } : row)))}
                    className="h-10 w-28 rounded-xl border border-slate-200 bg-white px-2 text-sm font-bold text-slate-800 outline-none focus:border-violet-500"
                    aria-label={`Subject ${slot + 1} questions`}
                  >
                    {[10, 20, 30, 40].map((n) => <option key={n} value={n}>{n} Qs</option>)}
                  </select>
                </div>
              ))}

              <div className="mt-2 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                <span className="font-bold text-slate-700">Total time</span>
                <span className="font-black text-slate-900">{autoMinutes} minutes <span className="font-semibold text-slate-400">(JAMB pace)</span></span>
              </div>
            </div>
          )}

          {prepareError && (
            <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
              {prepareError}
            </div>
          )}

          <button type="button" onClick={() => void startSession()} disabled={preparing}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 text-base font-black text-white shadow-lg shadow-violet-300/30 transition hover:bg-violet-700 disabled:opacity-60">
            <Play className="h-5 w-5" aria-hidden />
            {preparing ? "Preparing questions…" : "Start now"}
          </button>
          <Link href="/practice" className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700">
            Back to practice settings
          </Link>
        </div>
      </AppShell>
    );
  }

  async function doSubmit() {
    if (submitting) return;
    setSubmitting(true);

    const entries: ReviewEntry[] = questions.slice(0, questionTotal).map((qn, idx) => ({
      question: qn,
      selectedIdx: answers[idx] ?? null,
      questionIdx: idx,
    }));
    const correct = entries.filter((e) => e.selectedIdx === e.question.answer).length;

    try {
      if (user && attemptIdRef.current) {
        const supabase = createSupabaseBrowserClient();
        const rows = entries
          .filter((e) => e.selectedIdx !== null)
          .map((e) => ({
            question_id: e.question.id,
            selected_option: e.selectedIdx as number,
            is_correct: e.question.answer === e.selectedIdx,
            marked_for_review: marked.has(e.questionIdx),
            question: {
              id: e.question.id,
              prompt: e.question.prompt,
              options: e.question.options,
              correct_option: e.question.answer,
              explanation: e.question.explanation,
              difficulty: "medium",
              subject_name: e.question.subject ?? sessionLabel,
            },
          }));
        await saveAnswers(supabase, attemptIdRef.current, rows);
        await submitAttempt(supabase, attemptIdRef.current, correct);
        await updateStreak(supabase, user.id);
      }
    } catch (_e) { /* ignore DB errors, still show review */ }

    if (mode === "exam" && !isStudyMode) {
      router.push(
        `/results?score=${correct}&total=${questionTotal}&subject=${encodeURIComponent(sessionLabel)}&answered=${answeredCount}&wrong=${Math.max(answeredCount - correct, 0)}${attemptIdRef.current ? `&attemptId=${attemptIdRef.current}` : ""}`,
      );
    } else {
      setReviewScore(correct);
      setReviewEntries(entries);
      setSubmitting(false);
    }
  }

  function handleRetry() {
    setReviewEntries(null);
    setAnswers({});
    setMarked(new Set());
    setSkipped(new Set());
    setRevealedInStudy(new Set());
    setCurrentQuestion(0);
    setSubmitting(false);
    attemptIdRef.current = null;
    setStarted(false);
  }

  function chooseAnswer(idx: number) {
    setAnswers((p) => ({ ...p, [currentQuestion]: idx }));
    setSkipped((p) => { const n = new Set(p); n.delete(currentQuestion); return n; });
    if (isStudyMode) {
      setRevealedInStudy((p) => new Set(p).add(currentQuestion));
    }
  }
  function moveNext() {
    if (!isStudyMode && answers[currentQuestion] === undefined) setSkipped((p) => new Set(p).add(currentQuestion));
    setCurrentQuestion((v) => Math.min(v + 1, questionTotal - 1));
  }
  function toggleMark() {
    setMarked((p) => { const n = new Set(p); if (n.has(currentQuestion)) { n.delete(currentQuestion); } else { n.add(currentQuestion); } return n; });
  }

  const fmt = timeLeft === null ? (isStudyMode ? "Study mode" : "No timer")
    : `${String(Math.floor(timeLeft / 3600)).padStart(2, "0")}:${String(Math.floor((timeLeft % 3600) / 60)).padStart(2, "0")}:${String(timeLeft % 60).padStart(2, "0")}`;

  if (reviewEntries) {
    return (
      <InlineReview
        entries={reviewEntries}
        score={reviewScore}
        total={questionTotal}
        subject={sessionLabel}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <AppShell hideTopBar>
      <main className="px-2 py-4 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                {isStudyMode ? "Study mode — answers shown immediately" : "JAMB standard simulation"}
              </p>
              <h1 className="mt-1 truncate text-xl font-black tracking-tight text-slate-900">{sessionLabel}</h1>
            </div>
            <div className="flex items-center gap-2">
              {q?.year && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{q.year}</span>}
              {!isStudyMode && (
                <button type="button" onClick={() => setShowCalc((v) => !v)} aria-label="Toggle calculator"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">
                  <Calculator className="h-3.5 w-3.5" aria-hidden /> Calc
                </button>
              )}
              <div className={`rounded-full px-3 py-1 text-sm font-bold ring-1 ${isStudyMode ? "bg-violet-50 text-violet-700 ring-violet-100" : "bg-emerald-50 text-emerald-700 ring-emerald-100"}`}>{fmt}</div>
            </div>
          </div>

          {/* Subject tabs — jump to each subject's first question */}
          {subjectTabs.length > 1 && (
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {subjectTabs.map((tab, ti) => {
                const end = ti + 1 < subjectTabs.length ? subjectTabs[ti + 1].start : questionTotal;
                const active = currentQuestion >= tab.start && currentQuestion < end;
                return (
                  <button key={tab.name} type="button" onClick={() => setCurrentQuestion(tab.start)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${active ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                    {tab.name.replace(" Language", "")}
                  </button>
                );
              })}
            </div>
          )}
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.7fr_0.7fr]">
          <section className="rounded-[28px] bg-white p-5 ring-1 ring-slate-200 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${isStudyMode ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"}`}>{currentQuestion + 1}</span>
                <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Q {currentQuestion + 1} / {questionTotal}
                </span>
              </div>
              {q?.subject && (
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-100">
                  {q.subject}
                </span>
              )}
            </div>

            {q && <QuestionMedia question={q} />}

            <div className={`rounded-[24px] p-5 ring-1 ${isStudyMode ? "bg-violet-50 ring-violet-100" : "bg-slate-50 ring-slate-200"}`}>
              <p className="text-lg leading-8 text-slate-800">{q?.prompt ?? ""}</p>
            </div>

            <div className="mt-6 grid gap-3">
              {(q?.options ?? []).map((opt, idx) => {
                const isSelected = answers[currentQuestion] === idx;
                const isCorrectOpt = idx === q?.answer;
                const showResult = isStudyMode && isRevealed;

                let cls = "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50";
                if (showResult && isCorrectOpt) cls = "border-emerald-500 bg-emerald-50 text-emerald-900";
                else if (showResult && isSelected && !isCorrectOpt) cls = "border-rose-400 bg-rose-50 text-rose-800";
                else if (!showResult && isSelected) cls = "border-emerald-500 bg-emerald-50 text-emerald-900";

                return (
                  <button key={`${q?.id}-${idx}`} type="button"
                    onClick={() => !isRevealed && chooseAnswer(idx)}
                    disabled={isStudyMode && isRevealed}
                    className={`flex items-center rounded-2xl border p-4 text-left text-sm font-medium transition ${cls}`}>
                    <span className={`mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold
                      ${showResult && isCorrectOpt ? "bg-emerald-500 text-white"
                        : showResult && isSelected && !isCorrectOpt ? "bg-rose-400 text-white"
                        : "bg-slate-100 text-slate-600"}`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {opt}
                    {showResult && isCorrectOpt && (
                      <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                        <Check className="h-3.5 w-3.5" aria-hidden /> Correct
                      </span>
                    )}
                    {showResult && isSelected && !isCorrectOpt && (
                      <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                        <XCircle className="h-3.5 w-3.5" aria-hidden /> Wrong
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {isStudyMode && isRevealed && q?.explanation && (
              <div className="mt-5 rounded-[20px] bg-emerald-50 p-4 ring-1 ring-emerald-200">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Explanation</p>
                <p className="mt-2 text-sm leading-6 text-emerald-900">{q.explanation}</p>
              </div>
            )}
            {isStudyMode && isRevealed && !q?.explanation && (
              <p className="mt-4 text-xs text-slate-400">No explanation available for this question.</p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-3">
                <button type="button" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion((v) => v - 1)}
                  className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
                </button>
                {!isStudyMode && (
                  <button type="button" onClick={toggleMark}
                    className={`inline-flex items-center gap-1 rounded-2xl border px-4 py-2 text-sm font-semibold ${marked.has(currentQuestion) ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-700"}`}>
                    <Flag className="h-3.5 w-3.5" aria-hidden />
                    {marked.has(currentQuestion) ? "Marked" : "Mark"}
                  </button>
                )}
              </div>
              <button type="button" onClick={moveNext} disabled={currentQuestion === questionTotal - 1}
                className={`inline-flex items-center gap-1 rounded-2xl px-6 py-3 text-sm font-bold text-white disabled:opacity-40 ${isStudyMode ? "bg-violet-600 hover:bg-violet-700" : "bg-emerald-700"}`}>
                {isStudyMode && !isRevealed && answers[currentQuestion] !== undefined ? "Reveal answer" : "Next"}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-[28px] bg-white p-5 ring-1 ring-slate-200">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900">Navigator</h3>
                <span className="text-xs font-semibold text-slate-500">{answeredCount} answered</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: Math.min(questionTotal, 60) }, (_, i) => {
                  let btn = "bg-slate-100 text-slate-700";
                  if (i === currentQuestion) btn = isStudyMode ? "bg-violet-700 text-white" : "bg-emerald-700 text-white";
                  else if (isStudyMode && revealedInStudy.has(i)) {
                    btn = answers[i] === questions[i]?.answer ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";
                  } else if (!isStudyMode && skipped.has(i)) btn = "bg-rose-100 text-rose-700";
                  else if (!isStudyMode && marked.has(i)) btn = "bg-amber-100 text-amber-800";
                  else if (answers[i] !== undefined) btn = "bg-emerald-100 text-emerald-700";
                  return (
                    <button key={i} type="button" onClick={() => setCurrentQuestion(i)}
                      className={`flex h-9 items-center justify-center rounded-xl text-xs font-bold ${btn}`}>{i + 1}</button>
                  );
                })}
              </div>
              {questionTotal > 60 && <p className="mt-2 text-xs text-slate-400">Showing first 60 of {questionTotal}</p>}
            </div>

            <button type="button" onClick={doSubmit} disabled={submitting}
              className={`flex h-12 w-full items-center justify-center rounded-2xl text-sm font-bold text-white disabled:opacity-60 ${isStudyMode ? "bg-violet-600 hover:bg-violet-700" : "bg-rose-500 hover:bg-rose-600"}`}>
              {submitting ? "Saving…" : isStudyMode ? "Finish & Review" : "Submit Exam"}
            </button>
            <Link href="/practice" className="flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700">Exit</Link>

            {showCalc && <CalculatorPad onClose={() => setShowCalc(false)} />}
          </aside>
        </div>
      </div>
      </main>
    </AppShell>
  );
}

export default function ExamPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" /></div>}>
      <ExamPageContent />
    </Suspense>
  );
}
