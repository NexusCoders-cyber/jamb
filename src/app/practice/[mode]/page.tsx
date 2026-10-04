"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { ALOC_SUBJECTS } from "@/lib/aloc";
import AppShell from "@/components/AppShell";
import { usePro } from "@/lib/usePro";
import { CURRENT_UTME_NOVEL } from "@/lib/setTexts";
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, Play, Loader2, Lock } from "lucide-react";

type ModeSlug = "past-questions" | "study" | "mock-cbt" | "novel";

const MODE_INFO: Record<
  ModeSlug,
  { label: string; tagline: string; examMode: "practice" | "study" | "exam"; accent: string }
> = {
  "past-questions": {
    label: "Past questions",
    tagline: "Browse every year ALOC has on record — pick a year, choose a topic and start.",
    examMode: "practice",
    accent: "violet",
  },
  study: {
    label: "Study mode",
    tagline: "The correct answer and explanation appear right after each question.",
    examMode: "study",
    accent: "violet",
  },
  "mock-cbt": {
    label: "Mock CBT",
    tagline: "Timed 180-question JAMB simulation — English plus three subjects.",
    examMode: "exam",
    accent: "emerald",
  },
  novel: {
    label: "Novel study",
    tagline: "Questions from the JAMB set text, practised on their own.",
    examMode: "study",
    accent: "amber",
  },
};

// Years ALOC covers — most recent first
const ALL_YEARS = [
  "2024", "2023", "2022", "2021", "2020",
  "2019", "2018", "2017", "2016", "2015",
  "2014", "2013", "2012", "2011", "2010",
  "2009", "2008", "2007", "2006", "2005",
  "2004", "2003", "2002", "2001", "2000",
  "1999", "1998", "1997", "1996", "1995",
  "1994", "1993", "1992", "1991", "1990",
  "1989", "1988", "1987", "1986", "1985",
];
const counts = [10, 20, 40];

// Only current set texts are offered. Retired JAMB English books live under /novels → Archived.
const NOVEL_TITLES = [
  CURRENT_UTME_NOVEL,
  "Nineteen Eighty-Four",
];

// ─── Topic category colours ───────────────────────────────────────────────────
const TOPIC_COLORS = [
  "bg-violet-50 text-violet-700 ring-violet-200",
  "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "bg-amber-50 text-amber-700 ring-amber-200",
  "bg-rose-50 text-rose-700 ring-rose-200",
  "bg-sky-50 text-sky-700 ring-sky-200",
  "bg-orange-50 text-orange-700 ring-orange-200",
];

type YearTopics = {
  year: string;
  topics: { name: string; count: number }[];
  total: number;
  loading: boolean;
  error: string | null;
};

