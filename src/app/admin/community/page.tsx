"use client";

/**
 * Admin — Community moderation. Delete spam posts and replies across all
 * channels; browse every post with its reply count.
 */

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import Avatar from "@/components/Avatar";
import { Trash2, Loader2, MessageSquare, Reply } from "lucide-react";

type PostRow = {
  id: string;
  title: string;
  body: string;
  reply_count: number;
  created_at: string;
  author?: { full_name: string } | null;
  channel?: { name: string; slug: string } | null;
};

type ReplyRow = {
  id: string;
  post_id: string;
  body: string;
  created_at: string;
  author?: { full_name: string } | null;
};

export default function AdminCommunityPage() {
  const [tab, setTab] = useState<"posts" | "replies">("posts");
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const [postsRes, repliesRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, title, body, reply_count, created_at, author:profiles(full_name), channel:channels(name, slug)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("post_replies")
        .select("id, post_id, body, created_at, author:profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setPosts(((postsRes.data ?? []) as unknown) as PostRow[]);
    setReplies(((repliesRes.data ?? []) as unknown) as ReplyRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function deletePost(post: PostRow) {
    if (!window.confirm(`Delete post "${post.title}"? Its replies will be removed too.`)) return;
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
      )}

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("posts")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black transition ${
            tab === "posts" ? "bg-violet-600 text-white" : "bg-slate-900 text-slate-400 ring-1 ring-slate-800 hover:text-white"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Posts ({posts.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("replies")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black transition ${
            tab === "replies" ? "bg-violet-600 text-white" : "bg-slate-900 text-slate-400 ring-1 ring-slate-800 hover:text-white"
          }`}
        >
          <Reply className="h-3.5 w-3.5" aria-hidden /> Replies ({replies.length})
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
                <p className="truncate text-sm font-black text-white">{p.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{p.body}</p>
                <p className="mt-1 text-[11px] text-slate-600">
                  {p.author?.full_name ?? "Unknown"} · #{p.channel?.slug ?? "—"} · {p.reply_count} {p.reply_count === 1 ? "reply" : "replies"} · {new Date(p.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                </p>
              </div>
              {busyId === p.id ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" aria-hidden />
              ) : (
                <button
                  type="button"
                  onClick={() => void deletePost(p)}
                  aria-label={`Delete post ${p.title}`}
                  className="shrink-0 rounded-full bg-rose-500/10 p-2 text-rose-400 ring-1 ring-rose-500/30 hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
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
