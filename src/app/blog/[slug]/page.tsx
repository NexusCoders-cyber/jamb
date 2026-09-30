import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";
import { CalendarDays, ArrowLeft } from "lucide-react";

export const revalidate = 60;

type Post = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
  published_at: string | null;
  updated_at: string;
};

async function getPost(slug: string): Promise<Post | null> {
  try {
    const { url, anonKey } = getSupabasePublicEnv();
    if (!url || !anonKey) return null;
    const supabase = createClient(url, anonKey);
    const { data } = await supabase
      .from("blog_posts")
      .select("slug, title, excerpt, body, tags, published_at, updated_at")
      .eq("slug", slug)
      .eq("is_published", true)
      .single();
    return (data as Post) ?? null;
  } catch {
    return null;
  }
}

export async function generateStaticParams() {
  try {
    const { url, anonKey } = getSupabasePublicEnv();
    if (!url || !anonKey) return [];
    const supabase = createClient(url, anonKey);
    const { data } = await supabase
      .from("blog_posts")
      .select("slug")
      .eq("is_published", true)
      .limit(200);
    return (data ?? []).map((p: { slug: string }) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post not found | Qubit" };

  return {
    title: `${post.title} | Qubit Blog`,
    description: post.excerpt,
    keywords: post.tags,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      url: `/blog/${post.slug}`,
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // JSON-LD — Article schema so Google shows rich results
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: { "@type": "Organization", name: "Qubit" },
    publisher: { "@type": "Organization", name: "Qubit" },
    mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
    keywords: post.tags.join(", "),
  };

  const paragraphs = post.body.split(/\n\s*\n/).filter(Boolean);

  return (
    <main className="min-h-screen bg-[#f5f4ff]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto max-w-2xl px-4 py-10 lg:px-6">
        <Link href="/blog" className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-violet-600 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> All articles
        </Link>

        <header className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">{tag}</span>
            ))}
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">{post.title}</h1>
          <p className="mt-3 text-lg leading-7 text-slate-600">{post.excerpt}</p>
          {post.published_at && (
            <time dateTime={post.published_at} className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              {new Date(post.published_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })} · Qubit Team
            </time>
          )}
        </header>

        <div className="space-y-5">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-base leading-8 text-slate-700">{p}</p>
          ))}
        </div>

        <footer className="mt-12 rounded-[28px] bg-gradient-to-r from-violet-600 to-violet-500 p-6 text-white">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-100">Prepare smarter</p>
          <h2 className="mt-2 text-2xl font-black">Practise with real past questions</h2>
          <p className="mt-1 text-sm text-violet-100">Qubit gives you JAMB past questions, mock CBT exams and personalised analytics — free.</p>
          <Link href="/dashboard" className="mt-4 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-black text-violet-700 hover:bg-violet-50">
            Start practising
          </Link>
        </footer>
      </article>
    </main>
  );
}
