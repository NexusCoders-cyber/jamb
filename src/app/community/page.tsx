"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import {
  getChannels, getPosts, createPost, togglePostLike, getReplies, createReply,
  searchPeople, type Channel, type Post, type PostReply,
} from "@/lib/queries";
import Avatar from "@/components/Avatar";
import FriendButton from "@/components/FriendButton";
import OnlineDot from "@/components/OnlineDot";
import EmojiPicker from "@/components/EmojiPicker";
import { Flag, Heart, Link2, MessageCircle, Pin, Send, ThumbsUp, Users, X } from "lucide-react";

type Person = { id: string; full_name: string; avatar_url?: string | null; user_code?: string | null; streak_days?: number | null };

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Post card — like bar, expandable comments, add-friend, report. */
function PostCard({
  post, myId, onLike, onDeleted,
}: {
  post: Post;
  myId: string;
  onLike: (postId: string) => void;
  onDeleted: (postId: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [replies, setReplies] = useState<PostReply[]>([]);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const likeRows = Array.isArray(post.post_likes) ? post.post_likes : [];
  const likeCount = likeRows.length;
  const likedByMe = likeRows.some((l) => l.user_id === myId);
  const isMine = post.user_id === myId;
  const authorCode = post.author?.user_code ?? null;

  async function loadReplies() {
    const supabase = createSupabaseBrowserClient();
    const rows = await getReplies(supabase, post.id);
    setReplies(rows);
    setRepliesLoaded(true);
  }

  async function submitReply() {
    if (!replyBody.trim() || sending) return;
    setSending(true);
    const supabase = createSupabaseBrowserClient();
    const r = await createReply(supabase, myId, post.id, replyBody.trim());
    if (r) {
      setReplies((prev) => [...prev, r]);
      setReplyBody("");
    }
    setSending(false);
  }

  async function reportPost() {
    setMenuOpen(false);
    const reason = window.prompt("Why are you reporting this post?");
    if (!reason?.trim()) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("content_reports").insert({
      reporter_id: myId,
      post_id: post.id,
      reason: reason.trim().slice(0, 300),
    });
    if (!error) window.alert("Thanks — our moderators will review this post.");
  }

  function copyLink() {
    setMenuOpen(false);
    const url = `${window.location.origin}/community/p/${post.id}`;
    if (navigator.share) {
      navigator.share({ title: post.title ?? "Qubit community post", url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
    }
  }

  return (
    <article className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-slate-200">
      {/* Pinned banner */}
      {post.is_pinned && (
        <p className="flex items-center gap-1.5 bg-amber-50 px-4 py-1.5 text-xs font-bold text-amber-700">
          <Pin className="h-3.5 w-3.5" aria-hidden /> Pinned by admins
        </p>
      )}

      <div className="p-4 sm:p-5">
        {/* Header: avatar, name + user code, time, channel, menu */}
        <div className="flex items-start gap-3">
          <Link href={`/profile/${post.user_id}`} aria-label="View profile" className="relative shrink-0">
            <Avatar user={{ full_name: post.author?.full_name ?? "Student", avatar_url: post.author?.avatar_url ?? null }} />
            <OnlineDot userId={post.user_id} size={40} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2">
              <Link href={`/profile/${post.user_id}`} className="truncate text-[15px] font-bold text-slate-900 hover:text-violet-700">
                {post.author?.full_name ?? "Student"}
              </Link>
              {authorCode && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{authorCode}</span>
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
              {timeAgo(post.created_at)}
              {post.channel && (
                <>
                  · <Link href={`/community/${post.channel.slug}`} className="font-semibold text-violet-500 hover:underline">#{post.channel.slug}</Link>
                </>
              )}
            </p>
          </div>
          <div className="relative shrink-0">
            <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-label="Post options"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
              ⋯
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
                {isMine ? (
                  <button type="button" onClick={async () => {
                    setMenuOpen(false);
                    if (!window.confirm("Delete this post?")) return;
                    const supabase = createSupabaseBrowserClient();
                    const { error } = await supabase.from("posts").delete().eq("id", post.id);
                    if (!error) onDeleted(post.id);
                  }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-rose-600 hover:bg-rose-50">
                    <X className="h-4 w-4" aria-hidden /> Delete post
                  </button>
                ) : (
                  <button type="button" onClick={reportPost} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">
                    <Flag className="h-4 w-4 text-slate-400" aria-hidden /> Report post
                  </button>
                )}
                <button type="button" onClick={copyLink} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">
                  <Link2 className="h-4 w-4 text-slate-400" aria-hidden /> Share link
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="mt-3">
          {post.title && <h3 className="text-base font-black text-slate-900">{post.title}</h3>}
          <p className="whitespace-pre-wrap text-[15px] leading-6 text-slate-700">{post.body}</p>
        </div>

        {/* Like bar */}
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600">
              <ThumbsUp className="h-3 w-3 text-white" aria-hidden />
            </span>
            {likeCount > 0 ? likeCount : ""}
          </span>
          <span className="text-xs text-slate-400">{post.reply_count} {post.reply_count === 1 ? "comment" : "comments"}</span>
        </div>

        {/* Action row — Facebook style */}
        <div className="mt-1 grid grid-cols-2 border-t border-slate-100 pt-1">
          <button type="button" onClick={() => onLike(post.id)}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition hover:bg-slate-50 ${likedByMe ? "text-violet-700" : "text-slate-500"}`}>
            <Heart className={`h-5 w-5 ${likedByMe ? "fill-violet-600 text-violet-600" : ""}`} aria-hidden />
            {likedByMe ? "Liked" : "Like"}
          </button>
          <button type="button" onClick={() => { const next = !showComments; setShowComments(next); if (next && !repliesLoaded) loadReplies(); }}
            className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-50">
            <MessageCircle className="h-5 w-5" aria-hidden /> Comment
          </button>
        </div>

        {/* Add friend row for other people's posts */}
        {!isMine && (
          <div className="mt-2 border-t border-slate-100 pt-2.5">
            <FriendButton targetUserId={post.user_id} reloadKey={reloadKey} compact />
          </div>
        )}

        {/* Comments section */}
        {showComments && (
          <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
            {replies.map((reply) => (
              <div key={reply.id} className="flex items-start gap-2">
                <Avatar user={{ full_name: reply.author?.full_name ?? "Student", avatar_url: reply.author?.avatar_url ?? null }} size="sm" />
                <div className="min-w-0 flex-1 rounded-2xl bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <Link href={`/profile/${reply.user_id}`} className="text-xs font-bold text-slate-900 hover:text-violet-700">
                      {reply.user_id === myId ? "You" : reply.author?.full_name ?? "Student"}
                    </Link>
                    {reply.author?.user_code && (
                      <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 ring-1 ring-slate-200">{reply.author.user_code}</span>
                    )}
                    <span className="text-[10px] text-slate-400">{timeAgo(reply.created_at)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-5 text-slate-700">{reply.body}</p>
                </div>
              </div>
            ))}

            {/* Composer */}
            <div className="flex items-center gap-2">
              <input
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitReply(); } }}
                placeholder="Write a comment…"
                maxLength={1000}
                className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-violet-400"
              />
              <button type="button" onClick={submitReply} disabled={sending || !replyBody.trim()} aria-label="Send comment"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white disabled:opacity-40">
                <Send className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export default function CommunityPage() {
  const { user, loading: authLoading } = useUser();

  // Join gate — first visit asks the student to pick interest channels
  const [joined, setJoined] = useState<boolean | null>(null); // null = loading
  const [pickedChannels, setPickedChannels] = useState<string[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  // Composer
  const [composerOpen, setComposerOpen] = useState(false);
  const [postChannel, setPostChannel] = useState<string>("");
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");

  // People search
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);

  const myName = user?.user_metadata?.full_name as string | undefined;

  // Load channels + check whether the student already joined
  useEffect(() => {
    if (authLoading) return;
    const supabase = createSupabaseBrowserClient();
    getChannels(supabase).then(setChannels);
    try {
      setJoined(localStorage.getItem("community_joined") === "1");
    } catch {
      setJoined(false);
    }
  }, [authLoading]);

  const loadFeed = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const rows = await getPosts(supabase, undefined, 40);
    setPosts(rows);
    setFeedLoading(false);
  }, []);

  useEffect(() => {
    if (joined) loadFeed();
  }, [joined, loadFeed]);

  // Debounced people search by name or user code
  useEffect(() => {
    if (!user || !query.trim()) { setPeople([]); return; }
    let mounted = true;
    const t = setTimeout(() => {
      const supabase = createSupabaseBrowserClient();
      searchPeople(supabase, query, user.id).then((rows) => { if (mounted) setPeople(rows); });
    }, 300);
    return () => { mounted = false; clearTimeout(t); };
  }, [query, user]);

  async function handlePost() {
    if (!user) return;
    if (postBody.trim().length < 1) { setPostError("Write something first."); return; }
    if (postTitle.trim() && postTitle.trim().length < 3) { setPostError("Title must be at least 3 characters."); return; }
    if (!postChannel) { setPostError("Pick a channel for your post."); return; }
    setPosting(true); setPostError("");
    const supabase = createSupabaseBrowserClient();
    const p = await createPost(supabase, user.id, postChannel, postTitle.trim() || null, postBody.trim());
    if (p) {
      setPosts((prev) => [p, ...prev]);
      setPostBody(""); setPostTitle(""); setComposerOpen(false);
    } else {
      setPostError("Could not post. Try again.");
    }
    setPosting(false);
  }

  // Optimistic like toggle
  const handleLike = useCallback((postId: string) => {
    if (!user) return;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const rows = Array.isArray(p.post_likes) ? p.post_likes : [];
        const liked = rows.some((l) => l.user_id === user.id);
        return {
          ...p,
          post_likes: liked ? rows.filter((l) => l.user_id !== user.id) : [...rows, { user_id: user.id }],
        };
      }),
    );
    const supabase = createSupabaseBrowserClient();
    togglePostLike(supabase, postId, user.id);
  }, [user]);

  // ── Join community onboarding ────────────────────────────────────────────
  if (joined === false) {
    return (
      <AppShell title="Community">
        <div className="mx-auto max-w-xl px-4 py-6">
          <div className="mb-6 rounded-[28px] bg-gradient-to-br from-violet-600 to-violet-500 p-6 text-white shadow-xl shadow-violet-300/25">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-100">Qubit Community</p>
            <h1 className="mt-2 text-3xl font-black">Join the community</h1>
            <p className="mt-2 text-sm text-violet-100">
              Discuss tough questions, share past papers and prep tips with thousands of UTME candidates. Pick the channels that match your subjects.
            </p>
          </div>

          <p className="mb-2 text-sm font-bold text-slate-700">Choose your channels</p>
          <div className="mb-5 grid grid-cols-2 gap-2">
            {channels.map((ch) => {
              const on = pickedChannels.includes(ch.id);
              return (
                <button key={ch.id} type="button"
                  onClick={() => setPickedChannels((p) => (on ? p.filter((id) => id !== ch.id) : [...p, ch.id]))}
                  className={`rounded-2xl border p-3 text-left text-sm font-bold transition ${on ? "border-violet-500 bg-violet-50 text-violet-900" : "border-slate-200 bg-white text-slate-600"}`}>
                  {ch.name}
                </button>
              );
            })}
          </div>

          <button type="button" onClick={() => {
            try { localStorage.setItem("community_joined", "1"); } catch { /* ignore */ }
            setJoined(true);
          }}
            className="h-14 w-full rounded-2xl bg-violet-600 text-base font-black text-white shadow-lg shadow-violet-300/30 transition hover:bg-violet-700">
            Join community
          </button>
          <p className="mt-3 text-center text-xs text-slate-400">You can change these anytime from the channel list.</p>
        </div>
      </AppShell>
    );
  }

  if (joined === null || authLoading) {
    return (
      <AppShell title="Community">
        <div className="mx-auto max-w-2xl px-4 py-10">
          <div className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="h-24 animate-pulse rounded-[24px] bg-slate-100" />)}</div>
        </div>
      </AppShell>
    );
  }

  const filtered = filter === "all" ? posts : posts.filter((p) => p.channel?.slug === filter);

  return (
    <AppShell title="Community">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-5xl lg:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-black text-slate-900">Community</h1>
          <Link href="/messages" className="flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-700">
            Messages
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Feed column */}
          <div className="min-w-0">
            {/* Composer — Facebook "What's on your mind?" */}
            {user && (
              <div className="mb-4 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                {!composerOpen ? (
                  <button type="button" onClick={() => setComposerOpen(true)} className="flex w-full items-center gap-3 text-left">
                    <Avatar user={{ full_name: myName ?? user.email ?? "U", avatar_url: null }} size="sm" />
                    <span className="min-w-0 flex-1 rounded-full bg-slate-100 px-4 py-2.5 text-sm text-slate-500">
                      What&apos;s on your mind?
                    </span>
                  </button>
                ) : (
                  <div>
                    <textarea
                      value={postBody}
                      onChange={(e) => setPostBody(e.target.value)}
                      placeholder="What's on your mind?"
                      rows={3}
                      maxLength={4900}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-violet-400"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select value={postChannel} onChange={(e) => setPostChannel(e.target.value)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 outline-none focus:border-violet-400">
                        <option value="">Post to…</option>
                        {channels.map((ch) => <option key={ch.id} value={ch.id}>#{ch.slug}</option>)}
                      </select>
                      <input value={postTitle} onChange={(e) => setPostTitle(e.target.value)} placeholder="Title (optional)"
                        maxLength={200}
                        className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-violet-400" />
                      <EmojiPicker onPick={(emoji) => setPostBody((b) => b + emoji)} />
                    </div>
                    {postError && <p className="mt-2 text-xs text-rose-600">{postError}</p>}
                    <div className="mt-3 flex justify-end gap-2">
                      <button type="button" onClick={() => { setComposerOpen(false); setPostError(""); }}
                        className="rounded-full px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">
                        Cancel
                      </button>
                      <button type="button" onClick={handlePost} disabled={posting}
                        className="rounded-full bg-violet-600 px-5 py-2 text-sm font-bold text-white shadow-sm shadow-violet-300/40 hover:bg-violet-700 disabled:opacity-50">
                        {posting ? "Posting…" : "Post"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Channel filter chips */}
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              <button type="button" onClick={() => setFilter("all")}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${filter === "all" ? "bg-violet-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-violet-300"}`}>
                All
              </button>
              {channels.map((ch) => (
                <button key={ch.id} type="button" onClick={() => setFilter(ch.slug)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${filter === ch.slug ? "bg-violet-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-violet-300"}`}>
                  {ch.name.replace(" Language", "")}
                </button>
              ))}
            </div>

            {/* Feed */}
            {feedLoading ? (
              <div className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="h-40 animate-pulse rounded-[24px] bg-white ring-1 ring-slate-100" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-[24px] bg-white p-10 text-center ring-1 ring-slate-200">
                <p className="text-lg font-black text-slate-900">No posts yet</p>
                <p className="mt-1 text-sm text-slate-500">Be the first to share something with the community.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((post) => (
                  <PostCard key={post.id} post={post} myId={user?.id ?? ""} onLike={handleLike}
                    onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))} />
                ))}
              </div>
            )}
          </div>

          {/* Side rail */}
          <aside className="space-y-4">
            {/* Find students — by name or user code */}
            {user && (
              <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  <Users className="h-4 w-4" aria-hidden /> Find students
                </p>
                <input
                  type="search"
                  placeholder="Name or ID (e.g. QB-7K3X9)…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400"
                />
                {people.length === 0 && query.trim() && <p className="py-2 text-xs text-slate-400">No students found.</p>}
                <div className="space-y-1">
                  {people.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-violet-50">
                      <span className="relative shrink-0">
                        <Avatar user={p} size="sm" />
                        <OnlineDot userId={p.id} size={32} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{p.full_name}</p>
                        {p.user_code && <p className="text-[11px] text-slate-400">{p.user_code}</p>}
                      </div>
                      <FriendButton targetUserId={p.id} compact />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Channels directory */}
            <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Channels</p>
              <div className="space-y-1">
                {channels.map((ch) => (
                  <Link key={ch.id} href={`/community/${ch.slug}`}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-bold text-slate-700 hover:bg-violet-50">
                    <span className="truncate">#{ch.slug}</span>
                    <span className="text-xs font-semibold text-slate-400">{posts.filter((p) => p.channel?.slug === ch.slug).length}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Your profile */}
            {user && (
              <div className="rounded-[24px] bg-violet-600 p-4 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">Your profile</p>
                <div className="mt-3 flex items-center gap-3">
                  <Avatar user={{ full_name: myName ?? user.email ?? "U", avatar_url: null }} />
                  <div className="min-w-0">
                    <p className="truncate font-bold">{myName ?? "Student"}</p>
                    <p className="truncate text-xs text-violet-200">{user.email}</p>
                  </div>
                </div>
                <Link href={`/profile/${user.id}`} className="mt-3 block rounded-xl bg-white/10 px-3 py-2 text-center text-xs font-bold text-white hover:bg-white/20">
                  View my profile
                </Link>
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
