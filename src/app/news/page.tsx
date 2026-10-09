"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, WifiOff } from "lucide-react";
import AppShell from "@/components/AppShell";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchArticles, isNew, type Article } from "@/lib/blogClient";

export default function NewsPage() {
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try { supabase = createSupabaseBrowserClient(); } catch { return; }
    fetchArticles(supabase).then((r) => { if (alive) { setArticles(r.articles); setOffline(r.offline); } });
    return () => { alive = false; };
  }, []);

  return (
    <AppShell title="Blog">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:px-6">
        <h1 className="text-2xl font-black text-slate-900">Blog</h1>
        <p className="mt-1 text-sm text-slate-500">Study guides, exam strategy and news from the Qubit Learn team.</p>

        {offline && articles && articles.length > 0 && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden /> You&apos;re offline — showing articles saved on this phone.
          </p>
        )}

        <div className="mt-5 space-y-3">
          {articles === null ? (
            [1, 2, 3].map((n) => <div key={n} className="h-28 animate-pulse rounded-[24px] bg-white ring-1 ring-slate-100" />)
          ) : articles.length === 0 ? (
            <div className="rounded-[24px] bg-white p-8 text-center ring-1 ring-slate-200">
              <p className="text-lg font-black text-slate-900">{offline ? "You're offline" : "No articles yet"}</p>
              <p className="mt-1 text-sm text-slate-500">{offline ? "Connect to the internet to load the latest articles." : "New articles will show up here. Turn on notifications in Settings to hear about them first."}</p>
            </div>
          ) : (
            articles.map((a) => (
              <Link key={a.slug} href={`/news/${a.slug}`} className="block overflow-hidden rounded-[24px] bg-white ring-1 ring-slate-200 transition hover:ring-violet-300">
                {a.cover_image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.cover_image} alt="" loading="lazy" className="h-36 w-full object-cover" />
                )}
                <div className="p-4">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    {isNew(a) && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black uppercase text-white">New</span>}
                    {a.tags.slice(0, 2).map((t) => <span key={t} className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700">{t}</span>)}
                    {a.published_at && (
                      <time dateTime={a.published_at} className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                        {new Date(a.published_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </time>
                    )}
                  </div>
                  <h2 className="text-lg font-black leading-snug text-slate-900">{a.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{a.excerpt}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
