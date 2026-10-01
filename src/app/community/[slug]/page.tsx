"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import { getChannelBySlug, getPosts, createPost, type Channel, type Post } from "@/lib/queries";
import Avatar from "@/components/Avatar";
import EmojiPicker from "@/components/EmojiPicker";
import { ArrowLeft, MessageCircle } from "lucide-react";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function ChannelPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useUser();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // New post form
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");

  // Load the channel + its posts
  useEffect(() => {
    if (authLoading || !slug) return;
    let mounted = true;
    const supabase = createSupabaseBrowserClient();
    getChannelBySlug(supabase, slug)
      .then(async (ch) => {
        if (!mounted) return;
        if (!ch) { setNotFound(true); return; }
        setChannel(ch);
        setLoadingPosts(true);
        const p = await getPosts(supabase, ch.id, 30);
        if (mounted) setPosts(p);
      })
      .finally(() => { if (mounted) setLoadingPosts(false); });
    return () => { mounted = false; };
  }, [slug, authLoading]);

  const handlePost = useCallback(async () => {
    if (!user || !channel) return;
    if (newTitle.trim().length < 3) { setPostError("Title must be at least 3 characters."); return; }
    if (newBody.trim().length < 1) { setPostError("Post body cannot be empty."); return; }
    setPosting(true); setPostError("");
    const supabase = createSupabaseBrowserClient();
    const p = await createPost(supabase, user.id, channel.id, newTitle.trim(), newBody.trim());
    if (p) {
      setPosts((prev) => [p, ...prev]);
      setNewTitle(""); setNewBody(""); setShowForm(false);
    } else {
      setPostError("Could not create post. Try again.");
    }
    setPosting(false);
  }, [user, channel, newTitle, newBody]);

  if (notFound) {
    return (
      <AppShell title="Channel" back="/community">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="text-xl font-black text-slate-900">Channel not found</p>
          <Link href="/community" className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">
            Back to community
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={channel?.name ?? "Channel"} back="/community">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-3xl lg:px-6">
        {/* Back navigation */}
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={() => router.push("/community")}
            className="flex items-center gap-1.5 text-sm font-bold text-violet-600">
            <ArrowLeft className="h-4 w-4" aria-hidden /> All channels
          </button>
          <Link href="/messages" className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-700">
            Messages
          </Link>
        </div>

        {/* Channel header */}
        <div className="rounded-[28px] bg-gradient-to-r from-violet-600 to-violet-500 p-5 text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-violet-200"># {channel?.slug ?? slug}</p>
          <h1 className="mt-1 text-2xl font-black">{channel?.name ?? "Loading…"}</h1>
          <p className="mt-1 text-sm text-violet-100">{posts.length} {posts.length === 1 ? "post" : "posts"}</p>
        </div>

        {/* New post */}
        <div className="mt-4 flex items-center justify-between">
          {user ? (
            <button onClick={() => { setShowForm((v) => !v); setPostError(""); }}
              className="rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 transition">
              {showForm ? "Cancel" : "New post"}
            </button>
          ) : (
            <Link href={`/?next=${encodeURIComponent(`/community/${slug}`)}`} className="rounded-full bg-violet-100 px-4 py-2 text-sm font-bold text-violet-700">
              Sign in to post
            </Link>
          )}
        </div>

        {showForm && user && (
          <div className="mt-3 rounded-[24px] bg-white p-5 ring-1 ring-violet-200">
            <p className="mb-4 text-sm font-black text-slate-900">New post in #{channel?.slug}</p>
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
            <div className="mt-1.5">
              <EmojiPicker onPick={(emoji) => setNewBody((b) => b + emoji)} />
            </div>
            {postError && <p className="mt-2 text-xs text-rose-600">{postError}</p>}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">{newBody.length}/5000</span>
              <button onClick={() => void handlePost()} disabled={posting}
                className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                {posting ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        )}

        {/* Posts list */}
        <div className="mt-4 space-y-4">
          {loadingPosts ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => <div key={n} className="h-24 animate-pulse rounded-[24px] bg-white ring-1 ring-slate-200" />)}
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-[24px] bg-white p-10 text-center ring-1 ring-slate-200">
              <p className="text-2xl font-black text-slate-900">No posts yet</p>
              <p className="mt-2 text-sm text-slate-500">
                Be the first to start a discussion in this channel.
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
                <div className="flex items-start gap-3">                    <Avatar user={{ full_name: (post.author as { full_name: string } | undefined)?.full_name ?? "U", avatar_url: (post.author as { avatar_url?: string | null } | undefined)?.avatar_url ?? null }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900">
                        {(post.author as { full_name: string } | undefined)?.full_name ?? "Student"}
                      </span>
                      <span className="text-xs text-slate-400">{timeAgo(post.created_at)}</span>
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                        #{(post.channel as { slug: string } | undefined)?.slug ?? channel?.slug}
                      </span>
                    </div>
                    <Link href={`/community/p/${post.id}`}>
                      <h3 className="text-lg font-black text-slate-900 hover:text-violet-700 transition">{post.title ?? post.body.slice(0, 80) + (post.body.length > 80 ? "…" : "")}</h3>
                    </Link>
                    <p className="mt-1 text-sm text-slate-600 line-clamp-2">{post.body}</p>
                    <div className="mt-3 flex items-center gap-4">
                      <Link href={`/community/p/${post.id}`} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-violet-600 transition">
                        <MessageCircle className="h-4 w-4" aria-hidden /> {post.reply_count} {post.reply_count === 1 ? "reply" : "replies"}
                      </Link>
                      <Link href={`/community/p/${post.id}`} className="text-xs font-bold text-violet-600 hover:underline">
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
    </AppShell>
  );
}
