"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, FileText, Library, ListChecks } from "lucide-react";

import AppShell from "@/components/AppShell";

type StudyMode = "past-questions" | "study" | "mock-cbt" | "syllabus";

const modes: { id: StudyMode; label: string; detail: string; href: string }[] = [
  {
    id: "past-questions",
    label: "Past questions",
    detail: "Pick a subject and year, then answer real UTME past questions.",
    href: "/practice/past-questions",
  },
  {
    id: "study",
    label: "Study mode",
    detail: "See the correct answer and explanation right after each question.",
    href: "/practice/study",
  },
  {
    id: "mock-cbt",
    label: "Mock CBT",
    detail: "Full 180-question JAMB simulation with the real exam rhythm.",
    href: "/exam",
  },
  {
    id: "syllabus",
    label: "Syllabus revision",
    detail: "Work through topics in the official JAMB syllabus.",
    href: "/knowledge-hub",
  },
];

const NOVELS = [
  { title: "The Lekki Headmaster", slug: "the-lekki-headmaster", note: "Current JAMB English text" },
  { title: "The Life Changer", slug: "the-life-changer", note: "Recent JAMB English text" },
  { title: "Sweet Sixteen", slug: "sweet-sixteen", note: "JAMB English text" },
  { title: "Nineteen Eighty-Four", slug: "nineteen-eighty-four", note: "Literature set text" },
];

export default function PracticePage() {
  return (
    <AppShell title="Learn">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-5xl lg:px-6">
        <h1 className="mb-4 text-2xl font-black text-slate-900 lg:hidden">Learn</h1>
        <div className="hidden lg:mb-6 lg:block">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-700">Smart preparation</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">What are you studying today?</h1>
        </div>

        {/* Mode cards — each opens its own dedicated page */}
        <div className="grid gap-3 md:grid-cols-3">
          {modes.map((item, i) => (
            <Link key={item.id} href={item.href}
              className="group min-h-28 rounded-2xl border border-slate-200 bg-white p-4 text-left text-slate-900 transition hover:border-violet-300 hover:shadow-md">
              <span className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">{String(i + 1).padStart(2, "0")}</span>
                <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-600" aria-hidden />
              </span>
              <span className="mt-3 block text-lg font-black">{item.label}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{item.detail}</span>
            </Link>
          ))}
        </div>

        {/* Novel study — JAMB set texts, separate from regular practice */}
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-700" aria-hidden />
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Novel study</p>
          </div>
          <h2 className="mt-2 text-xl font-black text-slate-950">JAMB set texts</h2>
          <p className="mt-1 text-sm text-slate-600">
            The English exam always includes questions from the year&apos;s set novel. Read it separately before practising.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {NOVELS.map((n) => (
              <Link key={n.slug} href={`/novels/${n.slug}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3 text-left transition hover:border-amber-400">
                <span>
                  <span className="block text-sm font-black text-slate-900">{n.title}</span>
                  <span className="block text-xs text-slate-500">{n.note}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              </Link>
            ))}
            <Link href="/novels"
              className="col-span-full flex items-center justify-between gap-3 rounded-xl bg-amber-600 px-4 py-3 text-left text-sm font-black text-white transition hover:bg-amber-700">
              Open the novel reader
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
