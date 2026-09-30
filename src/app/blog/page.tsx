import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";
import { CalendarDays, ArrowRight } from "lucide-react";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Blog | Orbit Prep — UTME & JAMB study guides",
  description:
    "Study guides, exam strategy and prep tips for JAMB/UTME candidates from the Orbit Prep team.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Orbit Prep Blog — UTME & JAMB study guides",
    description: "Study guides, exam strategy and prep tips for JAMB/UTME candidates.",
    type: "website",
    url: "/blog",
  },
};

type Post = {
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  published_at: string | null;
};

async function getPosts(): Promise<Post[]> {
  try {
    const { url, anonKey } = getSupabasePublicEnv();
    if (!url || !anonKey) return [];
    const supabase = createClient(url, anonKey);
    const { data } = await supabase
      .from("blog_posts")
      .select("slug, title, excerpt, tags, published_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(50);
    return (data ?? []) as Post[];
  } catch {
    return [];
  }
}

export default async function BlogIndexPage() {
  const posts = await getPosts();

  return (
    <main className="min-h-screen bg-[#f5f4ff]">
      <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <Image src="/logo-192.png" alt="Orbit Prep logo" width={40} height={40} priority />
            <p className="text-xs font-black uppercase tracking-[0.28em] text-violet-600">Orbit Prep</p>
          </div>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">Blog</h1>
          <p className="mt-3 text-base text-slate-600">
            Study guides, exam strategy and prep tips for JAMB/UTME candidates — written by the Orbit Prep team.
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="rounded-[28px] bg-white p-10 text-center ring-1 ring-slate-200">
            <p className="text-xl font-black text-slate-900">No posts yet</p>
            <p className="mt-2 text-sm text-slate-500">New articles are on the way — check back soon.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <article key={post.slug} className="group rounded-[28px] bg-white p-6 ring-1 ring-slate-200 transition hover:ring-violet-300 hover:shadow-md">
                <Link href={`/blog/${post.slug}`}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">
                        {tag}
                      </span>
                    ))}
                    {post.published_at && (
                      <time dateTime={post.published_at} className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                        {new Date(post.published_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
                      </time>
                    )}
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 transition group-hover:text-violet-700">{post.title}</h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{post.excerpt}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-violet-600">
                    Read article <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </article>
            ))}
          </div>
        )}

        <footer className="mt-10 text-center">
          <Link href="/" className="text-sm font-bold text-violet-600 hover:underline">
            Prepare for UTME with Orbit Prep →
          </Link>
        </footer>
      </div>
    </main>
  );
}
