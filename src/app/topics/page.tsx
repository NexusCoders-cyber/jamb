import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import AppShell from "@/components/AppShell";
import { TOPIC_SUBJECTS, topicCountForSlug } from "@/lib/topics";

export default function TopicsPage() {
  return (
    <AppShell title="Topics">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-5xl lg:px-6">
        <div className="mb-5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-700">
            <Layers className="h-3.5 w-3.5" aria-hidden /> Learn by topic
          </p>
          <h1 className="mt-1 hidden text-3xl font-black tracking-tight text-slate-900 lg:block">
            Pick a subject to see its topics
          </h1>
          <h1 className="mt-1 text-2xl font-black text-slate-900 lg:hidden">Topics</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Every subject follows the official JAMB syllabus. Choose a subject, tap a topic, and start
            studying or practising straight away — no year-picking needed.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOPIC_SUBJECTS.map((s) => (
            <Link key={s.slug} href={`/topics/${s.slug}`}
              className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-violet-300 hover:shadow-md">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-xl ring-1 ring-violet-100">
                {s.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-slate-900">{s.name}</span>
                <span className="block text-xs text-slate-500">
                  {topicCountForSlug(s.slug)} topics · study or practise
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-600" aria-hidden />
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
