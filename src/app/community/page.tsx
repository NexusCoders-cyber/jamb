"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  getChannels, getPosts, createPost,
  type Channel, type Post,
} from "@/lib/queries";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-violet-100 font-black text-violet-700 ${sz}`}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function CommunityPage() {
  const { user, loading: authLoading } = useUser();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // New post form
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  // Load channels on mount
  useEffect(() => {
    if (authLoading) return;
    const supabase = createSupabaseBrowserClient();
    getChannels(supabase).then((ch) => {
      setChannels(ch);
      if (ch.length > 0) setActiveChannel(ch[0]);
    });
  }, [authLoading]);

  // Load posts when channel changes
  useEffect(() => {
    if (!activeChannel) return;
    let mounted = true;
    setLoadingPosts(true);
    const supabase = createSupabaseBrowserClient();
    getPosts(supabase, activeChannel.id, 30).then((p) => {
      if (mounted) setPosts(p);
    }).finally(() => { if (mounted) setLoadingPosts(false); });
    return () => { mounted = false; };
  }, [activeChannel]);

  async function handlePost() {
    if (!user || !activeChannel) return;
    if (newTitle.trim().length < 3) { setPostError("Title must be at least 3 characters."); return; }
    if (newBody.trim().length < 1) { setPostError("Post body cannot be empty."); return; }
    setPosting(true); setPostError("");
    const supabase = createSupabaseBrowserClient();
    const p = await createPost(supabase, user.id, activeChannel.id, newTitle.trim(), newBody.trim());
    if (p) {
      setPosts((prev) => [p, ...prev]);
      setNewTitle(""); setNewBody(""); setShowForm(false);
    } else {
      setPostError("Could not create post. Try again.");
    }
    setPosting(false);
  }

  const myName = user?.user_metadata?.full_name as string | undefined;

  return (
    <main className="min-h-screen bg-[#eef2ff] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500">Community</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Study Community</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/messages" className="flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100">
              <span>✉</span> Messages
            </Link>
            <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              Dashboard
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Channels sidebar */}
          <aside className="space-y-4">
            <div className="rounded-[24px] bg-white p-4 ring-1 ring-slate-200">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Channels</p>
              <div className="space-y-1">
                {channels.map((ch) => (
                  <button key={ch.id} type="button" onClick={() => setActiveChannel(ch)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${activeChannel?.id === ch.id ? "bg-violet-100 text-violet-900" : "text-slate-600 hover:bg-slate-50"}`}>
                    <span className="text-base">#</span>
                    {ch.name}
                  </button>
                ))}
              </div>
            </div>

            {user && (
              <div className="rounded-[24px] bg-violet-600 p-4 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">Your profile</p>
                <div className="mt-3 flex items-center gap-3">
                  <Avatar name={myName ?? user.email ?? "U"} />
                  <div className="min-w-0">
                    <p className="truncate font-bold">{myName ?? "Student"}</p>
                    <p className="truncate text-xs text-violet-200">{user.email}</p>
                  </div>
                </div>
                <Link href="/settings" className="mt-3 block rounded-xl bg-white/10 px-3 py-2 text-center text-xs font-bold text-white hover:bg-white/20">
                  Edit profile
                </Link>
              </div>
            )}
          </aside>

          {/* Main feed */}
          <div className="space-y-4">
            {/* Channel header + new post */}
            <div className="rounded-[24px] bg-gradient-to-r from-violet-600 to-violet-500 p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-violet-200">
                    # {activeChannel?.slug ?? "channel"}
                  </p>
                  <h2 className="mt-1 text-2xl font-black">{activeChannel?.name ?? "Select a channel"}</h2>
                </div>
                {user ? (
                  <button onClick={() => { setShowForm((v) => !v); setPostError(""); }}
                    className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold hover:bg-white/25 transition">
                    {showForm ? "✕ Cancel" : "+ New post"}
                  </button>
                ) : (
                  <Link href="/" className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold hover:bg-white/25">
                    Sign in to post
                  </Link>
                )}
              </div>
            </div>

            {/* New post form */}
            {showForm && user && (
              <div ref={formRef} className="rounded-[24px] bg-white p-5 ring-1 ring-violet-200">
                <p className="mb-4 text-sm font-black text-slate-900">New post in #{activeChannel?.slug}</p>
                <input
                  type="text" placeholder="Title (e.g. How do I solve probability quickly?)"
                  value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={200}
                  className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400"
                />
                <textarea
                  placeholder="Describe your question or share a tip…"
                  value={newBody} onChange={(e) => setNewBody(e.target.value)} maxLength={5000} rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400 resize-none"
                />
                {postError && <p className="mt-2 text-xs text-rose-600">{postError}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400">{newBody.length}/5000</span>
                  <button onClick={handlePost} disabled={posting}
                    className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                    {posting ? "Posting…" : "Post"}
                  </button>
                </div>
              </div>
            )}

            {/* Posts list */}
            {loadingPosts ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => <div key={n} className="animate-pulse rounded-[24px] bg-white h-24 ring-1 ring-slate-200" />)}
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-[24px] bg-white p-10 text-center ring-1 ring-slate-200">
                <p className="text-2xl font-black text-slate-900">No posts yet</p>
                <p className="mt-2 text-sm text-slate-500">
                  {user ? "Be the first to start a discussion in this channel." : "Sign in to start a discussion."}
                </p>
                {user && (
                  <button onClick={() => setShowForm(true)} className="mt-4 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">
                    Start discussion
                  </button>
                )}
              </div>
            ) : (
              posts.map((post) => (
                <article key={post.id} className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200 hover:ring-violet-200 transition">
                  <div className="flex items-start gap-3">
                    <Avatar name={(post.author as { full_name: string } | undefined)?.full_name ?? "U"} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-bold text-slate-900">
                          {(post.author as { full_name: string } | undefined)?.full_name ?? "Student"}
                        </span>
                        <span className="text-xs text-slate-400">{timeAgo(post.created_at)}</span>
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                          #{(post.channel as { slug: string } | undefined)?.slug ?? activeChannel?.slug}
                        </span>
                      </div>
                      <Link href={`/community/${post.id}`}>
                        <h3 className="text-lg font-black text-slate-900 hover:text-violet-700 transition">{post.title}</h3>
                      </Link>
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2">{post.body}</p>
                      <div className="mt-3 flex items-center gap-4">
                        <Link href={`/community/${post.id}`} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-violet-600 transition">
                          <span>💬</span> {post.reply_count} {post.reply_count === 1 ? "reply" : "replies"}
                        </Link>
                        <Link href={`/community/${post.id}`} className="text-xs font-bold text-violet-600 hover:underline">
                          Read &amp; reply →
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
