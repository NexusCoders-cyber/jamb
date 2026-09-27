"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSubjectStats } from "@/lib/queries";
import { ALOC_SUBJECTS } from "@/lib/aloc";
import AppShell from "@/components/AppShell";
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
    <AppShell title="Syllabus">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-5xl lg:px-6">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="flex-1 text-2xl font-black text-slate-900">All Subjects</h1>
          <input type="search" placeholder="Search…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-36 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-400" />
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, i) => <div key={i} className="animate-pulse rounded-[24px] bg-white h-40 ring-1 ring-slate-100" />)}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <div key={item.slug} className="rounded-[24px] bg-white p-4 ring-1 ring-slate-100 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h2 className="text-base font-black text-slate-900">{item.name}</h2>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${item.mastery >= 70 ? "bg-emerald-100 text-emerald-700" : item.mastery >= 50 ? "bg-violet-100 text-violet-700" : item.mastery > 0 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"}`}>
                    {item.mastery > 0 ? `${item.mastery}%` : "—"}
                  </span>
                </div>
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full transition-all ${masteryColor(item.mastery)}`} style={{ width: `${item.mastery}%` }} />
                </div>
                <div className="flex gap-2">
                  <Link href={`/practice?subject=${encodeURIComponent(item.name)}&mode=study`}
                    className="flex-1 rounded-xl bg-violet-600 px-3 py-2 text-center text-xs font-bold text-white">Study</Link>
                  <Link href={`/practice?subject=${encodeURIComponent(item.name)}`}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-bold text-slate-700">Practice</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
