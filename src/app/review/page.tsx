"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Flag, XCircle } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import ExplanationView from "@/components/ExplanationView";
import QuestionImage from "@/components/QuestionImage";
import RichText from "@/components/RichText";
import { getAttempt, getAttemptAnswers } from "@/lib/queries";
import type { AttemptAnswer, ExamAttempt, QuestionSnapshot } from "@/lib/queries";

type Status = "correct" | "wrong" | "unanswered";
type Filter = "all" | "wrong" | "unanswered" | "correct" | "marked";

type Entry = {
  id: string;
  q: QuestionSnapshot;
  status: Status;
  marked: boolean;
  subject: string;
  /** Number inside its own subject, exactly as the student saw it in the exam */
  number: number;
  selected: number | null;
};

const MISSING: Omit<QuestionSnapshot, "id"> = {
  prompt: "The details of this question were not saved for this attempt.",
  options: [],
  correct_option: -1,
  explanation: null,
  difficulty: "medium",
};

const STATUS_LABEL: Record<Status, string> = { correct: "Correct", wrong: "Wrong", unanswered: "Unanswered" };
const STATUS_CHIP: Record<Status, string> = {
  correct: "bg-emerald-100 text-emerald-700",
  wrong: "bg-rose-100 text-rose-700",
  unanswered: "bg-slate-200 text-slate-700",
};
const MAP_CHIP: Record<Status, string> = {
  correct: "bg-emerald-100 text-emerald-800",
  wrong: "bg-rose-100 text-rose-700",
  unanswered: "bg-slate-200 text-slate-600",
};
const short = (n: string) => n.replace(" Language", "");

function statusOf(a: AttemptAnswer): Status {
  if (a.selected_option === null || a.selected_option === undefined) return "unanswered";
  return a.is_correct ? "correct" : "wrong";
}

function buildEntries(answers: AttemptAnswer[]): Entry[] {
  const counters = new Map<string, number>();
  // Numbers saved with the question win; older attempts are numbered 1..n inside each subject.
  const useSaved = answers.length > 0 && answers.every((a) => typeof a.question?.subject_number === "number");
  return answers.map((a) => {
    const q = a.question ?? ({ id: a.question_id, ...MISSING } as QuestionSnapshot);
    const subject = q.subject_name || "Questions";
    const next = (counters.get(subject) ?? 0) + 1;
    counters.set(subject, next);
    return {
      id: a.id,
      q,
      status: statusOf(a),
      marked: !!a.marked_for_review,
      subject,
      number: useSaved ? (q.subject_number as number) : next,
      selected: a.selected_option ?? null,
    };
  });
}

const imagesOf = (q: QuestionSnapshot): string[] => (q.images?.length ? q.images : q.image ? [q.image] : []);

function Spinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
    </div>
  );
}

