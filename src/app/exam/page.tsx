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
  Play,
  XCircle,
} from "lucide-react";

/**
 * Full ALOC question shape — includes fields the review screen and study mode
 * need (image, section/passage, year) that older code dropped.
 */
type ExamQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string | null;
  image?: string | null;
  section?: string | null;
  year?: string | null;
};
type SubjectItem = { name: string; slug: string; count: number };

const FALLBACK: ExamQuestion[] = [
  { id: "f1", prompt: "Which statement best explains consensus?", options: ["Immediate agreement", "Failure to agree", "A postponed discussion", "Approval without debate"], answer: 0, explanation: null },
  { id: "f2", prompt: "If 2x + 6 = 18, what is the value of x?", options: ["3", "6", "9", "12"], answer: 1, explanation: "2x = 12, so x = 6." },
  { id: "f3", prompt: "What is the SI unit of electric current?", options: ["Volt", "Ohm", "Ampere", "Watt"], answer: 2, explanation: "Ampere (A) is the SI unit." },
  { id: "f4", prompt: "Which compound is an alkane?", options: ["C2H4", "C2H2", "C2H6", "C6H6"], answer: 2, explanation: "Alkanes: CnH2n+2. C2H6 = ethane." },
  { id: "f5", prompt: "Photosynthesis in green plants produces:", options: ["CO2 and water", "Glucose and oxygen", "Starch and CO2", "Oxygen only"], answer: 1, explanation: null },
];

const ALL_SUBJECTS: SubjectItem[] = ALOC_SUBJECTS.map((s) => ({ name: s.name, slug: s.slug, count: s.name === "English Language" ? 60 : 40 }));

// ─── Calculator ───────────────────────────────────────────────────────────────
// A simple safe arithmetic evaluator (no eval): supports + - × ÷ and decimals.

