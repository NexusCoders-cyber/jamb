"use client";

/**
 * Admin — Blog. Create, edit, publish and delete posts for /blog (public,
 * SEO-optimised with metadata + JSON-LD per post).
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAdminRole } from "@/lib/useAdminRole";
import { Plus, Pencil, Trash2, Loader2, Eye, EyeOff, ExternalLink, BellRing } from "lucide-react";

type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
  cover_image: string | null;
  is_published: boolean;
  published_at: string | null;
  updated_at: string;
  notified_at?: string | null;
};

type PushInfo = { configured: boolean; tableReady: boolean; devices: number; blog: number; announcements: number };
type NotifyResult = { ok?: boolean; error?: string; alreadyNotified?: boolean; inApp?: number; push?: { configured: boolean; targeted: number; sent: number; failed: number; removed: number } };

const EMPTY = { title: "", slug: "", excerpt: "", body: "", tags: "", cover_image: "", is_published: false, notify: true };

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
  const [push, setPush] = useState<PushInfo | null>(null);
  const [notifying, setNotifying] = useState<string | null>(null);

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

  const api = useCallback(async (method: "GET" | "POST", url: string, body?: Record<string, unknown>) => {
    const { data: { session } } = await createSupabaseBrowserClient().auth.getSession();
    if (!session) throw new Error("Session expired — sign in again.");
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, json };
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    api("GET", "/api/admin/push").then((r) => { if (r.ok) setPush(r.json as unknown as PushInfo); }).catch(() => undefined);
  }, [api]);

  function describe(r: NotifyResult): string {
    if (r.error) return r.error;
    const parts = [`In-app notification sent to ${r.inApp ?? 0} students.`];
    if (!r.push?.configured) parts.push("Phone notifications are not set up on the server yet (see the notice at the top), so none were sent.");
    else parts.push(`Phone notification sent to ${r.push.sent} of ${r.push.targeted} phones${r.push.failed ? ` (${r.push.failed} failed)` : ""}.`);
    return parts.join(" ");
  }

  async function notify(postId: string, force: boolean) {
    setNotifying(postId); setNotice(null);
    try {
      const r = await api("POST", "/api/admin/blog/notify", { postId, force });
      const j = r.json as NotifyResult;
      setNotice({ text: describe(j), ok: r.ok });
      if (r.ok) void load();
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : "Could not send.", ok: false });
    }
    setNotifying(null);
  }

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
      cover_image: editing.cover_image.trim() || null,
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
      const saved = res.data as BlogPost;
      let text = editing.id ? "Post updated." : "Post created.";
      let ok = true;
      // Tell students once, the first time a post goes live (if the box is ticked)
      if (saved.is_published && editing.notify && !saved.notified_at) {
        try {
          const r = await api("POST", "/api/admin/blog/notify", { postId: saved.id, force: false });
          text += " " + describe(r.json as NotifyResult);
          ok = r.ok;
        } catch (e) {
          text += " Could not notify students: " + (e instanceof Error ? e.message : "error");
          ok = false;
        }
      }
      setNotice({ text, ok });
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
          <p className="mt-1 text-sm text-slate-500">Published posts appear in the app (Blog) and publicly at /blog with full SEO metadata.</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditing({ ...EMPTY, id: null }); setShowForm(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-500"
        >
          <Plus className="h-4 w-4" aria-hidden /> New post
        </button>
      </header>

      {push && (!push.tableReady || !push.configured) && (
        <div className="mb-4 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-300 ring-1 ring-amber-500/30">
          <p className="font-bold">Phone notifications aren&apos;t fully set up</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-amber-200/90">
            {!push.tableReady && <li>Run <code className="font-mono">supabase/push.sql</code> once in the Supabase SQL Editor.</li>}
            {!push.configured && <li>Run <code className="font-mono">npm run vapid</code>, add <code className="font-mono">VAPID_PUBLIC_KEY</code>, <code className="font-mono">VAPID_PRIVATE_KEY</code> and <code className="font-mono">VAPID_SUBJECT</code> to your hosting settings, then redeploy.</li>}
          </ul>
          <p className="mt-1 text-xs text-amber-200/70">Until then, publishing still works and students still get the in-app notification.</p>
        </div>
      )}
      {push && push.tableReady && push.configured && (
        <p className="mb-4 text-xs text-slate-500">{push.blog} phone{push.blog === 1 ? "" : "s"} will get a notification for new articles ({push.devices} registered in total).</p>
      )}

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
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Cover image URL (optional)</label>
              <input
                type="url"
                value={editing.cover_image}
                onChange={(e) => setEditing((s) => ({ ...s, cover_image: e.target.value }))}
                placeholder="https://…/cover.jpg"
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
              Published (visible in the app and on /blog)
            </label>
            <label className="flex items-start gap-2 text-sm font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={editing.notify}
                onChange={(e) => setEditing((s) => ({ ...s, notify: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800"
              />
              <span>
                Tell students when this goes live
                <span className="block text-[11px] font-normal text-slate-500">Sends an in-app notification, plus a phone notification to everyone who turned on &ldquo;New articles&rdquo;. Sent once per post.</span>
              </span>
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
                <Link href={`/news/${p.slug}`} target="_blank" aria-label="View post in the app"
                  className="rounded-full bg-slate-800 p-2 text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Link>
                {p.is_published && (
                  <button type="button" disabled={notifying === p.id} aria-label={p.notified_at ? "Notify students again" : "Notify students"}
                    title={p.notified_at ? "Students were notified — send again" : "Notify students"}
                    onClick={() => {
                      if (p.notified_at && !window.confirm("Students were already notified about this post. Send the notification again?")) return;
                      void notify(p.id, !!p.notified_at);
                    }}
                    className={`rounded-full p-2 ring-1 hover:bg-slate-700 disabled:opacity-50 ${p.notified_at ? "bg-slate-800 text-slate-400 ring-slate-700" : "bg-amber-500/15 text-amber-300 ring-amber-500/40"}`}>
                    {notifying === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <BellRing className="h-3.5 w-3.5" aria-hidden />}
                  </button>
                )}
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
                      cover_image: p.cover_image ?? "",
                      is_published: p.is_published,
                      notify: !p.notified_at,
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