function ReviewContent() {
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useUser();
  const attemptId = searchParams.get("attemptId");

  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [subjectTab, setSubjectTab] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const userPicked = useRef(false);

  useEffect(() => {
    if (authLoading || !user || !attemptId) return;
    const supabase = createSupabaseBrowserClient();
    Promise.all([getAttempt(supabase, attemptId), getAttemptAnswers(supabase, attemptId)])
      .then(([att, rows]) => {
        const built = buildEntries(rows);
        setAttempt(att);
        setEntries(built);
        setSelectedId((built.find((e) => e.status !== "correct") ?? built[0])?.id ?? null);
      })
      .finally(() => setLoaded(true));
  }, [user, authLoading, attemptId]);

  // Nothing to fetch without a signed-in user and an attempt id
  const loading = authLoading ? true : !!user && !!attemptId && !loaded;

  // ── derived ────────────────────────────────────────────────────────────────
  const subjects = useMemo(() => {
    const order: string[] = [];
    entries.forEach((e) => {
      if (!order.includes(e.subject)) order.push(e.subject);
    });
    return order.map((name) => {
      const list = entries.filter((e) => e.subject === name);
      const correct = list.filter((e) => e.status === "correct").length;
      return {
        name,
        total: list.length,
        correct,
        wrong: list.filter((e) => e.status === "wrong").length,
        unanswered: list.filter((e) => e.status === "unanswered").length,
        pct: list.length > 0 ? Math.round((correct / list.length) * 100) : 0,
      };
    });
  }, [entries]);
  const multi = subjects.length > 1;

  const scope = useMemo(() => (subjectTab ? entries.filter((e) => e.subject === subjectTab) : entries), [entries, subjectTab]);
  const counts = useMemo(
    () => ({
      all: scope.length,
      wrong: scope.filter((e) => e.status === "wrong").length,
      unanswered: scope.filter((e) => e.status === "unanswered").length,
      correct: scope.filter((e) => e.status === "correct").length,
      marked: scope.filter((e) => e.marked).length,
    }),
    [scope],
  );
  const visible = useMemo(
    () => scope.filter((e) => (filter === "all" ? true : filter === "marked" ? e.marked : e.status === filter)),
    [scope, filter],
  );
  const current = visible.find((e) => e.id === selectedId) ?? visible[0] ?? null;
  const currentIdx = current ? visible.indexOf(current) : -1;

  const select = useCallback((id: string) => {
    userPicked.current = true;
    setSelectedId(id);
  }, []);
  const go = useCallback(
    (delta: number) => {
      if (currentIdx < 0) return;
      const target = visible[currentIdx + delta];
      if (target) select(target.id);
    },
    [visible, currentIdx, select],
  );
  const nextMistake = useCallback(() => {
    if (!current) return;
    const at = scope.indexOf(current);
    for (let i = 1; i <= scope.length; i++) {
      const e = scope[(at + i) % scope.length];
      if (e.status !== "correct" && e.id !== current.id) {
        // the target may be hidden by the current filter
        if (!visible.includes(e)) setFilter("all");
        select(e.id);
        return;
      }
    }
  }, [current, scope, visible, select]);
  const hasMistake = !!current && scope.some((e) => e.status !== "correct" && e.id !== current.id);

  // On phones the detail sits below the question map: bring it into view after the student taps a question.
  useEffect(() => {
    if (!userPicked.current || !current || typeof window === "undefined" || window.innerWidth >= 1024) return;
    document.getElementById("review-detail")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Desktop: ← / → move between questions
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // ── screens ────────────────────────────────────────────────────────────────
  if (authLoading || loading) return <Spinner />;

  if (!user) {
    return (
      <AuthGuard user={null} loading={false}>
        <></>
      </AuthGuard>
    );
  }

  if (!attemptId || entries.length === 0) {
    return (
      <AppShell title="Review" back="/analytics">
        <div className="px-4 py-8">
          <div className="mx-auto max-w-md rounded-[28px] bg-white p-8 text-center ring-1 ring-slate-200">
            <p className="text-lg font-bold text-slate-900">No answers to review</p>
            <p className="mt-2 text-sm text-slate-500">
              {attemptId ? "No answers were saved for this attempt." : "Open an exam from your Analytics page, or finish an exam first."}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Link href="/analytics" className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">
                Analytics
              </Link>
              <Link href="/practice" className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">
                Practise
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // Header numbers: from the attempt when we have it, otherwise from the rows
  const answeredCorrect = entries.filter((e) => e.status === "correct").length;
  const total = Math.max(attempt?.question_count ?? 0, entries.length);
  const score = attempt?.score ?? answeredCorrect;
  const pctAll = total > 0 ? Math.round((score / total) * 100) : 0;
  const unanswered = Math.max(entries.filter((e) => e.status === "unanswered").length, total - entries.length);
  const unrecorded = Math.max(0, total - entries.length); // older attempts did not save blank questions
  const wrong = entries.filter((e) => e.status === "wrong").length;
  let timeUsed: string | null = null;
  if (attempt?.started_at && attempt?.submitted_at) {
    const ms = new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime();
    if (ms > 0) timeUsed = `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  const q = current?.q;
  const options = q?.options ?? [];
  const groups = (subjectTab ? [subjectTab] : subjects.map((s) => s.name)).map((name) => ({
    name,
    items: scope.filter((e) => e.subject === name),
  }));

  return (
    <AppShell title="Review" back="/analytics" hideBottomNav>
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-5xl lg:px-6" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-black text-slate-900">Review answers</h1>
          <div className="flex gap-2">
            <Link href={`/results?attemptId=${attemptId}`} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
              Results
            </Link>
            <Link href="/analytics" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
              Analytics
            </Link>
          </div>
        </div>

        {/* Summary */}
        <section className="rounded-[26px] bg-gradient-to-br from-[#41348f] to-[#6557d9] p-5 text-white">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200">
                {attempt?.submitted_at ? new Date(attempt.submitted_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "Your attempt"}
                {timeUsed ? ` · ${timeUsed}` : ""}
              </p>
              <p className="mt-1 text-4xl font-black tabular-nums">
                {score}
                <span className="text-xl font-bold text-violet-200"> / {total}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black tabular-nums">{pctAll}%</p>
              <p className="text-xs font-semibold text-violet-200">{total > 0 ? Math.round((score / total) * 400) : 0} / 400 estimate</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Correct", value: answeredCorrect, tone: "text-emerald-300" },
              { label: "Wrong", value: wrong, tone: "text-rose-300" },
              { label: "Unanswered", value: unanswered, tone: "text-slate-200" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-white/10 px-2 py-2.5 ring-1 ring-white/10">
                <p className={`text-xl font-black tabular-nums ${s.tone}`}>{s.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-200">{s.label}</p>
              </div>
            ))}
          </div>
          {unrecorded > 0 && entries.every((e) => e.status !== "unanswered") && (
            <p className="mt-3 text-[11px] leading-5 text-violet-200">Blank questions were not saved for this older attempt, so only your {entries.length} answered questions can be reviewed.</p>
          )}
        </section>

        {/* Subject cards */}
        {multi && (
          <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {subjects.map((s) => {
              const active = subjectTab === s.name;
              return (
                <button
                  key={s.name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSubjectTab(active ? null : s.name)}
                  className={`touch-manipulation rounded-[20px] p-3.5 text-left ring-1 transition ${active ? "bg-violet-600 text-white ring-violet-600 shadow-lg shadow-violet-200" : "bg-white text-slate-800 ring-slate-200 hover:ring-violet-300"}`}
                >
                  <p className="truncate text-[11px] font-black uppercase tracking-[0.14em] opacity-70">{short(s.name)}</p>
                  <p className="mt-0.5 text-2xl font-black tabular-nums">
                    {s.correct}
                    <span className="text-sm font-bold opacity-60">/{s.total}</span>
                  </p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/10">
                    <div className={`h-full rounded-full ${active ? "bg-white" : s.pct >= 70 ? "bg-emerald-500" : s.pct >= 60 ? "bg-violet-500" : "bg-rose-400"}`} style={{ width: `${s.pct}%` }} />
                  </div>
                  <p className="mt-1.5 text-[10px] font-semibold opacity-80">
                    {s.wrong} wrong · {s.unanswered} blank
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {/* Filters */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ["all", `All (${counts.all})`],
              ["wrong", `Wrong (${counts.wrong})`],
              ["unanswered", `Unanswered (${counts.unanswered})`],
              ["correct", `Correct (${counts.correct})`],
              ["marked", `Marked (${counts.marked})`],
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`shrink-0 touch-manipulation rounded-full px-4 py-1.5 text-sm font-bold transition ${
                filter === f
                  ? f === "wrong" ? "bg-rose-600 text-white" : f === "correct" ? "bg-emerald-600 text-white" : f === "marked" ? "bg-amber-500 text-white" : f === "unanswered" ? "bg-slate-600 text-white" : "bg-slate-900 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
          {/* Question map */}
          <aside className="rounded-[26px] bg-slate-50 p-4 ring-1 ring-slate-200 lg:sticky lg:top-4">
            <h2 className="mb-3 text-base font-black text-slate-900">Question map</h2>
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {groups.map((g) => (
                <div key={g.name}>
                  {(multi && !subjectTab) && <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{short(g.name)}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {g.items.map((e) => {
                      const shown = visible.includes(e);
                      const isCurrent = current?.id === e.id;
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => {
                            if (!shown) setFilter("all");
                            select(e.id);
                          }}
                          aria-label={`${short(e.subject)} question ${e.number}, ${STATUS_LABEL[e.status]}${e.marked ? ", marked" : ""}`}
                          aria-current={isCurrent}
                          className={`relative flex h-9 w-9 touch-manipulation items-center justify-center rounded-xl text-xs font-bold transition ${MAP_CHIP[e.status]} ${isCurrent ? "ring-2 ring-violet-600 ring-offset-1" : ""} ${shown ? "" : "opacity-35"}`}
                        >
                          {e.number}
                          {e.marked && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-slate-50" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-emerald-200" /> Correct</span>
              <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-rose-200" /> Wrong</span>
              <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-slate-300" /> Unanswered</span>
              <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Marked</span>
            </div>
          </aside>

          {/* Question detail */}
          <section id="review-detail" className="scroll-mt-20 rounded-[26px] bg-slate-50 p-4 ring-1 ring-slate-200 sm:p-6">
            {current && q ? (
              <>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">
                      {short(current.subject)} · Question {current.number}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_CHIP[current.status]}`}>{STATUS_LABEL[current.status]}</span>
                      {current.marked && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                          <Flag className="h-3 w-3" aria-hidden /> Marked
                        </span>
                      )}
                      {q.year && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">{q.year}</span>}
                      {q.novel && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">{q.novel}</span>}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    {currentIdx + 1} of {visible.length}
                  </span>
                </div>

                <div className="rounded-[22px] bg-white p-4 ring-1 ring-slate-200 sm:p-5">
                  {q.section && q.section_kind === "passage" && (
                    <details className="mb-4 rounded-[18px] bg-amber-50 ring-1 ring-amber-100">
                      <summary className="cursor-pointer select-none px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-amber-800">Passage · tap to read</summary>
                      <div className="max-h-[50dvh] overflow-y-auto px-4 pb-4">
                        <p className="whitespace-pre-line text-[15px] leading-7 text-slate-800">{q.section}</p>
                        {(q.section_images?.length ?? 0) > 0 && (
                          <div className="mt-3 grid gap-3">{q.section_images!.map((src) => <QuestionImage key={src} src={src} />)}</div>
                        )}
                      </div>
                    </details>
                  )}
                  {q.section && q.section_kind !== "passage" && <p className="mb-3 whitespace-pre-line rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{q.section}</p>}
                  {imagesOf(q).length > 0 && (
                    <div className={`mb-4 grid gap-3 ${imagesOf(q).length > 1 ? "sm:grid-cols-2" : ""}`}>
                      {imagesOf(q).map((src) => <QuestionImage key={src} src={src} />)}
                    </div>
                  )}

                  <p className="text-base font-semibold leading-7 text-slate-800 sm:text-lg sm:leading-8">
                    <RichText segments={q.prompt_segments} fallback={q.prompt} />
                  </p>

                  {current.status === "unanswered" && options.length > 0 && (
                    <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                      You did not answer this question. The correct answer is {String.fromCharCode(65 + q.correct_option)}.
                    </p>
                  )}
                  {current.status === "wrong" && current.selected !== null && (
                    <p className="mt-3 text-sm font-semibold text-slate-600">
                      You chose <span className="text-rose-600">{String.fromCharCode(65 + current.selected)}</span> · correct answer{" "}
                      <span className="text-emerald-700">{String.fromCharCode(65 + q.correct_option)}</span>
                    </p>
                  )}

                  <div className="mt-4 space-y-2.5">
                    {options.map((opt, idx) => {
                      const isCorrect = idx === q.correct_option;
                      const isYours = idx === current.selected;
                      const img = q.option_images?.[idx] ?? null;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-sm ${
                            isCorrect ? "border-emerald-400 bg-emerald-50 font-semibold text-emerald-900" : isYours ? "border-rose-300 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-700"
                          }`}
                        >
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${isCorrect ? "bg-emerald-500 text-white" : isYours ? "bg-rose-400 text-white" : "bg-slate-100 text-slate-500"}`}>
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="min-w-0 flex-1 break-words">
                            {img && <QuestionImage key={img} src={img} zoomable={false} compact className={opt ? "mb-2" : ""} />}
                            <RichText segments={q.option_segments?.[idx]} fallback={opt} />
                          </span>
                          {isCorrect && (
                            <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-700">
                              <Check className="h-3.5 w-3.5" aria-hidden /> Correct
                            </span>
                          )}
                          {isYours && !isCorrect && (
                            <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-bold text-rose-600">
                              <XCircle className="h-3.5 w-3.5" aria-hidden /> Your answer
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                    <p className="text-sm font-bold text-emerald-800">Explanation</p>
                    {q.explanation ? (
                      <ExplanationView text={q.explanation} subject={q.subject_name} images={q.explanation_images ?? undefined} className="mt-2.5" />
                    ) : (
                      <p className="mt-1.5 text-sm text-slate-500">No explanation is available for this question yet.</p>
                    )}
                  </div>
                </div>

                {/* Navigation */}
                <div className="sticky bottom-0 z-20 -mx-4 -mb-4 mt-5 flex items-center justify-between gap-2 rounded-b-[26px] border-t border-slate-200 bg-slate-50/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
                  <button
                    type="button"
                    onClick={nextMistake}
                    disabled={!hasMistake}
                    className="inline-flex touch-manipulation items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-40 sm:px-4 sm:text-sm"
                  >
                    <XCircle className="h-4 w-4 text-rose-500" aria-hidden /> Next mistake
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => go(-1)}
                      disabled={currentIdx <= 0}
                      aria-label="Previous question"
                      className="inline-flex touch-manipulation items-center justify-center gap-1 rounded-2xl border-2 border-slate-300 bg-white px-3 py-[10px] text-sm font-bold text-slate-800 disabled:opacity-40 sm:px-5"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => go(1)}
                      disabled={currentIdx < 0 || currentIdx >= visible.length - 1}
                      aria-label="Next question"
                      className="inline-flex touch-manipulation items-center justify-center gap-1 rounded-2xl bg-violet-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-40 sm:px-5"
                    >
                      Next <ChevronRight className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p className="py-10 text-center text-sm text-slate-400">No questions match this filter.</p>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ReviewContent />
    </Suspense>
  );
}
