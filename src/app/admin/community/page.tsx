"use client";

/**
 * Admin — Community moderation. Delete spam posts and replies across all
 * channels; browse every post with its reply count.
 */

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import Avatar from "@/components/Avatar";
import { Flag, Loader2, MessageSquare, Pin, PinOff, Reply, Trash2 } from "lucide-react";

type PostRow = {
  id: string;
  title: string | null;
  body: string;
  reply_count: number;
  is_pinned?: boolean;
  created_at: string;
  author?: { full_name: string } | null;
  channel?: { name: string; slug: string } | null;
};

type ReportRow = {
  id: string;
  post_id: string | null;
  reply_id: string | null;
  reason: string;
  created_at: string;
  reporter?: { full_name: string } | null;
};

type ReplyRow = {
  id: string;
  post_id: string;
  body: string;
  created_at: string;
  author?: { full_name: string } | null;
};

export default function AdminCommunityPage() {
  const [tab, setTab] = useState<"posts" | "replies" | "reports">("posts");
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const [postsRes, repliesRes, reportsRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, title, body, reply_count, is_pinned, created_at, author:profiles(full_name), channel:channels(name, slug)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("post_replies")
        .select("id, post_id, body, created_at, author:profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(200),
      // content_reports only exists after supabase/social_features.sql —
      // degrade to an empty list when the migration hasn't run.
      supabase
        .from("content_reports")
        .select("id, post_id, reply_id, reason, created_at, reporter:profiles(full_name)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setPosts(((postsRes.data ?? []) as unknown) as PostRow[]);
    setReplies(((repliesRes.data ?? []) as unknown) as ReplyRow[]);
    setReports(((reportsRes.data ?? []) as unknown) as ReportRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function togglePin(post: PostRow) {
    setBusyId(post.id);
    setNotice(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("posts").update({ is_pinned: !post.is_pinned }).eq("id", post.id);
    if (error) {
      setNotice(error.message);
    } else {
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, is_pinned: !p.is_pinned } : p)));
      setNotice(post.is_pinned ? "Post unpinned." : "Post pinned to the top of the community feed.");
    }
    setBusyId(null);
  }

  async function resolveReport(report: ReportRow) {
    setBusyId(report.id);
    setNotice(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("content_reports").update({ status: "resolved" }).eq("id", report.id);
    if (error) {
      setNotice(error.message);
    } else {
      setReports((prev) => prev.filter((r) => r.id !== report.id));
      setNotice("Report resolved.");
    }
    setBusyId(null);
  }

  async function deletePost(post: PostRow) {
    if (!window.confirm(`Delete post "${post.title ?? post.body.slice(0, 40)}"? Its replies will be removed too.`)) return;
    setBusyId(post.id);
    setNotice(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) {
      setNotice(error.message);
    } else {
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setNotice("Post deleted.");
    }
    setBusyId(null);
  }

  async function deleteReply(reply: ReplyRow) {
    if (!window.confirm("Delete this reply?")) return;
    setBusyId(reply.id);
    setNotice(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("post_replies").delete().eq("id", reply.id);
    if (error) {
      setNotice(error.message);
    } else {
      setReplies((prev) => prev.filter((r) => r.id !== reply.id));
      setNotice("Reply deleted.");
    }
    setBusyId(null);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">Moderation</p>
        <h1 className="mt-1 text-2xl font-black text-white">Community</h1>
      </header>

      {notice && (
        <div className="mb-4 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-400 ring-1 ring-rose-500/30">
          {notice}
        </div>
      )}      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("posts")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black transition ${
            tab === "posts" ? "bg-violet-600 text-white" : "bg-slate-900 text-slate-400 ring-1 ring-slate-800 hover:text-white"
          }`}>
          <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Posts ({posts.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("replies")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black transition ${
            tab === "replies" ? "bg-violet-600 text-white" : "bg-slate-900 text-slate-400 ring-1 ring-slate-800 hover:text-white"
          }`}>
          <Reply className="h-3.5 w-3.5" aria-hidden /> Replies ({replies.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("reports")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black transition ${
            tab === "reports" ? "bg-violet-600 text-white" : "bg-slate-900 text-slate-400 ring-1 ring-slate-800 hover:text-white"
          }`}>
          <Flag className="h-3.5 w-3.5" aria-hidden /> Reports ({reports.length})
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => <div key={n} className="h-20 animate-pulse rounded-2xl bg-slate-900" />)}
        </div>
      ) : tab === "posts" ? (
        <div className="space-y-2">
          {posts.length === 0 && (
            <div className="rounded-3xl bg-slate-900 p-8 text-center ring-1 ring-slate-800">
              <p className="font-black text-white">No posts yet.</p>
            </div>
          )}
          {posts.map((p) => (
            <div key={p.id} className="flex items-start gap-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
              <Avatar user={{ full_name: p.author?.full_name ?? null, avatar_url: null }} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">{p.title ?? p.body.slice(0, 50)}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{p.body}</p>
                <p className="mt-1 text-[11px] text-slate-600">
                  {p.author?.full_name ?? "Unknown"} · #{p.channel?.slug ?? "—"} · {p.reply_count} {p.reply_count === 1 ? "reply" : "replies"} · {new Date(p.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                  {p.is_pinned && " · 📌 pinned"}
                </p>
              </div>
              {busyId === p.id ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" aria-hidden />
              ) : (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => void togglePin(p)}
                    aria-label={p.is_pinned ? `Unpin post ${p.title ?? ""}` : `Pin post ${p.title ?? ""}`}
                    className="rounded-full bg-amber-500/10 p-2 text-amber-400 ring-1 ring-amber-500/30 hover:bg-amber-500/20"
                  >
                    {p.is_pinned ? <PinOff className="h-3.5 w-3.5" aria-hidden /> : <Pin className="h-3.5 w-3.5" aria-hidden />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deletePost(p)}
                    aria-label={`Delete post ${p.title ?? ""}`}
                    className="rounded-full bg-rose-500/10 p-2 text-rose-400 ring-1 ring-rose-500/30 hover:bg-rose-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : tab === "reports" ? (
        <div className="space-y-2">
          {reports.length === 0 && (
            <div className="rounded-3xl bg-slate-900 p-8 text-center ring-1 ring-slate-800">
              <p className="font-black text-white">No open reports. 🎉</p>
            </div>
          )}
          {reports.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
              <Flag className="mt-1 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">{r.reason}</p>
                <p className="mt-1 text-[11px] text-slate-600">
                  Reported by {r.reporter?.full_name ?? "Unknown"} · {r.post_id ? `post ${r.post_id.slice(0, 8)}` : r.reply_id ? `reply ${r.reply_id.slice(0, 8)}` : "—"} · {new Date(r.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                </p>
                {r.post_id && (
                  <a href={`/community/p/${r.post_id}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] font-bold text-violet-400 hover:underline">
                    View post →
                  </a>
                )}
              </div>
              {busyId === r.id ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" aria-hidden />
              ) : (
                <button
                  type="button"
                  onClick={() => void resolveReport(r)}
                  className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-400 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20"
                >
                  Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {replies.length === 0 && (
            <div className="rounded-3xl bg-slate-900 p-8 text-center ring-1 ring-slate-800">
              <p className="font-black text-white">No replies yet.</p>
            </div>
          )}
          {replies.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
              <Avatar user={{ full_name: r.author?.full_name ?? null, avatar_url: null }} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-300">{r.body}</p>
                <p className="mt-1 text-[11px] text-slate-600">
                  {r.author?.full_name ?? "Unknown"} · {new Date(r.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} · on post {r.post_id.slice(0, 8)}
                </p>
              </div>
              {busyId === r.id ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" aria-hidden />
              ) : (
                <button
                  type="button"
                  onClick={() => void deleteReply(r)}
                  aria-label="Delete reply"
                  className="shrink-0 rounded-full bg-rose-500/10 p-2 text-rose-400 ring-1 ring-rose-500/30 hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
