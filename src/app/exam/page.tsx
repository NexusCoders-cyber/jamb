"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { startTransition, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import ScoreSummary from "@/components/ScoreSummary";
import { usePro } from "@/lib/usePro";
import { cacheKey as idbCacheKey } from "@/lib/questionCache";
import { deviceHeaders } from "@/lib/device";
import ReportQuestionButton from "@/components/ReportQuestionButton";
import { buildSessionPool, markQuestionsSeen } from "@/lib/questionPool";
import { preloadImages } from "@/lib/imagePreload";
import {
  clearLocalSession,
  getLocalSession,
  newId,
  saveLocalAttempt,
  saveLocalSession,
  type LocalAnswerRow,
} from "@/lib/localDb";
import { useSyncStatus } from "@/lib/useSync";
import BookmarkButton from "@/components/BookmarkButton";
import type { QuestionSnapshot } from "@/lib/queries";
import { ALOC_SUBJECTS } from "@/lib/aloc";
import RichText from "@/components/RichText";
import QuestionImage from "@/components/QuestionImage";
import ExplanationView from "@/components/ExplanationView";
import { novelMatches, type NormalizedQuestion } from "@/lib/aloc";
import { finalizeEnglishPaper } from "@/lib/englishPaper";
import { sampleLekkiForExam } from "@/lib/lekki-questions";
import { isArchivedNovel, isCurrentNovel } from "@/lib/setTexts";
import {
  Calculator,
  Check,
  ChevronDown,
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
  /** All diagrams for the question (image column + <img> tags in the question HTML) */
  images?: string[];
  /** Picture for each answer option (diagram-style choices), aligned with `options` */
  optionImages?: (string | null)[];
  sectionImages?: string[];
  explanationImages?: string[];
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

/** Every diagram for a question, including older saved ones that only have `image` */
function questionImageList(q: { images?: string[]; image?: string | null }): string[] {
  return q.images?.length ? q.images : q.image ? [q.image] : [];
}

/** Every picture a question can show: its diagrams, option pictures and passage pictures. */
function imagesOf(q: ExamQuestion): string[] {
  return [
    ...questionImageList(q),
    ...(q.optionImages ?? []).filter((u): u is string => !!u),
    ...(q.sectionImages ?? []),
  ];
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
      {!(hidePassage && isPassage) && (question.sectionImages?.length ?? 0) > 0 && (
        <div className="mb-4 grid gap-3">
          {question.sectionImages!.map((src) => <QuestionImage key={src} src={src} />)}
        </div>
      )}
      {questionImageList(question).length > 0 && (
        <div className={`mb-4 grid gap-3 ${questionImageList(question).length > 1 ? "sm:grid-cols-2" : ""}`}>
          {questionImageList(question).map((src) => <QuestionImage key={src} src={src} />)}
        </div>
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
  images,
  info,
  hidden,
  onToggle,
}: {
  text: string;
  images?: string[];
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
        {(images?.length ?? 0) > 0 && (
          <div className="mt-3 grid gap-3">{images!.map((src) => <QuestionImage key={src} src={src} />)}</div>
        )}
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

/** The saved copy of a question (used for attempts, bookmarks and Review). */
function toSnapshot(question: ExamQuestion, place: { index: number; number: number }, fallbackSubject: string): QuestionSnapshot {
  return {
    id: question.id,
    prompt: question.prompt,
    prompt_segments: question.promptSegments ?? undefined,
    options: question.options,
    option_segments: question.optionSegments ?? undefined,
    section: question.section ?? undefined,
    section_kind: question.sectionKind ?? undefined,
    image: question.image ?? undefined,
    images: question.images?.length ? question.images : undefined,
    option_images: question.optionImages ?? undefined,
    section_images: question.sectionImages ?? undefined,
    explanation_images: question.explanationImages ?? undefined,
    novel: question.novel ?? undefined,
    correct_option: question.answer,
    explanation: question.explanation,
    difficulty: "medium",
    subject_name: question.subject ?? fallbackSubject,
    position: place.index,
    subject_number: place.number,
    passage_id: question.passageId ?? undefined,
    year: question.year ?? undefined,
  };
}

function InlineReview({
  entries,
  score,
  total,
  subject,
  onRetry,
  tabs = [],
  saveProblem = null,
  saveNote = null,
  onRetrySave,
  retryingSave = false,
  timeUsedSeconds = null,
  backup,
}: {
  entries: ReviewEntry[];
  score: number;
  total: number;
  subject: string;
  onRetry: () => void;
  /** Subject boundaries — lets the review number each subject 1..N like the exam did */
  tabs?: SubjectTab[];
  /** Why the attempt could not be stored (null = it was stored) */
  saveProblem?: string | null;
  /** The attempt was stored, but with less detail than usual */
  saveNote?: string | null;
  onRetrySave?: () => void;
  retryingSave?: boolean;
  /** Seconds the student spent on the session (shown on the score card) */
  timeUsedSeconds?: number | null;
  /** Explicit cloud backup of what is stored on this device */
  backup?: {
    pending: number;
    online: boolean;
    syncing: boolean;
    persistent: boolean;
    message: string | null;
    onBackup: () => void;
  };
}) {
  const [filter, setFilter] = useState<"all" | "wrong" | "unanswered" | "correct">("all");
  // Which subject card is open (multi-subject mock). Single-subject sessions always show their corrections.
  const [openSubject, setOpenSubject] = useState<number | null>(null);
  const multi = tabs.length > 1;
  const statusOf = (e: ReviewEntry): "correct" | "wrong" | "unanswered" =>
    e.selectedIdx === null ? "unanswered" : e.selectedIdx === e.question.answer ? "correct" : "wrong";
  const inSubject = (e: ReviewEntry, ti: number) => locateInSubject(tabs, e.questionIdx, total).tabIdx === ti;
  const shortName = (n: string) => n.replace(" Language", "");

  const subjectSummaries = multi
    ? tabs.map((tab, ti) => {
        const slice = entries.filter((e) => inSubject(e, ti));
        const correct = slice.filter((e) => statusOf(e) === "correct").length;
        const unanswered = slice.filter((e) => statusOf(e) === "unanswered").length;
        return {
          name: tab.name,
          tabIdx: ti,
          total: slice.length,
          correct,
          unanswered,
          wrong: slice.length - correct - unanswered,
          pct: slice.length > 0 ? Math.round((correct / slice.length) * 100) : 0,
        };
      })
    : [];
  const activeSubject = multi ? openSubject : 0;
  const scopeEntries = activeSubject === null ? [] : multi ? entries.filter((e) => inSubject(e, activeSubject)) : entries;
  const counts = {
    all: scopeEntries.length,
    wrong: scopeEntries.filter((e) => statusOf(e) === "wrong").length,
    unanswered: scopeEntries.filter((e) => statusOf(e) === "unanswered").length,
    correct: scopeEntries.filter((e) => statusOf(e) === "correct").length,
  };
  const visible = scopeEntries.filter((e) => filter === "all" || statusOf(e) === filter);

  // Opening a subject card brings its corrections into view
  useEffect(() => {
    if (openSubject === null) return;
    document.getElementById("corrections-panel")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [openSubject]);

  // "Review corrections" on the score card: open the first subject (multi) and scroll to the corrections
  function openCorrections() {
    if (multi && openSubject === null) setOpenSubject(0);
    setFilter("all");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById("corrections-panel") ?? document.getElementById("corrections-title");
      el?.scrollIntoView({ block: "start", behavior: "smooth" });
    }));
  }

  function jumpTo(questionIdx: number) {
    setFilter("all");
    // wait for the (possibly filtered-out) card to render, then scroll to it
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById(`corr-${questionIdx}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
    }));
  }

  // First visible question of each passage shows the passage once (not on every card)
  const passageFirst = new Set<number>();
  {
    let prevPassage: string | null = null;
    for (const e of visible) {
      const pid = e.question.passageId ?? null;
      if (pid && e.question.section && pid !== prevPassage) passageFirst.add(e.questionIdx);
      prevPassage = pid;
    }
  }

  return (
    <AppShell title="Results" back="/practice">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-3xl lg:px-6">
        <ScoreSummary
          subject={subject}
          correct={score}
          total={total}
          unanswered={entries.filter((e) => e.selectedIdx === null).length}
          subjects={subjectSummaries}
          timeUsedSeconds={timeUsedSeconds}
          onRetry={onRetry}
          onReview={openCorrections}
        />

        {saveProblem ? (
          <div role="alert" className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
            <p className="font-semibold">
              This device could not store the attempt, so it may be missing from History. Your answers and corrections are still shown below.
            </p>
            {onRetrySave && (
              <button
                type="button"
                onClick={onRetrySave}
                disabled={retryingSave}
                className="mt-3 touch-manipulation rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {retryingSave ? "Saving…" : "Try saving again"}
              </button>
            )}
            <details className="mt-3 text-xs text-amber-800">
              <summary className="cursor-pointer font-bold">Technical details</summary>
              <p className="mt-1 break-words font-mono">{saveProblem}</p>
            </details>
          </div>
        ) : (
          <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
            <div className="min-w-0 flex-1">
              <p className="font-bold">Saved on this device</p>
              <p className="mt-0.5 text-xs text-emerald-800">
                {backup?.persistent === false
                  ? "Your browser is not keeping data between visits, so back this up before closing the app."
                  : backup && backup.pending > 0
                    ? backup.online
                      ? "Back it up to your account to keep it if you change phone or clear your browser."
                      : "You're offline. It will be safe here until you back up with a connection."
                    : "Backed up to your account."}
              </p>
              {backup?.message && <p className="mt-1 text-xs font-semibold text-emerald-900">{backup.message}</p>}
            </div>
            {backup && backup.pending > 0 && (
              <button
                type="button"
                onClick={backup.onBackup}
                disabled={backup.syncing || !backup.online}
                className="touch-manipulation rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {backup.syncing ? "Backing up…" : "Back up now"}
              </button>
            )}
          </div>
        )}
        {!saveProblem && saveNote && (
          <div role="status" className="mb-4 rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
            {saveNote}
          </div>
        )}

        <section aria-labelledby="corrections-title">
          <h2 id="corrections-title" className="text-lg font-black text-slate-900">Corrections</h2>
          <p className="mb-3 mt-0.5 text-sm text-slate-500">
            {multi
              ? "Tap a subject to see every question with its correct answer, including the ones you left unanswered."
              : "Every question with its correct answer, including the ones you left unanswered."}
          </p>

          {multi && (
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {subjectSummaries.map((sm) => {
                const selected = openSubject === sm.tabIdx;
                return (
                  <button key={sm.name} type="button" aria-expanded={selected} aria-controls="corrections-panel"
                    onClick={() => { setOpenSubject(selected ? null : sm.tabIdx); setFilter("all"); }}
                    className={`touch-manipulation rounded-[22px] p-4 text-left ring-1 transition ${selected ? "bg-violet-600 text-white shadow-lg shadow-violet-200 ring-violet-600" : "bg-white text-slate-800 ring-slate-200 hover:ring-violet-300"}`}>
                    <p className="truncate text-[11px] font-black uppercase tracking-[0.14em] opacity-70">{shortName(sm.name)}</p>
                    <p className="mt-1 text-3xl font-black tabular-nums">{sm.pct}<span className="text-sm font-bold opacity-60">/100</span></p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
                      <div className={`h-full rounded-full ${selected ? "bg-white" : sm.pct >= 70 ? "bg-emerald-500" : sm.pct >= 50 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${sm.pct}%` }} />
                    </div>
                    <p className="mt-2 text-[11px] font-semibold opacity-80">{sm.correct}/{sm.total} correct</p>
                    <p className="text-[11px] font-semibold opacity-80">{sm.wrong} wrong · {sm.unanswered} unanswered</p>
                    <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold opacity-90">
                      {selected ? "Hide corrections" : "View corrections"}
                      <ChevronDown className={`h-3 w-3 transition ${selected ? "rotate-180" : ""}`} aria-hidden />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {activeSubject !== null && (
            <div id="corrections-panel" className="scroll-mt-20">
              {multi && (
                <h3 className="mb-3 text-base font-black text-slate-900">{shortName(tabs[activeSubject].name)} · corrections</h3>
              )}

              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {([
                  ["all", `All (${counts.all})`],
                  ["wrong", `Wrong (${counts.wrong})`],
                  ["unanswered", `Unanswered (${counts.unanswered})`],
                  ["correct", `Correct (${counts.correct})`],
                ] as const).map(([f, label]) => (
                  <button key={f} type="button" onClick={() => setFilter(f)}
                    className={`shrink-0 touch-manipulation rounded-full px-4 py-1.5 text-sm font-bold transition ${filter === f
                      ? f === "wrong" ? "bg-rose-600 text-white" : f === "correct" ? "bg-emerald-600 text-white" : f === "unanswered" ? "bg-slate-600 text-white" : "bg-slate-900 text-white"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Question map, like the exam navigator: green = correct, red = wrong, grey = unanswered */}
              <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Question map">
                {scopeEntries.map((e) => {
                  const st = statusOf(e);
                  return (
                    <button key={e.questionIdx} type="button" onClick={() => jumpTo(e.questionIdx)}
                      aria-label={`Question ${locateInSubject(tabs, e.questionIdx, total).number}, ${st}`}
                      className={`flex h-9 w-9 touch-manipulation items-center justify-center rounded-xl text-xs font-bold ${st === "correct" ? "bg-emerald-100 text-emerald-800" : st === "wrong" ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-600"}`}>
                      {locateInSubject(tabs, e.questionIdx, total).number}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4">
                {visible.map((entry) => {
                  const { question: q, selectedIdx, questionIdx } = entry;
                  const st = statusOf(entry);
                  const isCorrect = st === "correct";
                  const isSkipped = st === "unanswered";
                  const showPassage = passageFirst.has(questionIdx);

                  return (
                    <div key={`${q.id}-${questionIdx}`} id={`corr-${questionIdx}`}
                      className={`scroll-mt-24 rounded-[24px] border p-4 sm:p-5 ${isCorrect ? "border-emerald-200 bg-emerald-50" : isSkipped ? "border-slate-200 bg-white" : "border-rose-200 bg-rose-50"}`}>
                      {showPassage && (
                        <details className="mb-4 rounded-[20px] bg-amber-50 ring-1 ring-amber-100">
                          <summary className="cursor-pointer select-none px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-amber-800">
                            Passage · tap to read
                          </summary>
                          <div className="max-h-[50dvh] overflow-y-auto px-4 pb-4">
                            <p className="whitespace-pre-line text-[15px] leading-7 text-slate-800">{q.section}</p>
                            {(q.sectionImages?.length ?? 0) > 0 && (
                              <div className="mt-3 grid gap-3">{q.sectionImages!.map((src) => <QuestionImage key={src} src={src} />)}</div>
                            )}
                          </div>
                        </details>
                      )}

                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${isCorrect ? "bg-emerald-200 text-emerald-800" : isSkipped ? "bg-slate-200 text-slate-700" : "bg-rose-200 text-rose-800"}`}>
                          Q{locateInSubject(tabs, questionIdx, total).number} · {isCorrect ? "Correct" : isSkipped ? "Unanswered" : "Wrong"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <BookmarkButton snapshot={toSnapshot(q, { index: questionIdx, number: locateInSubject(tabs, questionIdx, total).number }, subject)} subject={q.subject ?? subject} className="!px-2.5 !py-1 !text-xs" />
                          <ReportQuestionButton subject={q.subject ?? subject} questionId={String(q.id)} prompt={q.prompt} options={q.options} />
                          {q.subject && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">{q.subject}</span>}
                          {q.year && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{q.year}</span>}
                        </div>
                      </div>

                      <QuestionMedia question={q} hidePassage={!!q.passageId} />
                      <p className="text-base font-semibold leading-7 text-slate-800">
                        <RichText segments={q.promptSegments} fallback={q.prompt} />
                      </p>

                      {isSkipped && (
                        <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                          You did not answer this question. The correct answer is {String.fromCharCode(65 + q.answer)}.
                        </p>
                      )}
                      {st === "wrong" && selectedIdx !== null && (
                        <p className="mt-3 text-sm font-semibold text-slate-600">
                          You chose <span className="text-rose-600">{String.fromCharCode(65 + selectedIdx)}</span> · correct answer <span className="text-emerald-700">{String.fromCharCode(65 + q.answer)}</span>
                        </p>
                      )}

                      <div className="mt-4 grid gap-2">
                        {q.options.map((opt, idx) => {
                          const isCorrectOpt = idx === q.answer;
                          const isYours = idx === selectedIdx;
                          const optImg = q.optionImages?.[idx] ?? null;
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
                              <span className="min-w-0 flex-1 break-words">
                                {optImg && <QuestionImage key={optImg} src={optImg} zoomable={false} compact className={opt ? "mb-2" : ""} />}
                                <RichText segments={q.optionSegments?.[idx]} fallback={opt} />
                              </span>
                              {isCorrectOpt && (
                                <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-700">
                                  <Check className="h-3.5 w-3.5" aria-hidden /> Correct answer
                                </span>
                              )}
                              {isYours && !isCorrectOpt && (
                                <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-bold text-rose-600">
                                  <XCircle className="h-3.5 w-3.5" aria-hidden /> Your answer
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 rounded-xl bg-white/80 p-4 ring-1 ring-emerald-200">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Explanation</p>
                        {q.explanation ? (
                          <ExplanationView text={q.explanation} subject={q.subject} className="mt-2" />
                        ) : (
                          <p className="mt-1.5 text-sm text-slate-400">No explanation is available for this question yet.</p>
                        )}
                        {(q.explanationImages?.length ?? 0) > 0 && (
                          <div className="mt-3 grid gap-3">{q.explanationImages!.map((src) => <QuestionImage key={src} src={src} />)}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {visible.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-400">No questions in this filter.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

type SubjectPlan = { name: string; count: number };

/** Everything needed to continue an unfinished session (stored on the device only). */
type SavedExamState = {
  questions: ExamQuestion[];
  subjectTabs: { name: string; start: number }[];
  questionTotal: number;
  sessionLabel: string;
  answers: Record<string, number>;
  marked: number[];
  skipped: number[];
  revealed: number[];
  currentQuestion: number;
  /** Seconds left (null = untimed). The clock is paused while the app is closed. */
  timeLeft: number | null;
  startedAtMs: number;
  attemptId: string;
};

const SESSION_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

function ExamPageContent() {
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useUser();
  const { isPro, loading: proLoading } = usePro();

  const rawMode = searchParams.get("mode");
  const mode = rawMode === "study" ? "study" : rawMode === "practice" ? "practice" : "exam";
  const isStudyMode = mode === "study";
  const isPracticeMode = mode === "practice";
  const isExamMode = mode === "exam";
  // Only study mode reveals answers as you go. Practice mode now behaves like
  // the exam: answers + corrections are shown in the post-test review, so the
  // session score isn't spoiled while answering.
  const revealEnabled = isStudyMode;

  const urlSubject = searchParams.get("subject") ?? ENGLISH;
  const urlCount = Math.max(1, Math.min(Number(searchParams.get("count") ?? 40), 60));
  const urlTimer = searchParams.get("timer") ?? "Recommended timer";
  const urlYear = searchParams.get("year") ?? "All years";
  // Novel study: only questions drawn from this set text
  const urlNovel = searchParams.get("novel") ?? "";
  // Topic session (Learn → Topics): syllabus-topic practice/study
  const urlTopic = searchParams.get("topic") ?? "";
  // Standalone setup page this session was launched from (Learn hub modes)
  const setupHref = urlTopic ? "/topics" : urlNovel ? "/practice/novel" : isPracticeMode ? "/practice/past-questions" : isStudyMode ? "/practice/study" : "/practice";

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
  const submittedRef = useRef(false);
  const sync = useSyncStatus(user?.id);

  const [reviewEntries, setReviewEntries] = useState<ReviewEntry[] | null>(null);
  const [reviewScore, setReviewScore] = useState(0);
  const [saveProblem, setSaveProblem] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [retryingSave, setRetryingSave] = useState(false);
  const startedAtMsRef = useRef<number | null>(null);
  const [reviewSeconds, setReviewSeconds] = useState<number | null>(null);

  const q = questions[currentQuestion];
  // Position inside the current subject (drives the 1-60 / 1-40 numbering)
  const pos = locateInSubject(subjectTabs, currentQuestion, questionTotal);
  const multiSubject = subjectTabs.length > 1;
  const passageInfo = getPassageInfo(questions, currentQuestion, pos.start, pos.end);
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

  // Pictures are loaded BEFORE their question is shown: the next few first, then the rest of the paper
  // in the background. Each one is checked once (direct, else through the proxy) and kept in the browser cache.
  useEffect(() => {
    if (!started || typeof window === "undefined") return;
    const upcoming = questions.slice(currentQuestion, currentQuestion + 6).flatMap(imagesOf);
    const rest = questions.slice(currentQuestion + 6).flatMap(imagesOf);
    void preloadImages(upcoming, 3).then(() => preloadImages(rest, 2));
  }, [currentQuestion, started, questions]);

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

      // A different set every session: fresh batch from the server (several random years for "Random mix"),
      // merged into the pool kept on this device, never-seen questions first. Offline it simply uses the pool.
      async function fetchPool(name: string, want: number): Promise<ExamQuestion[]> {
        const yearKey = examYear === "random" ? undefined : examYear;
        const size = Math.min(200, Math.max(want, 60));
        return buildSessionPool<ExamQuestion>({
          subject: name,
          cacheKey: idbCacheKey(name, yearKey),
          fetchBatch: async () => {
            const spread = examYear === "random" ? "&spread=1" : "";
            const res = (await fetch(
              `/api/aloc?endpoint=questions&subject=${encodeURIComponent(name)}&type=utme${yearParam}&count=${size}${spread}&t=${Date.now()}`,
              { headers: await deviceHeaders() },
            ).then((r) => r.json())) as { ok: boolean; data?: ExamQuestion[]; error?: string };
            if (res.ok && Array.isArray(res.data) && res.data.length > 0) return res.data;
            throw new Error(res.error ?? `No questions for ${name}${examYear !== "random" ? ` (${examYear})` : ""}`);
          },
        });
      }

      // English in Mock/Exam mode: a JAMB-style paper (whole comprehension/cloze passages,
      // 5-9 set-text questions, lexis, oral) assembled server-side. Any failure falls
      // back to the plain random pool below, so an exam always starts.
      async function fetchEnglishPaper(): Promise<ExamQuestion[]> {
        const res = (await fetch(`/api/aloc?endpoint=english-paper&type=utme${yearParam}&t=${Date.now()}`, { headers: await deviceHeaders() }).then((r) => r.json())) as {
          ok: boolean;
          data?: ExamQuestion[];
          error?: string;
        };
        if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) throw new Error(res.error ?? "english-paper unavailable");
        return res.data;
      }

      let combined: ExamQuestion[];
      if (!isExamMode && urlTopic) {
        // Topic session (Learn → Topics): the server fetches a big ALOC pool and
        // filters it with the syllabus keywords for this topic.
        const res = (await fetch(`/api/topics/questions?subject=${encodeURIComponent(studySubject)}&topic=${encodeURIComponent(urlTopic)}&count=${studyCount}`, { headers: await deviceHeaders() }).then((r) => r.json())) as {
          ok: boolean;
          data?: ExamQuestion[];
          error?: string;
        };
        if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) {
          throw new Error(res.error ?? `No questions found for "${urlTopic}" yet. Try another topic.`);
        }
        combined = res.data.map((qn) => ({ ...qn, subject: studySubject }));
      } else {
      const perSubject = await Promise.all(
        entries.map(async ({ name, count }) => {
          // Set-text study (Learn → Novels) for the CURRENT book uses the bundled dataset: complete, offline-ready
          if (urlNovel && isCurrentNovel(urlNovel)) {
            const set = sampleLekkiForExam(count) as unknown as ExamQuestion[];
            return set.map((qn) => ({ ...qn, subject: name }));
          }
          if (isExamMode && !urlNovel && name === ENGLISH) {
            // UTME Use of English: 60 questions, the last block (5-10 questions) from The Lekki Headmaster only.
            // finalizeEnglishPaper strips every other set text, whichever path the paper came from.
            let paper: ExamQuestion[];
            try {
              paper = await fetchEnglishPaper();
            } catch (paperErr) {
              console.warn("English paper assembly failed, using random pool:", paperErr);
              paper = await fetchPool(name, count * 2).catch(() => [] as ExamQuestion[]);
            }
            const finalPaper = finalizeEnglishPaper(paper as unknown as NormalizedQuestion[], { total: count }) as unknown as ExamQuestion[];
            return finalPaper.map((qn) => ({ ...qn, subject: name }));
          }
          let pool = await fetchPool(name, count * 2);
          // Novel mode: keep only questions drawn from the selected set text
          if (urlNovel) {
            pool = pool.filter((qn) => novelMatches(qn.novel, urlNovel));
          } else if (name === ENGLISH) {
            // Practice / study English: older prescribed books are retired
            pool = pool.filter((qn) => !isArchivedNovel(qn.novel));
          }
          return pool.slice(0, count).map((qn) => ({ ...qn, subject: name }));
        }),
      );

      combined = perSubject.flat();
      }
      if (combined.length === 0) {
        throw new Error(
          urlNovel
            ? `No questions found for "${urlNovel}" in this pool yet. Try another year.`
            : "Could not load any questions. Check your connection.",
        );
      }

      // Remember what was given so the next session prefers questions the student has not met
      const bySubject = new Map<string, string[]>();
      for (const qn of combined) bySubject.set(qn.subject ?? "", [...(bySubject.get(qn.subject ?? "") ?? []), String(qn.id)]);
      for (const [subjectName, ids] of bySubject) if (subjectName) void markQuestionsSeen(subjectName, ids);

      const tabs: { name: string; start: number }[] = [];
      for (let i = 0; i < combined.length; i++) {
        const name = combined[i].subject ?? "";
        if (i === 0 || name !== combined[i - 1].subject) tabs.push({ name, start: i });
      }

      // Have the first questions' pictures ready so they are there the moment the exam opens (max ~5 s wait)
      await Promise.race([
        preloadImages(combined.slice(0, 3).flatMap(imagesOf), 3),
        new Promise<void>((resolve) => window.setTimeout(resolve, 5000)),
      ]);

      startTransition(() => {
        setQuestions(combined);
        setSubjectTabs(tabs);
        setQuestionTotal(combined.length);
        setSessionLabel(
          isExamMode
            ? entries.length > 1
              ? `Mock exam · ${entries.map((e) => e.name.replace(" Language", "")).join(" + ")}`
              : entries[0].name
            : urlTopic ? `${studySubject} · ${urlTopic}` : studySubject,
        );
        if (isExamMode) {
          const totalQ = combined.length;
          const mins = urlTimer === "1 hour" ? 60 : urlTimer === "30 minutes" ? 30 : urlTimer === "15 minutes" ? 15 : Math.max(15, Math.round((totalQ * 2) / 3));
          setTimeLeft(mins * 60);
        } else {
          setTimeLeft(null);
        }
        setCurrentQuestion(0);
        startedAtMsRef.current = Date.now();
        setStarted(true);
      });
    } catch (err) {
      setPrepareError(err instanceof Error ? err.message : "Could not prepare the exam. Try again.");
    } finally {
      setPreparing(false);
    }
  }

  // ── Offline-first: the attempt id is created on the device, nothing is sent to the cloud while exam is running ──
  useEffect(() => {
    if (started && !attemptIdRef.current) attemptIdRef.current = newId();
  }, [started]);

  // Unfinished session saved on this device (one per mode) → offer to resume it
  const [resumable, setResumable] = useState<SavedExamState | null>(null);
  useEffect(() => {
    if (!user || started || reviewEntries) return;
    let cancelled = false;
    void getLocalSession(user.id, mode).then(async (row) => {
      if (cancelled) return;
      const state = row?.state as SavedExamState | undefined;
      const fresh = row && Date.now() - new Date(row.savedAt).getTime() < SESSION_MAX_AGE_MS;
      if (state && fresh && Array.isArray(state.questions) && state.questions.length > 0) setResumable(state);
      else {
        setResumable(null);
        if (row) await clearLocalSession(user.id, mode);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user, mode, started, reviewEntries]);

  function resumeSession(state: SavedExamState) {
    attemptIdRef.current = state.attemptId || newId();
    submittedRef.current = false;
    startTransition(() => {
      setQuestions(state.questions);
      setSubjectTabs(state.subjectTabs);
      setQuestionTotal(state.questionTotal);
      setSessionLabel(state.sessionLabel);
      setAnswers(Object.fromEntries(Object.entries(state.answers).map(([k, v]) => [Number(k), v])));
      setMarked(new Set(state.marked));
      setSkipped(new Set(state.skipped));
      setRevealedInStudy(new Set(state.revealed));
      setCurrentQuestion(Math.min(state.currentQuestion, Math.max(0, state.questions.length - 1)));
      setTimeLeft(state.timeLeft);
      startedAtMsRef.current = state.startedAtMs;
      setResumable(null);
      setStarted(true);
    });
  }

  // Arriving from "Re-drill my mistakes": the drill was saved as the practice session — start it straight away
  const autoResume = searchParams.get("resume") === "1";
  useEffect(() => {
    if (autoResume && resumable && !started) resumeSession(resumable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoResume, resumable, started]);

  async function discardSession() {
    if (user) await clearLocalSession(user.id, mode);
    setResumable(null);
  }

  // Autosave the running session on this device (debounced; the clock is captured by a slower timer)
  const timeLeftRef = useRef<number | null>(null);
  timeLeftRef.current = timeLeft;
  const saveSessionNow = useCallback(() => {
    if (!user || !started || submittedRef.current || questions.length === 0) return;
    const state: SavedExamState = {
      questions,
      subjectTabs,
      questionTotal,
      sessionLabel,
      answers,
      marked: Array.from(marked),
      skipped: Array.from(skipped),
      revealed: Array.from(revealedInStudy),
      currentQuestion,
      timeLeft: timeLeftRef.current,
      startedAtMs: startedAtMsRef.current ?? Date.now(),
      attemptId: attemptIdRef.current ?? "",
    };
    void saveLocalSession(user.id, mode, state);
  }, [user, started, questions, subjectTabs, questionTotal, sessionLabel, answers, marked, skipped, revealedInStudy, currentQuestion, mode]);

  useEffect(() => {
    if (!started) return;
    const t = window.setTimeout(saveSessionNow, 700);
    return () => window.clearTimeout(t);
  }, [started, saveSessionNow]);

  useEffect(() => {
    if (!started) return;
    const id = window.setInterval(saveSessionNow, 5000);
    const onHide = () => {
      if (document.visibilityState === "hidden") saveSessionNow();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", saveSessionNow);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", saveSessionNow);
    };
  }, [started, saveSessionNow]);

  // Clock — runs on the wall clock, not on "one tick = one second". Phones throttle timers when the screen is off
  // or another app is in front, so counting ticks would silently give a student extra time (the real CBT never pauses).
  const hasTimer = timeLeft !== null;
  useEffect(() => {
    if (!started || !hasTimer || reviewEntries) return;
    const deadline = Date.now() + (timeLeftRef.current ?? 0) * 1000;
    const tick = () => {
      if (submittedRef.current) return;
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft((prev) => (prev === null || prev === left ? prev : left));
    };
    const id = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [started, hasTimer, reviewEntries]);

  useEffect(() => {
    if (timeLeft === 0 && started && !submitting && !submittedRef.current) void doSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // Back button / swipe-back guard: a running exam is never thrown away by one accidental gesture.
  // (Progress is autosaved on this device, so leaving is safe — but it should be a choice.)
  const [leaveOpen, setLeaveOpen] = useState(false);
  const guardActive = started && !reviewEntries;
  useEffect(() => {
    if (!guardActive) return;
    window.history.pushState({ qubitExamGuard: true }, "");
    const onPop = () => setLeaveOpen(true);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (submittedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [guardActive]);

  function stayInExam() {
    setLeaveOpen(false);
    window.history.pushState({ qubitExamGuard: true }, "");
  }

  function leaveExam() {
    saveSessionNow();
    setLeaveOpen(false);
    window.history.back();
  }

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#eef2ff]">
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

          {resumable && (
            <div className="mb-5 rounded-[24px] bg-amber-50 p-5 ring-1 ring-amber-200" role="region" aria-label="Unfinished session">
              <h2 className="text-base font-black text-amber-900">You have an unfinished session</h2>
              <p className="mt-1 text-sm text-amber-800">
                {resumable.sessionLabel} · {Object.keys(resumable.answers).length} of {resumable.questionTotal} answered
                {resumable.timeLeft !== null && ` · ${Math.floor(resumable.timeLeft / 60)} min left`}. Saved on this device.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => resumeSession(resumable)} className="h-11 touch-manipulation rounded-2xl bg-amber-600 px-5 text-sm font-black text-white hover:bg-amber-700">
                  Resume
                </button>
                <button type="button" onClick={() => void discardSession()} className="h-11 touch-manipulation rounded-2xl border border-amber-300 bg-white px-5 text-sm font-bold text-amber-800">
                  Discard
                </button>
              </div>
            </div>
          )}

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

          {/* Pro-gated start button — free users see upgrade CTA, Pro users start */}
          {!proLoading && !isPro ? (
            <Link
              href={`/upgrade?next=${encodeURIComponent(`/exam?mode=${mode}${urlSubject ? `&subject=${encodeURIComponent(urlSubject)}` : ""}`)}`}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-base font-black text-white shadow-lg shadow-amber-300/30 transition hover:shadow-amber-300/50"
            >
              ⭐ Upgrade to Pro to start
            </Link>
          ) : (
            <button type="button" onClick={() => void startSession()} disabled={preparing || proLoading}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 text-base font-black text-white shadow-lg shadow-violet-300/30 transition hover:bg-violet-700 disabled:opacity-60">
              <Play className="h-5 w-5" aria-hidden />
              {preparing ? "Preparing questions…" : "Start now"}
            </button>
          )}
          <Link href={setupHref} className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700">
            Change session setup
          </Link>
        </div>
      </AppShell>
    );
  }

  /**
   * Store the attempt on THIS device: every question (blank ones too, in paper order) and the score.
   * Nothing is sent to the cloud here — that happens on an explicit backup. Safe to call again
   * (same attempt id, so it simply overwrites).
   */
  async function persistAttempt(list: ReviewEntry[], correct: number): Promise<{ problem: string | null; note: string | null }> {
    if (!user) return { problem: null, note: null }; // guests have no history to save to
    let problem: string | null = null;
    const attemptRows = (() => {
      return list.map((e) => {
        const place = locateInSubject(subjectTabs, e.questionIdx, questionTotal);
        return {
          question_id: e.question.id,
          selected_option: e.selectedIdx,
          is_correct: e.selectedIdx === null ? null : e.question.answer === e.selectedIdx,
          marked_for_review: marked.has(e.questionIdx),
          question: toSnapshot(e.question, { index: e.questionIdx, number: place.number }, sessionLabel),
        };
      });
    })();

    // Saved on this device first — works with no connection. The cloud copy is made on "Back up now".
    const attemptId = attemptIdRef.current ?? newId();
    attemptIdRef.current = attemptId;
    const startedMs = startedAtMsRef.current ?? Date.now();
    try {
      await saveLocalAttempt({
        id: attemptId,
        userId: user.id,
        questionCount: questionTotal,
        score: correct,
        startedAt: new Date(startedMs).toISOString(),
        submittedAt: new Date().toISOString(),
        label: sessionLabel,
        mode,
        answers: attemptRows as LocalAnswerRow[],
        syncedAt: null,
      });
      await clearLocalSession(user.id, mode);
    } catch (err) {
      problem = err instanceof Error ? err.message : "This device could not store the attempt.";
    }
    return { problem, note: null };
  }

  async function retrySave() {
    if (!reviewEntries || retryingSave) return;
    setRetryingSave(true);
    const saved = await persistAttempt(reviewEntries, reviewScore);
    setSaveProblem(saved.problem);
    setSaveNote(saved.note);
    setRetryingSave(false);
  }

  async function doSubmit() {
    if (submitting || submittedRef.current) return;
    submittedRef.current = true; // stops the autosave from re-creating the session after we clear it
    setConfirmOpen(false);
    setSubmitting(true);

    const entries: ReviewEntry[] = questions.slice(0, questionTotal).map((qn, idx) => ({
      question: qn,
      selectedIdx: answers[idx] ?? null,
      questionIdx: idx,
    }));
    const correct = entries.filter((e) => e.selectedIdx === e.question.answer).length;

    const saved = await persistAttempt(entries, correct);
    setSaveProblem(saved.problem);
    setSaveNote(saved.note);

    setReviewSeconds(startedAtMsRef.current ? Math.round((Date.now() - startedAtMsRef.current) / 1000) : null);
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
    setSaveProblem(null);
    setSaveNote(null);
    startedAtMsRef.current = Date.now();
    setReviewSeconds(null);
    setAnswers({});
    setMarked(new Set());
    setSkipped(new Set());
    setRevealedInStudy(new Set());
    setCurrentQuestion(0);
    setSubmitting(false);
    setCalcManuallySet(false);
    attemptIdRef.current = null;
    submittedRef.current = false;
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

  const fmt = timeLeft === null ? (isStudyMode ? "Study mode" : isPracticeMode ? "Practice" : "No timer")
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
        saveProblem={saveProblem}
        saveNote={saveNote}
        onRetrySave={retrySave}
        retryingSave={retryingSave}
        timeUsedSeconds={reviewSeconds}
        backup={{
          pending: sync.pending.total,
          online: sync.online,
          syncing: sync.syncing,
          persistent: sync.persistent,
          message: sync.result ? (sync.result.ok ? (sync.result.attempts > 0 ? "Backed up." : null) : sync.result.message) : null,
          onBackup: () => void sync.sync(),
        }}
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
              {isStudyMode ? "Study mode — answers shown immediately" : isPracticeMode ? "Practice — answers & corrections after the test" : "JAMB standard simulation"}
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
                images={q.sectionImages}
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
                    <span className="min-w-0 flex-1 break-words">
                      {q?.optionImages?.[idx] && (
                        <QuestionImage key={q.optionImages[idx] as string} src={q.optionImages[idx] as string} zoomable={false} compact className={opt ? "mb-2" : ""} />
                      )}
                      {opt}
                    </span>
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
                <ExplanationView text={q.explanation} subject={q.subject ?? activeSubjectName} className="mt-2.5" />
                {(q.explanationImages?.length ?? 0) > 0 && (
                  <div className="mt-3 grid gap-3">{q.explanationImages!.map((src) => <QuestionImage key={src} src={src} />)}</div>
                )}
              </div>
            )}
            {revealEnabled && isRevealed && !q?.explanation && (
              <p className="mt-4 text-xs text-slate-400">No explanation available for this question.</p>
            )}

            </div>
            </div>

            <div className="sticky bottom-0 z-30 -mx-4 -mb-4 mt-5 flex items-center justify-between gap-2 rounded-b-[28px] border-t border-slate-100 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6 xl:static xl:z-auto xl:mx-0 xl:mb-0 xl:mt-6 xl:flex-wrap xl:gap-3 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:backdrop-blur-none">
              {/* Left: tools (mark for review, jump to the question list on phones) */}
              <div className="flex shrink-0 gap-2 sm:gap-3">
                {q && <BookmarkButton snapshot={toSnapshot(q, { index: currentQuestion, number: pos.number }, sessionLabel)} subject={q.subject ?? sessionLabel} />}
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

              {/* Right: Prev and Next side by side, same size — Prev goes back to the question you just left */}
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <button type="button" disabled={currentQuestion === 0}
                  onClick={() => setCurrentQuestion((v) => Math.max(v - 1, 0))}
                  aria-label="Previous question"
                  className="inline-flex touch-manipulation items-center justify-center gap-1 rounded-2xl border-2 border-slate-300 bg-white px-3 py-[10px] text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-40 sm:px-6">
                  <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> Prev
                </button>
                <button type="button" onClick={moveNext} disabled={currentQuestion === questionTotal - 1}
                  aria-label="Next question"
                  className={`inline-flex min-w-0 touch-manipulation items-center justify-center gap-1 rounded-2xl px-3 py-3 text-sm font-bold text-white disabled:opacity-40 sm:px-6 ${revealEnabled ? "bg-violet-600 hover:bg-violet-700" : "bg-emerald-700"}`}>
                  <span className="truncate">
                    {revealEnabled && !isRevealed && answers[currentQuestion] !== undefined ? "Reveal answer" : "Next"}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                </button>
              </div>
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
              onClick={(e) => { if (answeredCount > 0 && !window.confirm("Leave this session? Your progress is saved on this device, and you can resume it from the start screen.")) e.preventDefault(); }}
              className="flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700">Exit</Link>

          </aside>
        </div>
      </div>
      </main>
      {showCalc && <CalculatorPad onClose={() => setShowCalc(false)} />}

      {leaveOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/60 sm:items-center sm:p-4" role="alertdialog" aria-modal="true" aria-labelledby="leave-title">
          <div className="w-full max-w-md rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px] sm:p-6" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
            <h2 id="leave-title" className="text-xl font-black text-slate-900">Leave this {isExamMode ? "exam" : "session"}?</h2>
            <p className="mt-1 text-sm text-slate-500">
              Your answers are saved on this device, so you can pick up where you stopped.
              {timeLeft !== null && " The exam clock keeps its place while you are away."}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={stayInExam} className="h-12 touch-manipulation rounded-2xl bg-violet-600 text-sm font-bold text-white">
                Stay
              </button>
              <button type="button" onClick={leaveExam} className="h-12 touch-manipulation rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700">
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

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
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" /></div>}>
      <ExamPageContent />
    </Suspense>
  );
}
