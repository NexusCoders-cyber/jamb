import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  // Public marketing/content pages get crawled; app pages behind auth are
  // excluded (noindex value) except the blog + novel readers which are public.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/blog`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/novels`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/novels/the-lekki-headmaster`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/novels/the-life-changer`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/novels/sweet-sixteen`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/novels/the-last-days-at-forcados-high`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/novels/nineteen-eighty-four`, changeFrequency: "weekly", priority: 0.7 },
  ];

  let blogRoutes: MetadataRoute.Sitemap = [];
  try {
    const { url, anonKey } = getSupabasePublicEnv();
    if (url && anonKey) {
      const supabase = createClient(url, anonKey);
      const { data } = await supabase
        .from("blog_posts")
        .select("slug, updated_at")
        .eq("is_published", true)
        .limit(500);
      blogRoutes = (data ?? []).map((p: { slug: string; updated_at: string }) => ({
        url: `${siteUrl}/blog/${p.slug}`,
        lastModified: new Date(p.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
    }
  } catch {
    // Supabase unreachable at build time — static routes still ship
  }

  return [...staticRoutes, ...blogRoutes];
}
