"use client";

/**
 * Admin — Blog. Create, edit, publish and delete posts for /blog (public,
 * SEO-optimised with metadata + JSON-LD per post).
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAdminRole } from "@/lib/useAdminRole";
import { Plus, Pencil, Trash2, Loader2, Eye, EyeOff, ExternalLink } from "lucide-react";

type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
  is_published: boolean;
  published_at: string | null;
  updated_at: string;
};

const EMPTY = { title: "", slug: "", excerpt: "", body: "", tags: "", is_published: false };

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function AdminBlogPage() {
  const { user } = useAdminRole();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<(typeof EMPTY) & { id: string | null }>({ ...EMPTY, id: null });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100);
    setPosts((data ?? []) as BlogPost[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (editing.title.trim().length < 3) { setNotice({ text: "Title is too short.", ok: false }); return; }
    setSaving(true);
    setNotice(null);
    const supabase = createSupabaseBrowserClient();
    const slug = editing.slug.trim() || slugify(editing.title);
    const values = {
      title: editing.title.trim(),
      slug,
      excerpt: editing.excerpt.trim().slice(0, 300),
      body: editing.body,
      tags: editing.tags.split(",").map((t) => t.trim()).filter(Boolean),
      is_published: editing.is_published,
      published_at: editing.is_published ? (posts.find((p) => p.id === editing.id)?.published_at ?? new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    };

    const res = editing.id
      ? await supabase.from("blog_posts").update(values).eq("id", editing.id).select().single()
      : await supabase.from("blog_posts").insert({ ...values, author_id: user?.id }).select().single();

    if (res.error) {
      setNotice({ text: res.error.message, ok: false });
    } else {
      setNotice({ text: editing.id ? "Post updated." : "Post created.", ok: true });
      setShowForm(false);
      setEditing({ ...EMPTY, id: null });
      void load();
    }
    setSaving(false);
  }

  async function togglePublish(post: BlogPost) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("blog_posts")
      .update({ is_published: !post.is_published, published_at: post.is_published ? null : new Date().toISOString() })
      .eq("id", post.id);
    if (!error) setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, is_published: !post.is_published } : p)));
  }

  async function remove(post: BlogPost) {
    if (!window.confirm(`Delete "${post.title}"?`)) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("blog_posts").delete().eq("id", post.id);
    if (!error) setPosts((prev) => prev.filter((p) => p.id !== post.id));
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">Content</p>
          <h1 className="mt-1 text-2xl font-black text-white">Blog</h1>
          <p className="mt-1 text-sm text-slate-500">Published posts appear at /blog with full SEO metadata.</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditing({ ...EMPTY, id: null }); setShowForm(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-500"
        >
          <Plus className="h-4 w-4" aria-hidden /> New post
        </button>
      </header>

      {notice && (
        <div className={`mb-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
          notice.ok ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30" : "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/30"
        }`}>
          {notice.text}
        </div>
      )}

      {showForm && (
        <div className="mb-6 rounded-3xl bg-slate-900 p-6 ring-1 ring-violet-500/30">
          <h2 className="mb-4 text-lg font-black text-white">{editing.id ? "Edit post" : "New post"}</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Title</label>
              <input
                type="text"
                value={editing.title}
                onChange={(e) => setEditing((s) => ({ ...s, title: e.target.value, slug: s.id ? s.slug : slugify(e.target.value) }))}
                placeholder="5 Study Habits That Boost UTME Scores"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Slug (URL)</label>
              <input
                type="text"
                value={editing.slug}
                onChange={(e) => setEditing((s) => ({ ...s, slug: slugify(e.target.value) }))}
                placeholder="study-habits-utme"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-300 outline-none focus:border-violet-500"
              />
              <p className="mt-1 text-[11px] text-slate-500">/blog/{editing.slug || "…"}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Excerpt (shown on cards &amp; search engines)</label>
              <textarea
                value={editing.excerpt}
                onChange={(e) => setEditing((s) => ({ ...s, excerpt: e.target.value }))}
                rows={2}
                maxLength={300}
                className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Body (blank line = new paragraph)</label>
              <textarea
                value={editing.body}
                onChange={(e) => setEditing((s) => ({ ...s, body: e.target.value }))}
                rows={10}
                className="w-full resize-y rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Tags (comma-separated)</label>
              <input
                type="text"
                value={editing.tags}
                onChange={(e) => setEditing((s) => ({ ...s, tags: e.target.value }))}
                placeholder="utme, study-tips, english"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={editing.is_published}
                onChange={(e) => setEditing((s) => ({ ...s, is_published: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800"
              />
              Published (visible publicly)
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); setEditing({ ...EMPTY, id: null }); }}
              className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-700">
              Cancel
            </button>
            <button type="button" onClick={() => void save()} disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {editing.id ? "Save changes" : "Create post"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => <div key={n} className="h-16 animate-pulse rounded-2xl bg-slate-900" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-3xl bg-slate-900 p-8 text-center ring-1 ring-slate-800">
          <p className="font-black text-white">No posts yet</p>
          <p className="mt-1 text-sm text-slate-500">Write your first article — it will be indexed at /blog.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-black text-white">
                  {p.title}
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${
                    p.is_published ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-400"
                  }`}>
                    {p.is_published ? "LIVE" : "DRAFT"}
                  </span>
                </p>
                <p className="truncate text-xs text-slate-500">/blog/{p.slug} · {p.tags.join(", ") || "no tags"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link href={`/blog/${p.slug}`} target="_blank" aria-label="View post"
                  className="rounded-full bg-slate-800 p-2 text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Link>
                <button type="button" onClick={() => void togglePublish(p)} aria-label={p.is_published ? "Unpublish" : "Publish"}
                  className="rounded-full bg-slate-800 p-2 text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700">
                  {p.is_published ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
                </button>
                <button type="button"
                  onClick={() => {
                    setEditing({
                      id: p.id,
                      title: p.title,
                      slug: p.slug,
                      excerpt: p.excerpt,
                      body: p.body,
                      tags: p.tags.join(", "),
                      is_published: p.is_published,
                    });
                    setShowForm(true);
                  }}
                  aria-label="Edit post"
                  className="rounded-full bg-slate-800 p-2 text-violet-300 ring-1 ring-slate-700 hover:bg-slate-700">
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button type="button" onClick={() => void remove(p)} aria-label="Delete post"
                  className="rounded-full bg-rose-500/10 p-2 text-rose-400 ring-1 ring-rose-500/30 hover:bg-rose-500/20">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
