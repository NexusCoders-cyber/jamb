"use client";

import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import AppShell from "@/components/AppShell";
import { NOVELS } from "@/lib/novels";

export default function NovelsPage() {
  return (
    <AppShell title="Novels">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-4xl lg:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-black text-slate-900">Novel study</h1>
          <Link href="/practice/novel" className="rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white">
            Practise questions
          </Link>
        </div>
        <p className="mb-5 text-sm text-slate-500">
          Read the set texts in summary — story, characters and themes — then test yourself on exam-style questions.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {NOVELS.map((novel) => (
            <Link key={novel.slug} href={`/novels/${novel.slug}`}
              className="group rounded-[24px] bg-white p-5 ring-1 ring-slate-200 transition hover:ring-violet-300 hover:shadow-md">
              <span className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <BookOpen className="h-5 w-5" aria-hidden />
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                  {novel.examBody}
                </span>
              </span>
              <span className="mt-3 block text-lg font-black text-slate-900">{novel.title}</span>
              <span className="block text-xs font-semibold text-slate-400">{novel.author}</span>
              <span className="mt-2 block text-sm leading-6 text-slate-600">{novel.tagline}</span>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-violet-600">
                Read now <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
