"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getDMInbox, type DMThread } from "@/lib/queries";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-black text-violet-700">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function MessagesPage() {
  const { user, loading: authLoading } = useUser();
  const [threads, setThreads] = useState<DMThread[]>([]);
  const [loading, setLoading] = useState(true);

  // New conversation — search for a user by name to start DM
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; full_name: string }[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    const supabase = createSupabaseBrowserClient();
    getDMInbox(supabase, user.id).then(setThreads).finally(() => setLoading(false));
  }, [user, authLoading]);

  async function searchUsers(q: string) {
    if (!q.trim() || !user) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .ilike("full_name", `%${q}%`)
        .neq("id", user.id)
        .limit(8);
      setSearchResults(data ?? []);
    } finally {
      setSearching(false);
    }
  }

  const totalUnread = threads.reduce((s, t) => s + t.unread, 0);

  return (
    <main className="min-h-screen bg-[#eef2ff] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-[30px] bg-white p-6 ring-1 ring-slate-200 shadow-[0_18px_60px_rgba(93,74,228,0.1)]">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500">Direct Messages</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">
              Messages {totalUnread > 0 && (
                <span className="ml-2 rounded-full bg-violet-600 px-2 py-0.5 text-sm font-bold text-white">
                  {totalUnread}
                </span>
              )}
            </h1>
          </div>
          <Link href="/community" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Community
          </Link>
        </div>

        {!user && !authLoading ? (
          <div className="rounded-[24px] bg-slate-50 p-8 text-center ring-1 ring-slate-200">
            <p className="font-bold text-slate-700">Sign in to send and receive messages</p>
            <Link href="/" className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">Sign in</Link>
          </div>
        ) : (
          <>
            {/* Search to start a new conversation */}
            <div className="mb-5">
              <label className="mb-2 block text-sm font-bold text-slate-700">Start a new conversation</label>
              <div className="relative">
                <input
                  type="search"
                  placeholder="Search students by name…"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); searchUsers(e.target.value); }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-violet-400"
                />
                {searching && (
                  <span className="absolute right-3 top-3 text-xs text-slate-400">Searching…</span>
                )}
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                  {searchResults.map((r) => (
                    <Link key={r.id} href={`/messages/${r.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-violet-50 transition border-b border-slate-100 last:border-0">
                      <Avatar name={r.full_name} />
                      <div>
                        <p className="font-bold text-slate-900">{r.full_name}</p>
                        <p className="text-xs text-slate-400">Tap to message</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {searchQuery.length > 1 && !searching && searchResults.length === 0 && (
                <p className="mt-2 text-xs text-slate-400">No students found matching "{searchQuery}"</p>
              )}
            </div>

            {/* Inbox threads */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => <div key={n} className="animate-pulse rounded-[20px] bg-slate-100 h-16" />)}
              </div>
            ) : threads.length === 0 ? (
              <div className="rounded-[24px] bg-slate-50 p-8 text-center ring-1 ring-slate-200">
                <p className="text-xl font-black text-slate-900">No messages yet</p>
                <p className="mt-2 text-sm text-slate-500">
                  Search for a student above to start a conversation.
                </p>
              </div>
            ) : (
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Recent conversations</p>
                <div className="divide-y divide-slate-100 rounded-[20px] border border-slate-200 overflow-hidden">
                  {threads.map((thread) => (
                    <Link key={thread.partner_id} href={`/messages/${thread.partner_id}`}
                      className="flex items-center gap-4 px-4 py-4 hover:bg-violet-50 transition">
                      <div className="relative">
                        <Avatar name={thread.partner_name} />
                        {thread.unread > 0 && (
                          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                            {thread.unread}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`font-bold text-slate-900 ${thread.unread > 0 ? "text-violet-900" : ""}`}>
                            {thread.partner_name}
                          </p>
                          <span className="text-xs text-slate-400 shrink-0 ml-2">{timeAgo(thread.last_at)}</span>
                        </div>
                        <p className={`text-sm truncate ${thread.unread > 0 ? "font-semibold text-slate-800" : "text-slate-500"}`}>
                          {thread.last_message}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
