"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ALOC_SUBJECTS } from "@/lib/aloc";
import AppShell from "@/components/AppShell";
import { ArrowLeft, BookOpen, Play } from "lucide-react";

type ModeSlug = "past-questions" | "study" | "mock-cbt" | "novel";

const MODE_INFO: Record<
  ModeSlug,
  { label: string; tagline: string; examMode: "practice" | "study" | "exam"; accent: string }
> = {
  "past-questions": {
    label: "Past questions",
    tagline: "Answer real UTME past questions, review every answer afterwards.",
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

const counts = [10, 20, 40];
const years = [
  "All years", "random", "2026", "2025", "2024", "2023", "2022", "2021", "2020",
  "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010",
  "2009", "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000",
  "1999", "1998", "1997", "1996", "1995", "1994", "1993", "1992", "1991", "1990",
  "1989", "1988", "1987", "1986", "1985",
];

const NOVEL_TITLES = [
  "The Lekki Headmaster",
  "The Life Changer",
  "Sweet Sixteen",
  "The Last Days at Forcados High",
  "Independence",
  "Nineteen Eighty-Four",
];

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

  useEffect(() => setMounted(true), []);

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

        <div className={`rounded-[28px] p-6 text-white shadow-xl ${mode === "novel" ? "bg-gradient-to-br from-amber-600 to-amber-500 shadow-amber-300/25" : "bg-gradient-to-br from-violet-600 to-violet-500 shadow-violet-300/25"}`}>
          {mode === "novel" && <BookOpen className="h-6 w-6 text-amber-100" aria-hidden />}
          <h1 className="mt-1 text-3xl font-black">{info.label}</h1>
          <p className="mt-2 text-sm text-white/85">{info.tagline}</p>
        </div>

        {/* Setup card */}
        <div className="mt-5 rounded-[24px] bg-white p-5 ring-1 ring-slate-200 sm:p-6">
          <h2 className="mb-4 text-base font-black text-slate-900">Set your session</h2>

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
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Past questions year</span>
              <select value={year} onChange={(e) => setYear(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-500">
                {years.map((y) => <option key={y}>{y}</option>)}
              </select>
            </label>
          </div>

          {mode === "novel" && (
            <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900 ring-1 ring-amber-200">
              Novel questions are matched by the title your exam year used. If the pool has no match for this year yet,
              switch the year or run a regular English session — the set-text questions appear inside it too.
            </div>
          )}
        </div>

        {/* Summary + start */}
        <div className="mt-5 rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{mode === "novel" ? "Novel" : "Subject"}</p>
              <p className="mt-0.5 font-black text-slate-900">{mode === "novel" ? novel : subject}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Questions</p>
              <p className="mt-0.5 font-black text-slate-900">{questionCount}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Year</p>
              <p className="mt-0.5 font-black text-slate-900">{year}</p>
            </div>
          </div>

          <button type="button" onClick={start} disabled={!mounted}
            className={`mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-black text-white shadow-lg transition disabled:opacity-60 ${accentBtn}`}>
            <Play className="h-5 w-5" aria-hidden />
            {mode === "study" ? "Start studying" : mode === "novel" ? "Start novel practice" : mode === "mock-cbt" ? "Start mock CBT" : "Practise past questions"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
