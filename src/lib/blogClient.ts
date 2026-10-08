/** Blog inside the app: loads published articles, keeps a copy for offline reading, and tracks which ones are new. */
import type { SupabaseClient } from "@supabase/supabase-js";

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  cover_image: string | null;
  published_at: string | null;
  body?: string;
};

const LIST_KEY = "qubit_blog_list_v1";
const POST_KEY = (slug: string) => `qubit_blog_post_v1_${slug}`;
const READ_KEY = "qubit_blog_read_v1";
const SINCE_KEY = "qubit_blog_since_v1";
const LIST_COLS = "slug, title, excerpt, tags, cover_image, published_at";

/** Gives a slow or dead connection a few seconds, then lets the saved copy be shown instead of an endless spinner. */
function withTimeout<T>(p: PromiseLike<T>, ms = 6000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    Promise.resolve(p).then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

function store<T>(key: string, value: T) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ } }
function load<T>(key: string): T | null { try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : null; } catch { return null; } }

/** Published articles, newest first. Falls back to the last copy saved on this phone when offline. */
export async function fetchArticles(supabase: SupabaseClient): Promise<{ articles: Article[]; offline: boolean }> {
  try {
    if (isOffline()) throw new Error("offline");
    const res = await withTimeout(supabase.from("blog_posts").select(LIST_COLS).eq("is_published", true).order("published_at", { ascending: false }).limit(60));
    if (res.error) throw new Error(res.error.message);
    const articles = ((res.data ?? []) as Article[]).map((a) => ({ ...a, cover_image: a.cover_image ?? null, tags: a.tags ?? [] }));
    store(LIST_KEY, articles);
    return { articles, offline: false };
  } catch {
    return { articles: load<Article[]>(LIST_KEY) ?? [], offline: true };
  }
}

export async function fetchArticle(supabase: SupabaseClient, slug: string): Promise<{ article: Article | null; offline: boolean }> {
  try {
    if (isOffline()) throw new Error("offline");
    const { data, error } = await withTimeout(supabase
      .from("blog_posts")
      .select("slug, title, excerpt, body, tags, cover_image, published_at")
      .eq("slug", slug).eq("is_published", true).maybeSingle());
    if (error) throw new Error(error.message);
    const a = (data as Article | null) ?? null;
    if (a) store(POST_KEY(slug), a);
    return { article: a, offline: false };
  } catch {
    return { article: load<Article>(POST_KEY(slug)), offline: true };
  }
}

// ── "New" tracking ───────────────────────────────────────────────────────────
// Only articles published after this phone first opened the app count as new, so a new user isn't greeted by 40 dots.
function since(): number {
  const s = load<number>(SINCE_KEY);
  if (s) return s;
  const now = Date.now();
  store(SINCE_KEY, now);
  return now;
}
const readSet = () => new Set(load<string[]>(READ_KEY) ?? []);

export function markRead(slug: string) {
  const s = readSet();
  s.add(slug);
  store(READ_KEY, [...s].slice(-300));
  if (typeof window !== "undefined") window.dispatchEvent(new Event("qubit-blog-read"));
}

export function isNew(a: Pick<Article, "slug" | "published_at">): boolean {
  if (!a.published_at) return false;
  return new Date(a.published_at).getTime() > since() && !readSet().has(a.slug);
}

export function countNew(list: Pick<Article, "slug" | "published_at">[]): number {
  return list.filter(isNew).length;
}
