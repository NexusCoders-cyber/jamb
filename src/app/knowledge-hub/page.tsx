"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSubjectStats } from "@/lib/queries";
import { ALOC_SUBJECTS } from "@/lib/aloc";
import type { SubjectStats } from "@/lib/queries";

type HubItem = { slug: string; name: string; mastery: number; total: number; accuracy: number };

export default function KnowledgeHubPage() {
  const { user, loading: authLoading } = useUser();
  const [items, setItems] = useState<HubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (authLoading) return;
    const base: HubItem[] = ALOC_SUBJECTS.map((s) => ({ slug: s.slug, name: s.name, mastery: 0, total: 0, accuracy: 0 }));

    if (!user) { setItems(base); setLoading(false); return; }

    const supabase = createSupabaseBrowserClient();
    getSubjectStats(supabase, user.id)
      .then((stats: SubjectStats[]) => {
        const statMap = new Map(stats.map((s) => [s.subjectName, s]));
        setItems(base.map((b) => {
          const s = statMap.get(b.name);
          return s ? { ...b, mastery: s.accuracy, total: s.total, accuracy: s.accuracy } : b;
        }));
      })
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  function masteryColor(pct: number) {
    if (pct >= 70) return "bg-emerald-500";
    if (pct >= 50) return "bg-violet-500";
    if (pct > 0) return "bg-rose-400";
    return "bg-slate-300";
  }

  return (
    <main className="min-h-screen bg-[#eef2ff] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[30px] bg-white p-6 ring-1 ring-slate-200 shadow-[0_18px_60px_rgba(93,74,228,0.1)]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500">Knowledge Hub</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">All Subjects &amp; Topics</h1>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="search" placeholder="Search subject…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-400 w-48"
            />
            <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              Dashboard
            </Link>
          </div>
        </div>

        {!user && !authLoading && (
          <div className="mb-5 rounded-[20px] bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 ring-1 ring-violet-100">
            <Link href="/" className="underline">Sign in</Link> to see your mastery percentages.
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, i) => <div key={i} className="animate-pulse rounded-[28px] bg-slate-100 h-44" />)}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <div key={item.slug} className="rounded-[28px] bg-slate-50 p-5 ring-1 ring-slate-200">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-500">{item.slug}</p>
                    <h2 className="mt-1 text-lg font-black text-slate-900">{item.name}</h2>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${item.mastery >= 70 ? "bg-emerald-100 text-emerald-700" : item.mastery >= 50 ? "bg-violet-100 text-violet-700" : item.mastery > 0 ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-500"}`}>
                    {item.mastery > 0 ? `${item.mastery}%` : "Not started"}
                  </span>
                </div>

                <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full transition-all ${masteryColor(item.mastery)}`} style={{ width: `${item.mastery}%` }} />
                </div>

                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Questions done</p>
                    <p className="mt-1 text-xl font-black text-slate-900">{item.total > 0 ? item.total : "—"}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Accuracy</p>
                    <p className="mt-1 text-xl font-black text-slate-900">{item.accuracy > 0 ? `${item.accuracy}%` : "—"}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Link href={`/practice?subject=${encodeURIComponent(item.name)}&mode=syllabus`}
                    className="flex-1 rounded-2xl bg-slate-900 px-4 py-2.5 text-center text-sm font-bold text-white">
                    Study
                  </Link>
                  <Link href={`/practice?subject=${encodeURIComponent(item.name)}&mode=past-questions`}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-bold text-slate-700">
                    Practice
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