// ─── Year row component ───────────────────────────────────────────────────────
function YearRow({
  year,
  subject,
  examMode,
  isOpen,
  onToggle,
  topicsData,
  onFetch,
  isPro,
}: {
  year: string;
  subject: string;
  examMode: string;
  isOpen: boolean;
  onToggle: () => void;
  topicsData: YearTopics | null;
  onFetch: (year: string) => void;
  isPro: boolean;
}) {
  const router = useRouter();

  function startYear(topic?: string) {
    if (!isPro) { router.push("/upgrade"); return; }
    const href = `/exam?mode=${examMode}&subject=${encodeURIComponent(subject)}&year=${encodeURIComponent(year)}&count=40${topic ? `&topic=${encodeURIComponent(topic)}` : ""}`;
    router.push(href);
  }

  const handleToggle = () => {
    onToggle();
    if (!topicsData) onFetch(year);
  };

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200 overflow-hidden transition">
      {/* Year header — always visible, clickable to expand */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-sm font-black text-white">
            {year.slice(2)}
          </span>
          <div>
            <p className="text-sm font-black text-slate-900">{year} UTME</p>
            {topicsData && !topicsData.loading && (
              <p className="text-[11px] text-slate-400">{topicsData.total} questions</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); startYear(); }}
            className="flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-violet-700"
          >
            <Play className="h-3 w-3" aria-hidden /> Start
          </button>
          {isOpen
            ? <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden />
            : <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />}
        </div>
      </button>

      {/* Expanded topics */}
      {isOpen && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          {topicsData?.loading ? (
            <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading topics…
            </div>
          ) : topicsData?.error ? (
            <p className="text-xs text-rose-500">{topicsData.error}</p>
          ) : topicsData && topicsData.topics.length > 0 ? (
            <>
              <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Topics — click to practise that topic only
              </p>
              <div className="flex flex-wrap gap-2">
                {topicsData.topics.map((t, i) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => startYear(t.name)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition hover:opacity-80 ${TOPIC_COLORS[i % TOPIC_COLORS.length]}`}
                  >
                    {t.name}
                    <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-black">
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-slate-400">
                Or <button type="button" onClick={() => startYear()} className="font-bold text-violet-600 hover:underline">start all {topicsData.total} questions</button> from this year
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-400">No topic breakdown for this year — start all questions below.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PracticeModePage() {
  const params = useParams<{ mode: string }>();
  const router = useRouter();
  const mode = (params.mode ?? "") as ModeSlug;
  const info = MODE_INFO[mode];

  const [subject, setSubject] = useState("English Language");
  const [questionCount, setQuestionCount] = useState(20);
  const [year, setYear] = useState("All years");
  const [novel, setNovel] = useState(NOVEL_TITLES[0]);
  const [mounted, setMounted] = useState(false);
  const { isPro, loading: proLoading } = usePro();

  // Year browser state
  const [openYear, setOpenYear] = useState<string | null>(null);
  const [yearData, setYearData] = useState<Record<string, YearTopics>>({});
  const [showAllYears, setShowAllYears] = useState(false);
  const displayYears = showAllYears ? ALL_YEARS : ALL_YEARS.slice(0, 10);

  useEffect(() => setMounted(true), []);

  // Reset year browser when subject changes
  useEffect(() => {
    setOpenYear(null);
    setYearData({});
  }, [subject]);

  const fetchTopicsForYear = useCallback(async (yr: string) => {
    // Mark as loading
    setYearData((prev) => ({
      ...prev,
      [yr]: { year: yr, topics: [], total: 0, loading: true, error: null },
    }));

    try {
      const res = await fetch(
        `/api/aloc?endpoint=questions&subject=${encodeURIComponent(subject)}&year=${encodeURIComponent(yr)}&type=utme`,
      );
      const json = (await res.json()) as { ok: boolean; data?: Array<{ category?: string | null }>; error?: string };

      if (!res.ok || !json.ok || !json.data) {
        setYearData((prev) => ({
          ...prev,
          [yr]: { year: yr, topics: [], total: 0, loading: false, error: json.error ?? "Could not load questions for this year." },
        }));
        return;
      }

      // Aggregate by category
      const catMap = new Map<string, number>();
      for (const q of json.data) {
        const cat = (q.category?.trim() ?? "General").replace(/\bquestions?\b/i, "").trim() || "General";
        catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
      }

      const topics = Array.from(catMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      setYearData((prev) => ({
        ...prev,
        [yr]: { year: yr, topics, total: json.data!.length, loading: false, error: null },
      }));
    } catch (_e) {
      setYearData((prev) => ({
        ...prev,
        [yr]: { year: yr, topics: [], total: 0, loading: false, error: "Network error — check your connection." },
      }));
    }
  }, [subject]);

  if (!info) {
    return (
      <AppShell title="Learn" back="/practice">
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <p className="text-xl font-black text-slate-900">Mode not found</p>
          <Link href="/practice" className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">
            Back to Learn
          </Link>
        </div>
      </AppShell>
    );
  }

  const accentBtn =
    mode === "novel"
      ? "bg-amber-600 hover:bg-amber-700 shadow-amber-300/30"
      : "bg-violet-600 hover:bg-violet-700 shadow-violet-300/30";

  // Whether to show the year browser (only for past-questions and study modes)
  const showYearBrowser = mode === "past-questions" || mode === "study";

  function start() {
    if (mode === "mock-cbt") {
      router.push("/exam?mode=exam");
      return;
    }
    if (mode === "novel") {
      const href = `/exam?mode=study&subject=${encodeURIComponent("English Language")}&count=${questionCount}${year !== "All years" ? `&year=${encodeURIComponent(year)}` : ""}&novel=${encodeURIComponent(novel)}`;
      router.push(href);
      return;
    }
    const href = `/exam?mode=${info.examMode}&subject=${encodeURIComponent(subject)}&count=${questionCount}${year !== "All years" ? `&year=${encodeURIComponent(year)}` : ""}`;
    router.push(href);
  }

  return (
    <AppShell title={info.label} back="/practice">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-3xl lg:px-6">

        {/* Back + header */}
        <div className="mb-4 flex items-center justify-between">
          <Link href="/practice" className="flex items-center gap-1.5 text-sm font-bold text-violet-600">
            <ArrowLeft className="h-4 w-4" aria-hidden /> All modes
          </Link>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {mode === "mock-cbt" ? "Exam mode" : mode === "novel" ? "Novel mode" : "Practice mode"}
          </span>
        </div>

        <div className={`mb-5 rounded-[28px] p-6 text-white shadow-xl ${mode === "novel" ? "bg-gradient-to-br from-amber-600 to-amber-500 shadow-amber-300/25" : "bg-gradient-to-br from-violet-600 to-violet-500 shadow-violet-300/25"}`}>
          {mode === "novel" && <BookOpen className="h-6 w-6 text-amber-100" aria-hidden />}
          <h1 className="mt-1 text-3xl font-black">{info.label}</h1>
          <p className="mt-2 text-sm text-white/85">{info.tagline}</p>
        </div>

        {/* ── Quick start card ── */}
        <div className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200 sm:p-6">
          <h2 className="mb-4 text-base font-black text-slate-900">Quick start</h2>

          {mode === "novel" ? (
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Which novel?</span>
              <select value={novel} onChange={(e) => setNovel(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-amber-500">
                {NOVEL_TITLES.map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Subject</span>
              <select value={subject} onChange={(e) => setSubject(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-500">
                {ALOC_SUBJECTS.map((s) => <option key={s.name}>{s.name}</option>)}
              </select>
            </label>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Questions</span>
              <div className="flex flex-wrap gap-2">
                {counts.map((c) => (
                  <button key={c} type="button" onClick={() => setQuestionCount(c)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-bold ${questionCount === c ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700 hover:border-violet-300"}`}>{c}</button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Year</span>
              <select value={year} onChange={(e) => setYear(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-500">
                <option value="All years">All years</option>
                <option value="random">Random year</option>
                {ALL_YEARS.map((y) => <option key={y}>{y}</option>)}
              </select>
            </label>
          </div>

          {/* Pro-gated start button */}
          {!proLoading && !isPro ? (
            <Link
              href={`/upgrade`}
              className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-base font-black text-white shadow-lg shadow-amber-300/30 transition hover:shadow-amber-300/50"
            >
              ⭐ Upgrade to Pro to start
            </Link>
          ) : (
            <button type="button" onClick={start} disabled={!mounted || proLoading}
              className={`mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-black text-white shadow-lg transition disabled:opacity-60 ${accentBtn}`}>
              <Play className="h-5 w-5" aria-hidden />
              {mode === "study" ? "Start studying" : mode === "novel" ? "Start novel practice" : mode === "mock-cbt" ? "Start mock CBT" : "Practise past questions"}
            </button>
          )}
        </div>

        {/* ── Year + Topics browser (past-questions and study only) ── */}
        {showYearBrowser && (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900">Browse by year</h2>
                <p className="text-xs text-slate-400">Click a year to see its topics, then start from any topic</p>
              </div>
              {/* Subject selector shortcut */}
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-violet-400"
              >
                {ALOC_SUBJECTS.map((s) => <option key={s.name}>{s.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              {displayYears.map((yr) => (
                <YearRow
                  key={yr}
                  year={yr}
                  subject={subject}
                  examMode={info.examMode}
                  isOpen={openYear === yr}
                  onToggle={() => setOpenYear(openYear === yr ? null : yr)}
                  topicsData={yearData[yr] ?? null}
                  onFetch={fetchTopicsForYear}
                  isPro={isPro}
                />
              ))}
            </div>

            {!showAllYears && (
              <button
                type="button"
                onClick={() => setShowAllYears(true)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                <ChevronDown className="h-4 w-4" aria-hidden />
                Show all {ALL_YEARS.length} years
              </button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
