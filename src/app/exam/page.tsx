"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { startTransition, Suspense, useEffect, useRef, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { createAttempt, saveAnswers, submitAttempt, updateStreak } from "@/lib/queries";
import { ALOC_SUBJECTS } from "@/lib/aloc";
import AppShell from "@/components/AppShell";
import RichText from "@/components/RichText";
import { novelMatches } from "@/lib/aloc";
import {
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Layers,
  LayoutGrid,
  Play,
  XCircle,
} from "lucide-react";

const ENGLISH = "English Language";
const NEEDS_CALCULATOR = new Set(["Mathematics", "Physics", "Chemistry", "Economics", "Accounting", "Commerce", "Insurance"]);
const OTHER_SUBJECTS = ALOC_SUBJECTS.filter((s) => s.name !== ENGLISH).map((s) => s.name);

const ENGLISH_COUNT = 60;
const OTHER_COUNT = 40;

const EXAM_YEARS = [
  "random", "2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019",
  "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010",
  "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001",
  "2000", "1999", "1998", "1997", "1996", "1995", "1994", "1993", "1992",
  "1991", "1990", "1989", "1988", "1987", "1986", "1985",
];

type ExamQuestion = {
  id: string;
  prompt: string;
  promptSegments?: import("@/components/RichText").Segment[] | null;
  options: string[];
  optionSegments?: (import("@/components/RichText").Segment[] | null)[];
  answer: number;
  explanation: string | null;
  image?: string | null;
  section?: string | null;
  sectionKind?: "passage" | "instruction" | null;
  /** Questions that share a comprehension/cloze passage share this id */
  passageId?: string | null;
  novel?: string | null;
  examtype?: string | null;
  year?: string | null;
  subject?: string | null;
};

const FALLBACK: ExamQuestion[] = [
  { id: "f1", prompt: "Which statement best explains consensus?", options: ["Immediate agreement", "Failure to agree", "A postponed discussion", "Approval without debate"], answer: 0, explanation: null },
  { id: "f2", prompt: "If 2x + 6 = 18, what is the value of x?", options: ["3", "6", "9", "12"], answer: 1, explanation: "2x = 12, so x = 6." },
  { id: "f3", prompt: "What is the SI unit of electric current?", options: ["Volt", "Ohm", "Ampere", "Watt"], answer: 2, explanation: "Ampere (A) is the SI unit." },
  { id: "f4", prompt: "Which compound is an alkane?", options: ["C2H4", "C2H2", "C2H6", "C6H6"], answer: 2, explanation: "Alkanes: CnH2n+2. C2H6 = ethane." },
  { id: "f5", prompt: "Photosynthesis in green plants produces:", options: ["CO2 and water", "Glucose and oxygen", "Starch and CO2", "Oxygen only"], answer: 1, explanation: null },
];

