"use client";

/**
 * Syllabus — subject grid. Clean landing list: every card links to that
 * subject's own page (/knowledge-hub/[subject]) where the syllabus content
 * (admin-uploaded) and practice links live.
 */

import Link from "next/link";
import { useState } from "react";
import { ALOC_SUBJECTS } from "@/lib/aloc";
import AppShell from "@/components/AppShell";

export default function KnowledgeHubPage() {
  const [search, setSearch] = useState("");

  const filtered = ALOC_SUBJECTS.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AppShell title="Syllabus">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-5xl lg:px-6">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="flex-1 text-2xl font-black text-slate-900">All Subjects</h1>
          <input type="search" placeholder="Search…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-36 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-400" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((subject) => (
            <Link key={subject.slug} href={`/knowledge-hub/${subject.slug}`}
              className="group rounded-[24px] bg-white p-5 ring-1 ring-slate-100 shadow-sm transition hover:ring-violet-300 hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-lg font-black text-violet-700 transition group-hover:bg-violet-600 group-hover:text-white">
                {subject.name.slice(0, 1)}
              </div>
              <h2 className="mt-3 text-base font-black text-slate-900">{subject.name}</h2>
              <p className="mt-1 flex items-center gap-1 text-xs font-bold text-violet-600">
                View syllabus →
              </p>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-400">No subject matches “{search}”.</p>
        )}
      </div>
    </AppShell>
  );
}
