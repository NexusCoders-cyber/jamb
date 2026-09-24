"use client";

import Link from "next/link";
import { useState } from "react";
import { ALOC_SUBJECTS } from "@/lib/aloc";

type StudyMode = "past-questions" | "mock-cbt" | "syllabus";

const modes: { id: StudyMode; label: string; detail: string }[] = [
  { id: "past-questions", label: "Past questions", detail: "Study questions from previous UTME sessions." },
  { id: "mock-cbt", label: "Mock CBT", detail: "Sit a timed exam with the real CBT rhythm." },
  { id: "syllabus", label: "Syllabus revision", detail: "Work through topics before attempting questions." },
];

const counts = [10, 20, 40];
const years = ["All years", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2010", "2005"];
const timers = ["No timer", "15 minutes", "30 minutes", "1 hour"];

const SUBJECT_TOPICS: Record<string, string[]> = {
  "English Language": ["Comprehension", "Lexis and Structure", "Oral English", "Summary", "Essay"],
  "Mathematics": ["Algebra", "Geometry", "Statistics", "Probability", "Trigonometry", "Calculus"],
  "Physics": ["Mechanics", "Waves", "Electricity", "Magnetism", "Optics", "Modern Physics"],
  "Chemistry": ["Organic Chemistry", "Mole Concept", "Acids and Bases", "Electrochemistry", "Periodic Table"],
  "Biology": ["Cell Biology", "Genetics", "Ecology", "Plant Biology", "Human Physiology"],
  "Government": ["Constitution", "Political Parties", "Citizenship", "Legislature", "Democracy"],
  "Economics": ["Demand and Supply", "National Income", "Money and Banking", "International Trade"],
  "Geography": ["Map Reading", "Climate", "Population", "Rocks and Minerals", "Transportation"],
  "Commerce": ["Trade", "Insurance", "Banking", "Warehousing", "Marketing"],
  "Accounting": ["Final Accounts", "Ledger", "Trial Balance", "Depreciation", "Partnership"],
  "Literature in English": ["Prose", "Poetry", "Drama", "Literary Devices"],
  "Christian Religious Knowledge": ["Old Testament", "New Testament", "Church History"],
  "Islamic Religious Knowledge": ["Tawheed", "Fiqh", "Seerah", "Quran"],
  "Civic Education": ["Democracy", "Human Rights", "Citizenship", "Rule of Law"],
  "Insurance": ["Principles", "Types of Insurance", "Marine", "Life Insurance"],
  "History": ["Pre-colonial Nigeria", "Colonial Era", "Independence", "Post-independence"],
  "Current Affairs": ["Politics", "Economy", "Science", "Sports", "International"],
};

export default function PracticePage() {
  const [mode, setMode] = useState<StudyMode>("past-questions");
  const [selectedSubject, setSelectedSubject] = useState(ALOC_SUBJECTS[0].name);
  const [selectedTopic, setSelectedTopic] = useState("All topics");
  const [questionCount, setQuestionCount] = useState(20);
  const [year, setYear] = useState("All years");
  const [timer, setTimer] = useState("30 minutes");

  const topics = SUBJECT_TOPICS[selectedSubject] ?? [];

  const examHref = `/exam?subject=${encodeURIComponent(selectedSubject)}&count=${questionCount}&timer=${encodeURIComponent(timer)}&mode=${mode}&topic=${encodeURIComponent(selectedTopic)}${year !== "All years" ? `&year=${year}` : ""}`;

  function changeSubject(name: string) {
    setSelectedSubject(name);
    setSelectedTopic("All topics");
  }

  return (
    <main className="min-h-screen bg-[#f2f7f3] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Smart preparation</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">What are you studying today?</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Choose a subject, revise your syllabus, practise past questions, or sit a timed CBT simulation.
            </p>
          </div>
          <Link href="/dashboard" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:border-emerald-300">
            Dashboard
          </Link>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="space-y-6">
            {/* Mode selector */}
            <div className="grid gap-3 md:grid-cols-3">
              {modes.map((item, i) => (
                <button key={item.id} type="button" onClick={() => setMode(item.id)}
                  className={`min-h-28 rounded-2xl border p-4 text-left transition ${mode === item.id ? "border-emerald-600 bg-emerald-800 text-white shadow-lg" : "border-slate-200 bg-white text-slate-900 hover:border-emerald-300"}`}>
                  <span className={`text-xs font-bold uppercase tracking-[0.16em] ${mode === item.id ? "text-emerald-100" : "text-emerald-700"}`}>{String(i + 1).padStart(2, "0")}</span>
                  <span className="mt-3 block text-lg font-black">{item.label}</span>
                  <span className={`mt-1 block text-xs leading-5 ${mode === item.id ? "text-emerald-50" : "text-slate-500"}`}>{item.detail}</span>
                </button>
              ))}
            </div>

            {/* All ALOC subjects */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Choose a subject</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">All UTME subjects</h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{ALOC_SUBJECTS.length} subjects</span>
              </div>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {ALOC_SUBJECTS.map((s) => (
                  <button key={s.name} type="button" onClick={() => changeSubject(s.name)}
                    className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition ${selectedSubject === s.name ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 hover:border-emerald-300"}`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-black ${selectedSubject === s.name ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"}`}>
                      {s.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="text-xs font-bold leading-4 text-slate-800">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Session config */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{selectedSubject}</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">Set your session</h2>
                </div>
                <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 sm:inline-flex">
                  {mode === "mock-cbt" ? "Exam mode" : mode === "syllabus" ? "Revision mode" : "Practice mode"}
                </span>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">Topic</span>
                  <select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500">
                    <option>All topics</option>
                    {topics.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">Year</span>
                  <select value={year} onChange={(e) => setYear(e.target.value)} disabled={mode !== "past-questions"}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400">
                    {years.map((y) => <option key={y}>{y}</option>)}
                  </select>
                </label>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <span className="mb-2 block text-sm font-bold text-slate-700">Questions</span>
                  <div className="flex flex-wrap gap-2">
                    {counts.map((c) => (
                      <button key={c} type="button" onClick={() => setQuestionCount(c)}
                        className={`rounded-xl px-4 py-2.5 text-sm font-bold ${questionCount === c ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700 hover:border-emerald-300"}`}>{c}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="mb-2 block text-sm font-bold text-slate-700">Timer</span>
                  <div className="flex flex-wrap gap-2">
                    {timers.map((t) => (
                      <button key={t} type="button" onClick={() => setTimer(t)}
                        className={`rounded-xl px-4 py-2.5 text-sm font-bold ${timer === t ? "bg-emerald-700 text-white" : "border border-slate-200 bg-white text-slate-700 hover:border-emerald-300"}`}>{t}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Session summary sidebar */}
          <aside className="h-fit rounded-2xl bg-[#102e27] p-5 text-white shadow-xl xl:sticky xl:top-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Session summary</p>
            <h2 className="mt-3 text-2xl font-black">
              {mode === "mock-cbt" ? "Timed mock CBT" : mode === "syllabus" ? "Syllabus revision" : "Past questions"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-emerald-50/80">
              {selectedSubject} · {selectedTopic.toLowerCase()}.
            </p>

            <div className="mt-6 divide-y divide-white/10 rounded-xl border border-white/10 bg-white/5">
              <div className="flex items-center justify-between p-4 text-sm"><span className="text-emerald-100/70">Subject</span><strong className="truncate ml-2">{selectedSubject}</strong></div>
              <div className="flex items-center justify-between p-4 text-sm"><span className="text-emerald-100/70">Questions</span><strong>{questionCount}</strong></div>
              <div className="flex items-center justify-between p-4 text-sm"><span className="text-emerald-100/70">Time</span><strong>{timer}</strong></div>
              {mode === "past-questions" && <div className="flex items-center justify-between p-4 text-sm"><span className="text-emerald-100/70">Year</span><strong>{year}</strong></div>}
              <div className="flex items-center justify-between p-4 text-sm"><span className="text-emerald-100/70">Topic</span><strong className="truncate ml-2">{selectedTopic}</strong></div>
            </div>

            <Link href={examHref} className="mt-6 flex w-full items-center justify-center rounded-xl bg-[#e8c96a] px-4 py-3 text-sm font-black text-[#172c26] transition hover:bg-[#f1d987]">
              {mode === "syllabus" ? "Start revision" : mode === "mock-cbt" ? "Start mock CBT" : "Practise past questions"}
            </Link>
            <Link href="/knowledge-hub" className="mt-3 flex h-11 w-full items-center justify-center rounded-xl border border-white/15 text-sm font-bold text-white hover:bg-white/10">
              Browse syllabus
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
