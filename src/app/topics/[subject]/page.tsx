"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpen, PencilLine, Shuffle } from "lucide-react";
import AppShell from "@/components/AppShell";
import { TOPIC_SUBJECTS, topicsForSlug } from "@/lib/topics";

/**
 * Topic list for one subject. Every topic links straight into the exam engine
 * with `topic=` set — study mode reveals answers as you go, practice mode
 * scores the session like a real test.
 */
export default function SubjectTopicsPage() {
  const params = useParams<{ subject: string }>();
  const raw = typeof params.subject === "string" ? params.subject : (params.subject?.[0] ?? "");
  const meta = TOPIC_SUBJECTS.find((s) => s.slug === raw);

  if (!meta) {
    return (
      <AppShell title="Topics">
        <div className="mx-auto max-w-2xl px-4 py-10 text-center">
          <p className="text-lg font-black text-slate-900">Subject not found</p>
          <p className="mt-2 text-sm text-slate-500">Pick a subject from the topics page.</p>
          <Link href="/topics" className="mt-4 inline-block rounded-full bg-violet-600 px-5 py-2.5 text-xs font-black text-white">
            All subjects
          </Link>
        </div>
      </AppShell>
    );
  }

  const topics = topicsForSlug(meta.slug);
  const subjectName = meta.name;

  const sessionHref = (topic: string, mode: "study" | "practice") =>
    `/exam?mode=${mode}&subject=${encodeURIComponent(subjectName)}&topic=${encodeURIComponent(topic)}&count=20`;

  return (
    <AppShell title={meta.name}>
      <div className="mx-auto max-w-2xl px-4 py-4 lg:px-6">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-2xl ring-1 ring-violet-100">
            {meta.emoji}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">{topics.length} syllabus topics</p>
            <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-900">{meta.name}</h1>
          </div>
        </div>

        <Link href={`/exam?mode=practice&subject=${encodeURIComponent(subjectName)}&count=20`}
          className="mb-5 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 px-5 py-4 text-white shadow-lg shadow-violet-400/30 transition hover:from-violet-700 hover:to-violet-600">
          <span>
            <span className="flex items-center gap-2 text-sm font-black">
              <Shuffle className="h-4 w-4" aria-hidden /> Mixed practice
            </span>
            <span className="mt-0.5 block text-xs text-violet-100">20 random questions from the whole subject</span>
          </span>
          <PencilLine className="h-5 w-5 shrink-0" aria-hidden />
        </Link>

        <div className="space-y-2.5">
          {topics.map((t, i) => (
            <div key={t.name} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-0.5 text-sm font-black text-slate-900">{t.name}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link href={sessionHref(t.name, "study")}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-50 text-xs font-black text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-100">
                  <BookOpen className="h-4 w-4" aria-hidden /> Study
                </Link>
                <Link href={sessionHref(t.name, "practice")}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 text-xs font-black text-white transition hover:bg-violet-700">
                  <PencilLine className="h-4 w-4" aria-hidden /> Practice
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-400">
          Study shows the correct answer after each question. Practice keeps answers hidden until you finish.
        </p>
      </div>
    </AppShell>
  );
}