function calcExpr(input: string): string | number {
  const tokens = input.match(/\d+(?:\.\d+)?|[+\-*/]/g);
  if (!tokens) return "-";
  // Guard: token stream must cover the whole (whitespace-stripped) input
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

// ─── Inline review screen shown after submission ──────────────────────────────
type ReviewEntry = { question: ExamQuestion; selectedIdx: number | null; questionIdx: number };

function QuestionMedia({ question }: { question: ExamQuestion }) {
  return (
    <>
      {/* Comprehension passage / section text */}
      {question.section && (
        <div className="mb-4 max-h-72 overflow-y-auto whitespace-pre-line rounded-[20px] bg-amber-50 p-4 ring-1 ring-amber-100">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Passage</p>
          <p className="text-sm leading-7 text-slate-800">{question.section}</p>
        </div>
      )}
      {/* Question image */}
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
        {/* Score banner */}
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

        {/* Filter tabs */}
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

        {/* Question list */}
        <div className="space-y-4">
          {visible.map((entry) => {
            const { question: q, selectedIdx, questionIdx } = entry;
            const isCorrect = selectedIdx === q.answer;
            const isSkipped = selectedIdx === null;

            return (
              <div key={q.id}
                className={`rounded-[24px] border p-5 ${isCorrect ? "border-emerald-200 bg-emerald-50" : isSkipped ? "border-slate-200 bg-white" : "border-rose-200 bg-rose-50"}`}>
                {/* Question header */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${isCorrect ? "bg-emerald-200 text-emerald-800" : isSkipped ? "bg-slate-200 text-slate-700" : "bg-rose-200 text-rose-800"}`}>
                    Q{questionIdx + 1} · {isCorrect ? "Correct" : isSkipped ? "Skipped" : "Wrong"}
                  </span>
                  {q.year && <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{q.year}</span>}
                </div>

                <QuestionMedia question={q} />
                <p className="text-base font-semibold leading-7 text-slate-800">{q.prompt}</p>

                {/* Options */}
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

                {/* Explanation */}
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
function ExamPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useUser();

  // mode=study → show answer immediately; mode=exam (default) → standard CBT
  const mode = searchParams.get("mode") === "study" ? "study" : "exam";
  const isStudyMode = mode === "study";

  // Pre-selected config from /practice (subject, count, timer, year)
  const urlSubject = searchParams.get("subject") ?? "English Language";
  const urlCount = Math.max(1, Math.min(Number(searchParams.get("count") ?? 40), 180));
  const urlTimer = searchParams.get("timer") ?? "Recommended timer";
  const urlYear = searchParams.get("year") ?? "All years";

  // ── Lobby state (exam never auto-starts) ──
  const [started, setStarted] = useState(false);

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(["English Language", "Biology", "Chemistry", "Physics"]);
  const [selectedSubject, setSelectedSubject] = useState(urlSubject);
  const questionCache = useRef<Map<string, ExamQuestion[]>>(new Map());
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loadingQ, setLoadingQ] = useState(false);
  const [qError, setQError] = useState("");

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

  // Inline review state (replaces navigation to /results for practice/study modes)
  const [reviewEntries, setReviewEntries] = useState<ReviewEntry[] | null>(null);
  const [reviewScore, setReviewScore] = useState(0);

  const q = questions[currentQuestion % Math.max(questions.length, 1)];
  const answeredCount = Object.keys(answers).length;
  const isRevealed = isStudyMode && revealedInStudy.has(currentQuestion);

  // Restore saved subjects
  useEffect(() => {
    try {
      const s = localStorage.getItem("orbit_prefs");
      if (s) {
        const p = JSON.parse(s) as { subjects?: string[] };
        if (Array.isArray(p.subjects) && p.subjects.length === 4) startTransition(() => setSelectedSubjects(p.subjects!));
      }
    } catch (_e) { /* ignore */ }
  }, []);

  // Load questions from ALOC — only AFTER the user presses Start
  useEffect(() => {
    if (!started || authLoading) return;
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
          setQError(res.error ?? "Could not load questions. Check your connection and try again.");
        }
      })
      .catch(() => { if (mounted) setQError("Network error — please try again."); })
      .finally(() => { if (mounted) setLoadingQ(false); });
    return () => { mounted = false; };
  }, [selectedSubject, started, authLoading]);

  // Create attempt on first real question load
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

  // ── Lobby UI ────────────────────────────────────────────────────────────────
  if (!started && !reviewEntries) {
    return (
      <AppShell title={isStudyMode ? "Study Mode" : "Mock Exam"} back="/practice">
        <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-3xl lg:px-6">
          <div className="mb-5 rounded-[28px] bg-gradient-to-br from-violet-600 to-violet-500 p-6 text-white shadow-xl shadow-violet-300/25">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-100">
              {isStudyMode ? "Study mode — answers shown as you go" : "Full exam simulation"}
            </p>
            <h1 className="mt-2 text-3xl font-black">Ready to begin?</h1>
            <p className="mt-2 text-sm text-violet-100">
              {isStudyMode
                ? "Answer at your own pace and see the correct answer immediately after each question."
                : "Answer the questions, flag the ones you want to revisit, and submit before time runs out."}
            </p>
          </div>

          <div className="mb-5 rounded-[24px] bg-white p-5 ring-1 ring-slate-200">
            <h2 className="mb-4 text-base font-black text-slate-900">Session settings</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Subject</span>
                <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-500">
                  {ALL_SUBJECTS.map((s) => <option key={s.name}>{s.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Questions</span>
                <select value={questionTotal} onChange={(e) => setQuestionTotal(Number(e.target.value))}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-500">
                  {[10, 20, 40, 60].map((n) => <option key={n} value={n}>{n} questions</option>)}
                </select>
              </label>
              {!isStudyMode && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Timer</span>
                  <select value={urlTimer} disabled
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500 outline-none">
                    <option>{urlTimer}</option>
                  </select>
                </label>
              )}
              <div className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Year</span>
                <p className="flex h-12 items-center rounded-xl bg-slate-50 px-3 text-sm font-semibold text-slate-500">
                  {urlYear}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              {isStudyMode
                ? "Change subject or length here — questions load when you start."
                : "Subject and length are locked once the exam starts. Set them now."}
            </p>
          </div>

          <button type="button" onClick={() => {
            setStarted(true);
            if (!isStudyMode && urlTimer !== "No timer") {
              const mins = urlTimer === "1 hour" ? 60 : urlTimer === "30 minutes" ? 30 : 15;
              setTimeLeft(mins * 60);
            }
          }}
            disabled={loadingQ}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 text-base font-black text-white shadow-lg shadow-violet-300/30 transition hover:bg-violet-700">
            <Play className="h-5 w-5" aria-hidden />
            {loadingQ ? "Preparing questions…" : "Start now"}
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

    // Build review entries from all questions answered so far
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
              subject_name: selectedSubject,
            },
          }));
        await saveAnswers(supabase, attemptIdRef.current, rows);
        await submitAttempt(supabase, attemptIdRef.current, correct);
        await updateStreak(supabase, user.id);
      }
    } catch (_e) { /* ignore DB errors, still show review */ }

    // For exam mode: navigate to /results. For study/practice: show inline review.
    if (mode === "exam" && !isStudyMode) {
      router.push(
        `/results?score=${correct}&total=${questionTotal}&subject=${encodeURIComponent(selectedSubject)}&answered=${answeredCount}&wrong=${Math.max(answeredCount - correct, 0)}${attemptIdRef.current ? `&attemptId=${attemptIdRef.current}` : ""}`,
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
    // In study mode, reveal immediately after choosing
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

  // ── Show inline review after submission ──────────────────────────────────
  if (reviewEntries) {
    return (
      <InlineReview
        entries={reviewEntries}
        score={reviewScore}
        total={questionTotal}
        subject={selectedSubject}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <AppShell hideTopBar>
      <main className="px-2 py-4 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              {isStudyMode ? "Study mode — answers shown immediately" : "Full exam simulation"}
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{selectedSubject}</h1>
          </div>
          <div className="flex items-center gap-2">
            {isStudyMode && (
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-200">Study</span>
            )}
            {qError && <span className="hidden rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 sm:inline-flex">Sample Qs</span>}
            <div className={`rounded-full px-3 py-1 text-sm font-bold ring-1 ${isStudyMode ? "bg-violet-50 text-violet-700 ring-violet-100" : "bg-emerald-50 text-emerald-700 ring-emerald-100"}`}>{fmt}</div>
          </div>
        </header>

        {qError && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
            <p className="text-sm font-semibold text-amber-800">{qError}</p>
            <button type="button" onClick={() => { questionCache.current.delete(selectedSubject); setStarted(false); }}
              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white">Back to setup</button>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.7fr_0.7fr]">
          <section className="rounded-[28px] bg-white p-5 ring-1 ring-slate-200 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${isStudyMode ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"}`}>{currentQuestion + 1}</span>
                <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Q {currentQuestion + 1} / {questionTotal}{loadingQ ? " · Loading…" : ""}
                </span>
              </div>
              {/* Meta chips: year + topic/section (esp. study mode) */}
              <div className="flex items-center gap-2">
                {q?.year && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{q.year}</span>
                )}
                {!isStudyMode && (
                  <button type="button" onClick={() => setShowCalc((v) => !v)} aria-label="Toggle calculator"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">
                    <Calculator className="h-3.5 w-3.5" aria-hidden /> Calc
                  </button>
                )}
              </div>
            </div>

            {/* Passage + image */}
            {q && <QuestionMedia question={q} />}

            <div className={`rounded-[24px] p-5 ring-1 ${isStudyMode ? "bg-violet-50 ring-violet-100" : "bg-slate-50 ring-slate-200"}`}>
              <p className="text-lg leading-8 text-slate-800">{q?.prompt ?? (loadingQ ? "Loading question…" : "")}</p>
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

            {/* Study mode explanation block */}
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
            {/* Progress + navigator — no subject switching mid-exam */}
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
                    btn = answers[i] === questions[i % questions.length]?.answer ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";
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