function calcExpr(input: string): string | number {
  const tokens = input.match(/\d+(?:\.\d+)?|[+\-*/]/g);
  if (!tokens) return "-";
  if (tokens.join("") !== input.replace(/\s/g, "")) return "-";
  if (tokens.length === 0 || /[+\-*/]/.test(tokens[0]) || /[+\-*/]/.test(tokens[tokens.length - 1])) return "-";

  const numsAndOps: (string | number)[] = tokens.map((t) => (/[+\-*/]/.test(t) ? t : Number(t)));

  const highPrecedence: (string | number)[] = [numsAndOps[0]];
  for (let i = 1; i < numsAndOps.length; i += 2) {
    const op = numsAndOps[i];
    const next = numsAndOps[i + 1];
    if (typeof next !== "number" || Number.isNaN(next)) return "-";
    if (op === "*" || op === "/") {
      const prev = highPrecedence.pop();
      if (typeof prev !== "number") return "-";
      if (op === "/" && next === 0) return "-";
      highPrecedence.push(op === "*" ? prev * next : prev / next);
    } else {
      highPrecedence.push(op, next);
    }
  }

  let result = highPrecedence[0];
  if (typeof result !== "number") return "-";
  for (let i = 1; i < highPrecedence.length; i += 2) {
    const op = highPrecedence[i];
    const next = highPrecedence[i + 1];
    if (typeof next !== "number") return "-";
    result = op === "+" ? result + next : result - next;
  }

  return Number.isFinite(result) ? Math.round(result * 1e10) / 1e10 : "-";
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
    <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-50 w-72 max-w-[calc(100vw-2rem)] rounded-[28px] bg-slate-900 p-4 text-white shadow-2xl shadow-slate-900/40 lg:bottom-6">
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

function QuestionMedia({ question, hidePassage = false }: { question: ExamQuestion; hidePassage?: boolean }) {
  const isPassage = question.sectionKind === "passage";
  return (
    <>
      {question.section && !(hidePassage && isPassage) && (
        <div className={`mb-4 overflow-y-auto whitespace-pre-line rounded-[20px] p-4 ring-1 ${
          isPassage ? "max-h-[480px] bg-amber-50 ring-amber-100" : "max-h-40 bg-slate-50 ring-slate-200"
        }`}>
          <p className={`mb-2 text-[10px] font-black uppercase tracking-[0.18em] ${
            isPassage ? "text-amber-700" : "text-slate-400"
          }`}>
            {isPassage ? "Passage — read carefully" : "Instruction"}
          </p>
          <p className={`leading-7 text-slate-800 ${isPassage ? "text-[15px]" : "text-sm font-medium text-slate-600"}`}>
            {question.section}
          </p>
        </div>
      )}
      {question.image && (
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

type PassageInfo = { number: number; total: number; firstNo: number; lastNo: number };

/**
 * Where the current question's passage sits inside its subject paper:
 * "Passage 1 of 2 · questions 1-8", using the per-subject numbering.
 */
function getPassageInfo(list: ExamQuestion[], index: number, start: number, end: number): PassageInfo | null {
  const cur = list[index];
  if (!cur?.passageId || cur.sectionKind !== "passage") return null;
  let s = index;
  let e = index;
  while (s > start && list[s - 1]?.passageId === cur.passageId) s--;
  while (e < end - 1 && list[e + 1]?.passageId === cur.passageId) e++;
  const ids: string[] = [];
  for (let i = start; i < end; i++) {
    const id = list[i]?.passageId;
    if (id && !ids.includes(id)) ids.push(id);
  }
  return { number: ids.indexOf(cur.passageId) + 1, total: ids.length, firstNo: s - start + 1, lastNo: e - start + 1 };
}

/**
 * JAMB-style reading panel. Side-by-side with the question on large screens
 * (sticky, scrolls on its own); stacked and collapsible on phones.
 */
function PassagePanel({
  text,
  info,
  hidden,
  onToggle,
}: {
  text: string;
  info: PassageInfo;
  hidden: boolean;
  onToggle: () => void;
}) {
  const range = info.firstNo === info.lastNo ? `question ${info.firstNo}` : `questions ${info.firstNo} to ${info.lastNo}`;
  return (
    <div className="mb-4 overflow-hidden rounded-[20px] bg-amber-50 ring-1 ring-amber-100 lg:sticky lg:top-28 lg:mb-0">
      <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
            Passage {info.number}{info.total > 1 ? ` of ${info.total}` : ""}
          </p>
          <p className="mt-0.5 text-xs font-semibold leading-5 text-amber-900">
            Read the following passage carefully and answer {range}.
          </p>
        </div>
        <button type="button" onClick={onToggle} aria-expanded={!hidden}
          className="shrink-0 touch-manipulation rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200 lg:hidden">
          {hidden ? "Show" : "Hide"}
        </button>
      </div>
      <div className={`${hidden ? "hidden lg:block" : ""} max-h-[38dvh] overflow-y-auto overscroll-contain px-4 pb-4 lg:max-h-[calc(100dvh-16rem)]`}>
        <p className="whitespace-pre-line text-[15px] leading-7 text-slate-800">{text}</p>
      </div>
    </div>
  );
}

type ReviewEntry = { question: ExamQuestion; selectedIdx: number | null; questionIdx: number };

type SubjectTab = { name: string; start: number };

/**
 * TestDriller-style numbering. Questions live in one flat list (so saving,
 * scoring and review keep working untouched), but every subject is shown to
 * the student as its own paper: English 1-60, each other subject 1-40.
 * Given a flat index, this returns where it sits inside its own subject.
 */
function locateInSubject(tabs: SubjectTab[], index: number, total: number) {
  if (tabs.length === 0) return { tabIdx: 0, start: 0, end: total, number: index + 1, count: total };
  let tabIdx = 0;
  for (let t = 0; t < tabs.length; t++) if (index >= tabs[t].start) tabIdx = t;
  const start = tabs[tabIdx].start;
  const end = tabIdx + 1 < tabs.length ? tabs[tabIdx + 1].start : total;
  return { tabIdx, start, end, number: index - start + 1, count: end - start };
}

function InlineReview({
  entries,
  score,
  total,
  subject,
  onRetry,
  tabs = [],
}: {
  entries: ReviewEntry[];
  score: number;
  total: number;
  subject: string;
  onRetry: () => void;
  /** Subject boundaries — lets the review number each subject 1..N like the exam did */
  tabs?: SubjectTab[];
}) {
  const [filter, setFilter] = useState<"all" | "wrong" | "correct">("all");
  const [subjectFilter, setSubjectFilter] = useState<number | "all">("all");
  const subjectSummaries = tabs.length > 1
    ? tabs.map((tab, ti) => {
        const end = ti + 1 < tabs.length ? tabs[ti + 1].start : total;
        const slice = entries.filter((e) => e.questionIdx >= tab.start && e.questionIdx < end);
        return {
          name: tab.name,
          tabIdx: ti,
          total: slice.length,
          correct: slice.filter((e) => e.selectedIdx === e.question.answer).length,
        };
      })
    : [];
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const practiceScore = Math.round((score / total) * 400);

  const visible = entries.filter((e) => {
    if (subjectFilter !== "all" && locateInSubject(tabs, e.questionIdx, total).tabIdx !== subjectFilter) return false;
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

        {subjectSummaries.length > 0 && (
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            <button type="button" onClick={() => setSubjectFilter("all")}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${subjectFilter === "all" ? "bg-violet-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"}`}>
              All subjects
            </button>
            {subjectSummaries.map((s) => (
              <button key={s.name} type="button" onClick={() => setSubjectFilter(s.tabIdx)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${subjectFilter === s.tabIdx ? "bg-violet-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"}`}>
                {s.name.replace(" Language", "")} · {s.correct}/{s.total}
              </button>
            ))}
          </div>
        )}

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
                    Q{locateInSubject(tabs, questionIdx, total).number} · {isCorrect ? "Correct" : isSkipped ? "Skipped" : "Wrong"}
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
                        <RichText segments={q.optionSegments?.[idx]} fallback={opt} />
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

type SubjectPlan = { name: string; count: number };

function ExamPageContent() {
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useUser();

  const rawMode = searchParams.get("mode");
  const mode = rawMode === "study" ? "study" : rawMode === "practice" ? "practice" : "exam";
  const isStudyMode = mode === "study";
  const isPracticeMode = mode === "practice";
  const isExamMode = mode === "exam";
  const revealEnabled = isStudyMode || isPracticeMode;

  const urlSubject = searchParams.get("subject") ?? ENGLISH;
  const urlCount = Math.max(1, Math.min(Number(searchParams.get("count") ?? 40), 60));
  const urlTimer = searchParams.get("timer") ?? "Recommended timer";
  const urlYear = searchParams.get("year") ?? "All years";
  // Novel study: only questions drawn from this set text
  const urlNovel = searchParams.get("novel") ?? "";
  // Standalone setup page this session was launched from (Learn hub modes)
  const setupHref = urlNovel ? "/practice/novel" : isPracticeMode ? "/practice/past-questions" : isStudyMode ? "/practice/study" : "/practice";

  const [started, setStarted] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState("");

  // Arriving from a standalone setup page (subject/count/year already chosen)?
  // Then show a compact confirmation instead of asking for everything again.
  const urlHasSetup = Boolean(searchParams.get("subject") && searchParams.get("count")) || Boolean(urlNovel);
  const [showFullSetup, setShowFullSetup] = useState(!urlHasSetup || isExamMode);

  const [plan, setPlan] = useState<string[]>([ENGLISH, "Biology", "Chemistry", "Physics"]);
  // Honour the year chosen on the setup page instead of asking again
  const [examYear, setExamYear] = useState(urlYear !== "All years" ? urlYear : "random");

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
  const [calcManuallySet, setCalcManuallySet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [passageHidden, setPassageHidden] = useState<Record<string, boolean>>({});
  const attemptIdRef = useRef<string | null>(null);

  const [reviewEntries, setReviewEntries] = useState<ReviewEntry[] | null>(null);
  const [reviewScore, setReviewScore] = useState(0);

  const q = questions[currentQuestion];
  // Position inside the current subject (drives the 1-60 / 1-40 numbering)
  const pos = locateInSubject(subjectTabs, currentQuestion, questionTotal);
  const multiSubject = subjectTabs.length > 1;
  const passageInfo = getPassageInfo(questions, currentQuestion, pos.start, pos.end);
  const isLastOfSubject = currentQuestion === pos.end - 1;
  const nextSubjectName = multiSubject && pos.tabIdx + 1 < subjectTabs.length ? subjectTabs[pos.tabIdx + 1].name : null;
  const activeSubjectName = q?.subject ?? (isExamMode ? null : studySubject);
  const answeredCount = Object.keys(answers).length;
  const unansweredTotal = Math.max(0, questionTotal - answeredCount);
  const subjectUnanswered = multiSubject
    ? subjectTabs
        .map((tab, ti) => {
          const end = ti + 1 < subjectTabs.length ? subjectTabs[ti + 1].start : questionTotal;
          let done = 0;
          for (let i = tab.start; i < end; i++) if (answers[i] !== undefined) done++;
          return { name: tab.name, left: end - tab.start - done };
        })
        .filter((x) => x.left > 0)
    : [];
  const subjectAnsweredCount = Object.keys(answers).filter((k) => Number(k) >= pos.start && Number(k) < pos.end).length;

  useEffect(() => {
    if (calcManuallySet) return;
    if (!started || !activeSubjectName) return;
    setShowCalc(NEEDS_CALCULATOR.has(activeSubjectName));
  }, [activeSubjectName, started, calcManuallySet]);
  const isRevealed = revealEnabled && revealedInStudy.has(currentQuestion);

  // Phones/tablets: whenever the question changes, bring its top into view.
  useEffect(() => {
    if (!started || typeof window === "undefined" || window.innerWidth >= 1280) return;
    document.getElementById("exam-question")?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [currentQuestion, started]);

  const planTotal = ENGLISH_COUNT + OTHER_COUNT * 3;
  const autoMinutes = Math.max(15, Math.round((planTotal * 2) / 3));

  useEffect(() => {
    try {
      const s = localStorage.getItem("orbit_prefs");
      if (s) {
        const p = JSON.parse(s) as { subjects?: string[] };
        if (Array.isArray(p.subjects) && p.subjects.length === 4) {
          const others = p.subjects.filter((n) => n !== ENGLISH).slice(0, 3);
          while (others.length < 3) others.push("Biology");
          setPlan([ENGLISH, others[0], others[1], others[2]]);
        }
      }
    } catch (_e) {  }
  }, []);

  async function startSession() {
    setPreparing(true);
    setPrepareError("");
    try {
      const entries: SubjectPlan[] = isExamMode
        ? plan.map((name, i) => ({ name, count: i === 0 ? ENGLISH_COUNT : OTHER_COUNT }))
        : [{ name: studySubject, count: studyCount }];
      const yearParam = examYear !== "random" ? `&year=${encodeURIComponent(examYear)}` : "";

      async function fetchPool(name: string, want: number): Promise<ExamQuestion[]> {
        const cacheKey = examYear === "random" ? name : `${name}:${examYear}`;
        const cached = questionCache.current.get(cacheKey);
        const batches: ExamQuestion[][] = [];
        if (cached) {
          batches.push(cached);
        } else {
          const first = await fetch(`/api/aloc?endpoint=questions&subject=${encodeURIComponent(name)}&type=utme${yearParam}`)
            .then((r) => r.json())
            .then((res: { ok: boolean; data?: ExamQuestion[]; error?: string }) => {
              if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
                questionCache.current.set(cacheKey, res.data);
                return res.data;
              }
              throw new Error(res.error ?? `No questions for ${name}${examYear !== "random" ? ` (${examYear})` : ""}`);
            });
          batches.push(first);
        }

        const seen = new Set(batches[0].map((q) => String(q.id)));
        let round = 1;
        while (seen.size < want && round < 3) {
          const more = await fetch(`/api/aloc?endpoint=questions&subject=${encodeURIComponent(name)}&type=utme${yearParam}&t=${Date.now()}-${round}`)
            .then((r) => r.json())
            .then((res: { ok: boolean; data?: ExamQuestion[] }) =>
              (res.ok && Array.isArray(res.data) ? res.data : []) as ExamQuestion[],
            )
            .catch(() => [] as ExamQuestion[]);
          if (more.length === 0) break;
          let added = 0;
          for (const qn of more) {
            const id = String(qn.id);
            if (!seen.has(id)) {
              seen.add(id);
              batches.push([qn]);
              added += 1;
            }
            if (seen.size >= want) break;
          }
          if (added === 0) break;
          round += 1;
        }
        return batches.flat();
      }

      // English in Mock/Exam mode: a JAMB-style paper (whole comprehension/cloze passages,
      // 5-9 set-text questions, lexis, oral) assembled server-side. Any failure falls
      // back to the plain random pool below, so an exam always starts.
      async function fetchEnglishPaper(): Promise<ExamQuestion[]> {
        const res = (await fetch(`/api/aloc?endpoint=english-paper&type=utme${yearParam}&t=${Date.now()}`).then((r) => r.json())) as {
          ok: boolean;
          data?: ExamQuestion[];
          error?: string;
        };
        if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) throw new Error(res.error ?? "english-paper unavailable");
        return res.data;
      }

      const perSubject = await Promise.all(
        entries.map(async ({ name, count }) => {
          if (isExamMode && !urlNovel && name === ENGLISH) {
            try {
              const paper = await fetchEnglishPaper();
              return paper.slice(0, count).map((qn) => ({ ...qn, subject: name }));
            } catch (paperErr) {
              console.warn("English paper assembly failed, using random pool:", paperErr);
            }
          }
          let pool = await fetchPool(name, count * 2);
          // Novel mode: keep only questions drawn from the selected set text
          if (urlNovel) {
            pool = pool.filter((qn) => novelMatches(qn.novel, urlNovel));
          }
          return pool.slice(0, count).map((qn) => ({ ...qn, subject: name }));
        }),
      );

      const combined = perSubject.flat();
      if (combined.length === 0) {
        throw new Error(
          urlNovel
            ? `No questions found for "${urlNovel}" in this pool yet. Try another year.`
            : "Could not load any questions. Check your connection.",
        );
      }

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
          isExamMode
            ? entries.length > 1
              ? `Mock exam · ${entries.map((e) => e.name.replace(" Language", "")).join(" + ")}`
              : entries[0].name
            : studySubject,
        );
        if (isExamMode) {
          const totalQ = combined.length;
          const mins = urlTimer === "1 hour" ? 60 : urlTimer === "30 minutes" ? 30 : urlTimer === "15 minutes" ? 15 : Math.max(15, Math.round((totalQ * 2) / 3));
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

  useEffect(() => {
    if (!user || !started || questions.length === 0 || attemptIdRef.current) return;
    try {
      const supabase = createSupabaseBrowserClient();
      createAttempt(supabase, user.id, null, questionTotal).then((a) => { if (a) attemptIdRef.current = a.id; });
    } catch {  }
  }, [user, started, questions, questionTotal]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const id = window.setInterval(() => setTimeLeft((v) => (v === null ? null : v - 1)), 1000);
    return () => clearInterval(id);
  }, [timeLeft]);

  useEffect(() => {
    if (timeLeft === 0 && !submitting) void doSubmit();
  }, [timeLeft]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef2ff]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  if (!started && !reviewEntries) {
    if (!user) {
      return (
        <AppShell title={isStudyMode ? "Study Mode" : "Mock Exam"} back={setupHref}>
          <div className="mx-auto max-w-md px-4 py-16">
            <div className="rounded-[28px] bg-white p-8 text-center ring-1 ring-slate-200 shadow-lg">
              <h2 className="text-xl font-black text-slate-900">Sign in to start</h2>
              <p className="mt-2 text-sm text-slate-500">Mock exams save your score, streak, and correction history — sign in to begin.</p>
              <Link href={`/?next=${encodeURIComponent(`/exam?mode=${mode}${urlSubject ? `&subject=${encodeURIComponent(urlSubject)}` : ""}${urlNovel ? `&novel=${encodeURIComponent(urlNovel)}` : ""}`)}`} className="mt-6 flex h-11 items-center justify-center rounded-2xl bg-violet-600 text-sm font-bold text-white hover:bg-violet-700">
                Sign in
              </Link>
            </div>
          </div>
        </AppShell>
      );
    }
    return (
      <AppShell title={urlNovel ? "Novel Study" : isStudyMode ? "Study Mode" : "Mock Exam"} back={setupHref}>
        <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-3xl lg:px-6">
          <div className="mb-5 rounded-[28px] bg-gradient-to-br from-violet-600 to-violet-500 p-6 text-white shadow-xl shadow-violet-300/25">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-100">
              {isStudyMode ? "Study mode · answers shown as you go" : isPracticeMode ? "Practice · answers shown as you go" : "JAMB standard · 4 subjects"}
            </p>
            <h1 className="mt-2 text-3xl font-black">{urlNovel ? urlNovel : "Ready to begin?"}</h1>
            <p className="mt-2 text-sm text-violet-100">
              {isExamMode
                ? "Use of English is compulsory. Choose your three other subjects and the year you want to practise."
                : "Answer at your own pace — the correct answer and explanation appear right after each question."}
            </p>
          </div>

          {!isExamMode && !showFullSetup ? (
            <div className="mb-5 rounded-[24px] bg-white p-5 ring-1 ring-slate-200">
              <h2 className="mb-4 text-base font-black text-slate-900">Your session is ready</h2>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{urlNovel ? "Novel" : "Subject"}</p>
                  <p className="mt-0.5 font-black text-slate-900">{urlNovel || studySubject}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Questions</p>
                  <p className="mt-0.5 font-black text-slate-900">{studyCount}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Year</p>
                  <p className="mt-0.5 font-black text-slate-900">{examYear === "random" ? "Random mix" : examYear}</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowFullSetup(true)}
                className="mt-3 text-sm font-bold text-violet-600 hover:underline">
                Adjust settings
              </button>
            </div>
          ) : !isExamMode ? (
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
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Past questions year</span>
                  <select value={examYear} onChange={(e) => setExamYear(e.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-500">
                    <option value="random">Random mix — all years</option>
                    {EXAM_YEARS.filter((y) => y !== "random").map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
              </div>
            </div>
          ) : (
            <div className="mb-5 rounded-[24px] bg-white p-5 ring-1 ring-slate-200">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-black text-slate-900">Your four subjects</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-100">
                  <Layers className="h-3.5 w-3.5" aria-hidden /> {planTotal} questions · JAMB standard
                </span>
              </div>

              <div className="mb-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-xs font-black text-white">EN</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900">{ENGLISH}</p>
                    <p className="text-[11px] font-semibold text-violet-600">Compulsory · {ENGLISH_COUNT} questions</p>
                  </div>
                </div>
              </div>

              {[1, 2, 3].map((slot) => (
                <div key={slot} className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-500">{slot + 1}</span>
                  <select
                    value={plan[slot]}
                    onChange={(e) => setPlan((p) => p.map((n, i) => (i === slot ? e.target.value : n)))}
                    className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-sm font-bold text-slate-800 outline-none focus:border-violet-500"
                    aria-label={`Subject ${slot + 1}`}
                  >
                    {OTHER_SUBJECTS.map((n) => (
                      <option key={n} value={n} disabled={plan.some((row, i) => i > 0 && i !== slot && row === n)}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">{OTHER_COUNT} Qs</span>
                </div>
              ))}

              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Past questions year</span>
                <select value={examYear} onChange={(e) => setExamYear(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-violet-500">
                  <option value="random">Random mix — all years</option>
                  {EXAM_YEARS.filter((y) => y !== "random").map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>

              <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
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
          <Link href={setupHref} className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700">
            Change session setup
          </Link>
        </div>
      </AppShell>
    );
  }

  async function doSubmit() {
    if (submitting) return;
    setConfirmOpen(false);
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
              prompt_segments: e.question.promptSegments ?? undefined,
              options: e.question.options,
              option_segments: e.question.optionSegments ?? undefined,
              section: e.question.section ?? undefined,
              section_kind: e.question.sectionKind ?? undefined,
              image: e.question.image ?? undefined,
              novel: e.question.novel ?? undefined,
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
    } catch (_e) {  }

    setReviewScore(correct);
    setReviewEntries(entries);
    setSubmitting(false);
  }

  // Ask before submitting (like the real JAMB CBT) — the timer running out
  // still calls doSubmit() directly, so time-up is never blocked by the dialog.
  function requestSubmit() {
    if (submitting) return;
    if (isExamMode || unansweredTotal > 0) setConfirmOpen(true);
    else void doSubmit();
  }

  function handleRetry() {
    setReviewEntries(null);
    setAnswers({});
    setMarked(new Set());
    setSkipped(new Set());
    setRevealedInStudy(new Set());
    setCurrentQuestion(0);
    setSubmitting(false);
    setCalcManuallySet(false);
    attemptIdRef.current = null;
    setStarted(false);
  }

  function chooseAnswer(idx: number) {
    setAnswers((p) => ({ ...p, [currentQuestion]: idx }));
    setSkipped((p) => { const n = new Set(p); n.delete(currentQuestion); return n; });
    if (revealEnabled) {
      setRevealedInStudy((p) => new Set(p).add(currentQuestion));
    }
  }
  function moveNext() {
    if (isExamMode && answers[currentQuestion] === undefined) setSkipped((p) => new Set(p).add(currentQuestion));
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
        tabs={subjectTabs}
      />
    );
  }

  return (
    <AppShell hideTopBar hideBottomNav>
      <main className="px-2 py-4 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-7xl"
        style={{ paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 mb-3 rounded-[20px] border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur sm:mb-4 sm:rounded-[24px] sm:p-4 xl:static">
          <div className="flex items-center justify-between gap-2 sm:flex-wrap sm:gap-3">
            <div className="min-w-0">
            <p className="hidden text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700 sm:block">
              {isStudyMode ? "Study mode — answers shown immediately" : isPracticeMode ? "Practice — answers shown as you go" : "JAMB standard simulation"}
            </p>
              <h1 className="truncate text-base font-black tracking-tight text-slate-900 sm:mt-1 sm:text-xl">{sessionLabel}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {q?.year && <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 sm:inline">{q.year}</span>}
              <button type="button" onClick={() => { setShowCalc((v) => !v); setCalcManuallySet(true); }} aria-label="Toggle calculator"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">
                <Calculator className="h-3.5 w-3.5" aria-hidden /> Calc
              </button>
              <div className={`rounded-full px-3 py-1 text-sm font-bold tabular-nums ring-1 ${isStudyMode ? "bg-violet-50 text-violet-700 ring-violet-100" : "bg-emerald-50 text-emerald-700 ring-emerald-100"}`}>{fmt}</div>
            </div>
          </div>

          {subjectTabs.length > 1 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 sm:mt-3">
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

        <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.7fr_0.7fr]">
          <section id="exam-question" className="scroll-mt-28 rounded-[28px] bg-white p-4 ring-1 ring-slate-200 sm:p-6">
            <div className="mb-4 flex items-center justify-between sm:mb-5">
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${isStudyMode ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"}`}>{pos.number}</span>
                <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Q {pos.number} / {pos.count}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-1.5">
                {q?.year && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 sm:hidden">{q.year}</span>}
                {q?.subject && (
                  <span className="truncate rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-100">
                    {q.subject}
                  </span>
                )}
              </div>
            </div>

            <div className={passageInfo ? "lg:grid lg:grid-cols-2 lg:items-start lg:gap-6" : ""}>
            {q && passageInfo && q.section && (
              <PassagePanel
                text={q.section}
                info={passageInfo}
                hidden={!!(q.passageId && passageHidden[q.passageId])}
                onToggle={() => q.passageId && setPassageHidden((m) => ({ ...m, [q.passageId as string]: !m[q.passageId as string] }))}
              />
            )}
            <div className="min-w-0">
            {q && <QuestionMedia question={q} hidePassage={!!passageInfo} />}

            <div className={`rounded-[24px] p-4 ring-1 sm:p-5 ${isStudyMode ? "bg-violet-50 ring-violet-100" : "bg-slate-50 ring-slate-200"}`}>
              <p className="text-base leading-7 text-slate-800 sm:text-lg sm:leading-8">
                <RichText segments={q?.promptSegments} fallback={q?.prompt ?? ""} />
              </p>
            </div>

            <div className="mt-4 grid gap-2.5 sm:mt-6 sm:gap-3">
              {(q?.options ?? []).map((opt, idx) => {
                const isSelected = answers[currentQuestion] === idx;
                const isCorrectOpt = idx === q?.answer;
                const showResult = revealEnabled && isRevealed;

                let cls = "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50";
                if (showResult && isCorrectOpt) cls = "border-emerald-500 bg-emerald-50 text-emerald-900";
                else if (showResult && isSelected && !isCorrectOpt) cls = "border-rose-400 bg-rose-50 text-rose-800";
                else if (!showResult && isSelected) cls = "border-emerald-500 bg-emerald-50 text-emerald-900";

                return (
                  <button key={`${q?.id}-${idx}`} type="button"
                    onClick={() => !isRevealed && chooseAnswer(idx)}
                    disabled={revealEnabled && isRevealed}
                    className={`flex touch-manipulation items-center rounded-2xl border p-3 text-left text-sm font-medium transition sm:p-4 ${cls}`}>
                    <span className={`mr-3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold
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

            {revealEnabled && isRevealed && q?.explanation && (
              <div className="mt-5 rounded-[20px] bg-emerald-50 p-4 ring-1 ring-emerald-200">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Explanation</p>
                <p className="mt-2 text-sm leading-6 text-emerald-900">{q.explanation}</p>
              </div>
            )}
            {revealEnabled && isRevealed && !q?.explanation && (
              <p className="mt-4 text-xs text-slate-400">No explanation available for this question.</p>
            )}

            </div>
            </div>

            <div className="sticky bottom-0 z-30 -mx-4 -mb-4 mt-5 flex items-center justify-between gap-2 rounded-b-[28px] border-t border-slate-100 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6 xl:static xl:z-auto xl:mx-0 xl:mb-0 xl:mt-6 xl:flex-wrap xl:gap-3 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:backdrop-blur-none">
              <div className="flex shrink-0 gap-2 sm:gap-3">
                <button type="button" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion((v) => v - 1)}
                  aria-label="Previous question"
                  className="inline-flex touch-manipulation items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40 sm:px-4 sm:py-2">
                  <ChevronLeft className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Prev</span>
                </button>
                {!isStudyMode && (
                  <button type="button" onClick={toggleMark}
                    aria-label={marked.has(currentQuestion) ? "Unmark question" : "Mark question for review"}
                    className={`inline-flex touch-manipulation items-center gap-1 rounded-2xl border px-3 py-2.5 text-sm font-semibold sm:px-4 sm:py-2 ${marked.has(currentQuestion) ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-700"}`}>
                    <Flag className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden sm:inline">{marked.has(currentQuestion) ? "Marked" : "Mark"}</span>
                  </button>
                )}
                <button type="button" aria-label="Open question navigator"
                  onClick={() => document.getElementById("exam-navigator")?.scrollIntoView({ block: "start", behavior: "smooth" })}
                  className="inline-flex touch-manipulation items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 sm:px-4 sm:py-2 xl:hidden">
                  <LayoutGrid className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Questions</span>
                </button>
              </div>
              <button type="button" onClick={moveNext} disabled={currentQuestion === questionTotal - 1}
                className={`inline-flex min-w-0 touch-manipulation items-center justify-center gap-1 rounded-2xl px-4 py-3 text-sm font-bold text-white disabled:opacity-40 sm:px-6 ${revealEnabled ? "bg-violet-600 hover:bg-violet-700" : "bg-emerald-700"}`}>
                <span className="truncate">
                  {revealEnabled && !isRevealed && answers[currentQuestion] !== undefined
                    ? "Reveal answer"
                    : isLastOfSubject && nextSubjectName
                      ? `Next: ${nextSubjectName.replace(" Language", "")}`
                      : "Next"}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              </button>
            </div>
          </section>

          <aside className="space-y-5">
            <div id="exam-navigator" className="scroll-mt-28 rounded-[28px] bg-white p-4 ring-1 ring-slate-200 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900">Navigator</h3>
                <span className="text-xs font-semibold text-slate-500">
                  {multiSubject ? `${subjectAnsweredCount} / ${pos.count} answered` : `${answeredCount} / ${questionTotal} answered`}
                </span>
              </div>
              <div className="max-h-[520px] space-y-4 overflow-y-auto pr-1">
                {subjectTabs.length > 1
                  ? subjectTabs.map((tab, ti) => {
                      // Only the subject being answered is shown, numbered from 1
                      if (ti !== pos.tabIdx) return null;
                      const end = ti + 1 < subjectTabs.length ? subjectTabs[ti + 1].start : questionTotal;
                      const count = end - tab.start;
                      return (
                        <div key={tab.name}>
                          <p className="mb-1.5 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                            <span>{tab.name.replace(" Language", "")}</span>
                            <span>{count} Qs</span>
                          </p>
                          <div className="grid grid-cols-5 gap-1.5">
                            {Array.from({ length: count }, (_, k) => {
                              const i = tab.start + k;
                              let btn = "bg-slate-100 text-slate-700";
                              if (i === currentQuestion) btn = revealEnabled ? "bg-violet-700 text-white" : "bg-emerald-700 text-white";
                              else if (revealEnabled && revealedInStudy.has(i)) {
                                btn = answers[i] === questions[i]?.answer ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";
                              } else if (isExamMode && skipped.has(i)) btn = "bg-rose-100 text-rose-700";
                              else if (isExamMode && marked.has(i)) btn = "bg-amber-100 text-amber-800";
                              else if (answers[i] !== undefined) btn = "bg-emerald-100 text-emerald-700";
                              return (
                                <button key={i} type="button" onClick={() => setCurrentQuestion(i)}
                                  className={`flex h-10 touch-manipulation items-center justify-center rounded-xl text-xs font-bold ${btn}`}>{k + 1}</button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  : (
                      <div className="grid grid-cols-5 gap-1.5">
                        {Array.from({ length: questionTotal }, (_, i) => {
                          let btn = "bg-slate-100 text-slate-700";
                          if (i === currentQuestion) btn = revealEnabled ? "bg-violet-700 text-white" : "bg-emerald-700 text-white";
                          else if (revealEnabled && revealedInStudy.has(i)) {
                            btn = answers[i] === questions[i]?.answer ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";
                          } else if (isExamMode && skipped.has(i)) btn = "bg-rose-100 text-rose-700";
                          else if (isExamMode && marked.has(i)) btn = "bg-amber-100 text-amber-800";
                          else if (answers[i] !== undefined) btn = "bg-emerald-100 text-emerald-700";
                          return (
                            <button key={i} type="button" onClick={() => setCurrentQuestion(i)}
                              className={`flex h-10 touch-manipulation items-center justify-center rounded-xl text-xs font-bold ${btn}`}>{i + 1}</button>
                          );
                        })}
                      </div>
                    )}
              </div>
            </div>

            <button type="button" onClick={requestSubmit} disabled={submitting}
              className={`flex h-12 w-full items-center justify-center rounded-2xl text-sm font-bold text-white disabled:opacity-60 ${revealEnabled ? "bg-violet-600 hover:bg-violet-700" : "bg-rose-500 hover:bg-rose-600"}`}>
              {submitting ? "Saving…" : revealEnabled ? "Finish & Review" : "Submit Exam"}
            </button>
            <Link href={setupHref}
              onClick={(e) => { if (answeredCount > 0 && !window.confirm("Leave this session? Your progress will be lost.")) e.preventDefault(); }}
              className="flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700">Exit</Link>

          </aside>
        </div>
      </div>
      </main>
      {showCalc && <CalculatorPad onClose={() => setShowCalc(false)} />}

      {confirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/60 sm:items-center sm:p-4"
          role="dialog" aria-modal="true" aria-labelledby="submit-confirm-title"
          onClick={() => setConfirmOpen(false)}>
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px] sm:p-6"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}>
            <h2 id="submit-confirm-title" className="text-xl font-black text-slate-900">
              {isExamMode ? "Submit your exam?" : "Finish this session?"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {unansweredTotal > 0
                ? `You still have ${unansweredTotal} unanswered question${unansweredTotal === 1 ? "" : "s"}.`
                : "You have answered every question."}{" "}
              You cannot change your answers after submitting.
            </p>

            <div className={`mt-4 grid gap-2 text-center ${isStudyMode ? "grid-cols-2" : "grid-cols-3"}`}>
              <div className="rounded-2xl bg-emerald-50 px-2 py-3 ring-1 ring-emerald-100">
                <p className="text-xl font-black text-emerald-700">{answeredCount}</p>
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">Answered</p>
              </div>
              <div className={`rounded-2xl px-2 py-3 ring-1 ${unansweredTotal > 0 ? "bg-rose-50 ring-rose-100" : "bg-slate-50 ring-slate-200"}`}>
                <p className={`text-xl font-black ${unansweredTotal > 0 ? "text-rose-600" : "text-slate-500"}`}>{unansweredTotal}</p>
                <p className={`text-[11px] font-bold uppercase tracking-wide ${unansweredTotal > 0 ? "text-rose-500" : "text-slate-400"}`}>Unanswered</p>
              </div>
              {!isStudyMode && (
                <div className="rounded-2xl bg-amber-50 px-2 py-3 ring-1 ring-amber-100">
                  <p className="text-xl font-black text-amber-700">{marked.size}</p>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600">Marked</p>
                </div>
              )}
            </div>

            {subjectUnanswered.length > 0 && (
              <ul className="mt-3 space-y-1.5 rounded-2xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
                {subjectUnanswered.map((x) => (
                  <li key={x.name} className="flex items-center justify-between font-semibold text-slate-700">
                    <span>{x.name.replace(" Language", "")}</span>
                    <span className="text-rose-600">{x.left} left</span>
                  </li>
                ))}
              </ul>
            )}

            {timeLeft !== null && (
              <p className="mt-3 text-center text-sm font-semibold text-slate-500">Time left: <span className="tabular-nums text-slate-800">{fmt}</span></p>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setConfirmOpen(false)}
                className="h-12 touch-manipulation rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700">
                Keep answering
              </button>
              <button type="button" onClick={() => void doSubmit()} disabled={submitting}
                className={`h-12 touch-manipulation rounded-2xl text-sm font-bold text-white disabled:opacity-60 ${revealEnabled ? "bg-violet-600" : "bg-rose-500"}`}>
                {submitting ? "Saving…" : "Submit now"}
              </button>
            </div>
          </div>
        </div>
      )}
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
