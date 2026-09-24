"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getPost, getReplies, createReply, type Post, type PostReply } from "@/lib/queries";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "h-7 w-7 text-xs" : size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-sm";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-violet-100 font-black text-violet-700 ${sz}`}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function PostThreadPage() {
  const { postId } = useParams<{ postId: string }>();
  const { user, loading: authLoading } = useUser();

  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<PostReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading || !postId) return;
    const supabase = createSupabaseBrowserClient();
    Promise.all([getPost(supabase, postId), getReplies(supabase, postId)])
      .then(([p, r]) => { setPost(p); setReplies(r); })
      .finally(() => setLoading(false));
  }, [postId, authLoading]);

  // Realtime subscription for new replies
  useEffect(() => {
    if (!postId) return;
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try { supabase = createSupabaseBrowserClient(); } catch { return; }

    const channel = supabase
      .channel(`replies-${postId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_replies", filter: `post_id=eq.${postId}` },
        (payload) => {
          const newReply = payload.new as PostReply;
          setReplies((prev) => {
            if (prev.find((r) => r.id === newReply.id)) return prev;
            // Fetch author name separately since realtime doesn't include joins
            supabase.from("profiles").select("full_name").eq("id", newReply.user_id).single()
              .then(({ data }) => {
                setReplies((p) => p.map((r) =>
                  r.id === newReply.id ? { ...r, author: data ?? undefined } : r
                ));
              });
            return [...prev, { ...newReply, author: undefined }];
          });
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [postId]);

  async function handleReply() {
    if (!user || !postId) return;
    if (replyBody.trim().length < 1) { setReplyError("Reply cannot be empty."); return; }
    setSending(true); setReplyError("");
    const supabase = createSupabaseBrowserClient();
    const r = await createReply(supabase, user.id, postId, replyBody.trim());
    if (r) {
      setReplies((prev) => [...prev, r]);
      setReplyBody("");
      setPost((p) => p ? { ...p, reply_count: p.reply_count + 1 } : p);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } else {
      setReplyError("Could not send reply. Try again.");
    }
    setSending(false);
  }

  const authorName = (post?.author as { full_name: string } | undefined)?.full_name ?? "Student";
  const channelSlug = (post?.channel as { slug: string; name: string } | undefined)?.slug ?? "";
  const channelName = (post?.channel as { slug: string; name: string } | undefined)?.name ?? "Community";

  if (loading) {
    return (
      <main className="min-h-screen bg-[#eef2ff] px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {[1, 2, 3].map((n) => <div key={n} className="animate-pulse rounded-[24px] bg-white h-20 ring-1 ring-slate-200" />)}
        </div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="min-h-screen bg-[#eef2ff] px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-10 text-center ring-1 ring-slate-200">
          <p className="text-xl font-black text-slate-900">Post not found</p>
          <Link href="/community" className="mt-4 inline-block text-sm font-bold text-violet-600">← Back to community</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#eef2ff] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Back nav */}
        <div className="mb-5 flex items-center justify-between">
          <Link href="/community" className="flex items-center gap-2 text-sm font-bold text-violet-600 hover:underline">
            ← {channelName}
          </Link>
          <Link href="/messages" className="flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
            ✉ Messages
          </Link>
        </div>

        {/* Original post */}
        <div className="rounded-[28px] bg-white p-6 ring-1 ring-slate-200 mb-4">
          <div className="flex items-start gap-4">
            <Avatar name={authorName} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-bold text-slate-900">{authorName}</span>
                <span className="text-xs text-slate-400">{timeAgo(post.created_at)}</span>
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">#{channelSlug}</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900">{post.title}</h1>
              <p className="mt-3 text-base leading-7 text-slate-700 whitespace-pre-wrap">{post.body}</p>
              <p className="mt-4 text-xs text-slate-400">{post.reply_count} {post.reply_count === 1 ? "reply" : "replies"}</p>
            </div>
          </div>
        </div>

        {/* Replies */}
        {replies.length > 0 && (
          <div className="space-y-3 mb-4">
            <p className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </p>
            {replies.map((reply) => {
              const rAuthor = (reply.author as { full_name: string } | undefined)?.full_name ?? "Student";
              const isMe = reply.user_id === user?.id;
              return (
                <div key={reply.id}
                  className={`flex items-start gap-3 rounded-[20px] p-4 ring-1 ${isMe ? "bg-violet-50 ring-violet-200 flex-row-reverse" : "bg-white ring-slate-200"}`}>
                  <Avatar name={rAuthor} size="sm" />
                  <div className={`flex-1 min-w-0 ${isMe ? "text-right" : ""}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isMe ? "justify-end" : ""}`}>
                      <span className="text-sm font-bold text-slate-900">{isMe ? "You" : rAuthor}</span>
                      <span className="text-xs text-slate-400">{timeAgo(reply.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-6 whitespace-pre-wrap">{reply.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div ref={bottomRef} />

        {/* Reply box */}
        {user ? (
          <div className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200">
            <div className="flex items-start gap-3">
              <Avatar name={(user.user_metadata?.full_name as string | undefined) ?? user.email ?? "U"} />
              <div className="flex-1">
                <textarea
                  placeholder="Write a reply…"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleReply(); }}
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400 resize-none"
                />
                {replyError && <p className="mt-1 text-xs text-rose-600">{replyError}</p>}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">{replyBody.length}/2000 · Ctrl+Enter to send</span>
                  <button onClick={handleReply} disabled={sending || replyBody.trim().length === 0}
                    className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
                    {sending ? "Sending…" : "Reply"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] bg-slate-50 p-5 text-center ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-700">
              <Link href="/" className="text-violet-600 underline">Sign in</Link> to join the discussion
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
