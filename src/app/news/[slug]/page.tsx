"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, WifiOff } from "lucide-react";
import AppShell from "@/components/AppShell";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchArticle, markRead, type Article } from "@/lib/blogClient";

export default function NewsArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null | undefined>(undefined);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try { supabase = createSupabaseBrowserClient(); } catch { return; }
    fetchArticle(supabase, slug).then((r) => {
      if (!alive) return;
      setArticle(r.article); setOffline(r.offline);
      if (r.article) markRead(slug);
    });
    return () => { alive = false; };
  }, [slug]);

  const paragraphs = (article?.body ?? "").split(/\n\s*\n/).filter(Boolean);

  return (
    <AppShell title="Blog" back="/news">
      <article className="mx-auto max-w-2xl px-4 py-4 lg:px-6">
        <Link href="/news" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-violet-600 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> All articles
        </Link>

        {article === undefined ? (
          <div className="space-y-3"><div className="h-8 w-3/4 animate-pulse rounded bg-slate-200" /><div className="h-4 animate-pulse rounded bg-slate-100" /><div className="h-4 animate-pulse rounded bg-slate-100" /></div>
        ) : article === null ? (
          <div className="rounded-[24px] bg-white p-8 text-center ring-1 ring-slate-200">
            <p className="text-lg font-black text-slate-900">{offline ? "This article isn't saved on your phone" : "Article not found"}</p>
            <p className="mt-1 text-sm text-slate-500">{offline ? "Connect to the internet and open it once — after that it's available offline." : "It may have been removed."}</p>
            <Link href="/news" className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">Back to the blog</Link>
          </div>
        ) : (
          <>
            {offline && (
              <p className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                <WifiOff className="h-4 w-4 shrink-0" aria-hidden /> Offline — this is the copy saved on your phone.
              </p>
            )}
            {article.cover_image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={article.cover_image} alt="" className="mb-4 h-48 w-full rounded-[24px] object-cover" />
            )}
            <div className="mb-2 flex flex-wrap gap-2">
              {article.tags.map((t) => <span key={t} className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">{t}</span>)}
            </div>
            <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-900">{article.title}</h1>
            {article.published_at && (
              <time dateTime={article.published_at} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                {new Date(article.published_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })} · Qubit Learn Team
              </time>
            )}
            <div className="mt-6 space-y-5">
              {paragraphs.map((p, i) => <p key={i} className="whitespace-pre-line text-base leading-8 text-slate-700">{p}</p>)}
            </div>
            <Link href="/practice" className="mt-10 block rounded-[24px] bg-gradient-to-r from-violet-600 to-violet-500 p-5 text-white">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-100">Ready?</p>
              <p className="mt-1 text-lg font-black">Put it into practice →</p>
            </Link>
          </>
        )}
      </article>
    </AppShell>
  );
}
