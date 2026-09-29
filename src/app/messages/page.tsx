"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import { getDMInbox, type DMThread } from "@/lib/queries";
import Avatar from "@/components/Avatar";
import { Search, Users } from "lucide-react";

type Student = {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  course?: string;
  interests?: string[] | null;
  streak_days?: number;
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function MessagesPage() {
  const { user, loading: authLoading } = useUser();
  const [threads, setThreads] = useState<DMThread[]>([]);
  const [loading, setLoading] = useState(true);

  // New conversation — search for a user by name to start DM
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; full_name: string }[]>([]);
  const [searching, setSearching] = useState(false);

  // Students browser — all users with their interests, so you can add friends
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    const supabase = createSupabaseBrowserClient();
    getDMInbox(supabase, user.id).then(setThreads).finally(() => setLoading(false));
  }, [user, authLoading]);

  // Load all students (excluding me) for the friends browser
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setStudentsLoading(false); return; }
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, course, interests, streak_days")
      .neq("id", user.id)
      .order("full_name")
      .limit(50)
      .then(({ data }) => {
        setStudents((data ?? []) as Student[]);
        setStudentsLoading(false);
      });
  }, [user, authLoading]);

  async function searchUsers(q: string) {
    if (!q.trim() || !user) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .ilike("full_name", `%${q}%`)
        .neq("id", user.id)
        .limit(8);
      setSearchResults(data ?? []);
    } finally {
      setSearching(false);
    }
  }

  const [studentFilter, setStudentFilter] = useState("");
  const visibleStudents = students.filter((s) => {
    if (!studentFilter.trim()) return true;
    const q = studentFilter.trim().toLowerCase();
    return (
      s.full_name.toLowerCase().includes(q) ||
      (s.course ?? "").toLowerCase().includes(q) ||
      (s.interests ?? []).some((i) => i.toLowerCase().includes(q))
    );
  });

  const totalUnread = threads.reduce((s, t) => s + t.unread, 0);

  return (
    <AppShell title="Messages">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-black text-slate-900">
            Messages {totalUnread > 0 && <span className="ml-2 rounded-full bg-violet-600 px-2 py-0.5 text-sm font-bold text-white">{totalUnread}</span>}
          </h1>
          <Link href="/community" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Community</Link>
        </div>
        <AuthGuard user={user} loading={authLoading}>
          <>
            {/* Students browser — discover users and add friends */}
            <section className="mb-6 rounded-[24px] bg-white p-4 ring-1 ring-slate-200">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                <Users className="h-4 w-4" aria-hidden /> Students
              </p>
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden />
                <input
                  type="search"
                  placeholder="Filter students by name or interest…"
                  value={studentFilter}
                  onChange={(e) => setStudentFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-violet-400"
                />
              </div>
              {studentsLoading ? (
                <div className="space-y-2">{[1, 2, 3].map((n) => <div key={n} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>
              ) : visibleStudents.length === 0 ? (
                <p className="py-3 text-sm text-slate-400">No students found yet — invite your friends to join Orbit Prep.</p>
              ) : (
                <div className="space-y-1">
                  {visibleStudents.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-violet-50">
                      <Link href={`/profile/${s.id}`} className="shrink-0" aria-label={`View ${s.full_name}'s profile`}>
                        <Avatar user={s} size="lg" />
                      </Link>
                      <Link href={`/profile/${s.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{s.full_name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          {s.course && (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">{s.course}</span>
                          )}
                          {(s.interests ?? []).slice(0, 3).map((i) => (
                            <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{i.replace(" Language", "")}</span>
                          ))}
                          {typeof s.streak_days === "number" && s.streak_days > 0 && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">{s.streak_days}d streak</span>
                          )}
                        </div>
                      </Link>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Link href={`/messages/${s.id}`}
                          className="rounded-full bg-violet-600 px-3 py-1.5 text-[10px] font-bold text-white">Message</Link>
                        <Link href={`/profile/${s.id}`}
                          className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-[10px] font-bold text-violet-700" aria-label={`View ${s.full_name}'s profile`}>Profile</Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

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
                      <Avatar user={r} size="lg" />
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
                    <div key={thread.partner_id} className="group flex items-center gap-4 px-4 py-4 transition hover:bg-violet-50">
                      <Link href={`/messages/${thread.partner_id}`} className="flex min-w-0 flex-1 items-center gap-4" aria-label={`Open chat with ${thread.partner_name}`}>
                        <div className="relative">
                          <Avatar user={{ full_name: thread.partner_name, avatar_url: thread.partner_avatar_url }} size="lg" />
                          {thread.unread > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                              {thread.unread}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className={`font-bold text-slate-900 ${thread.unread > 0 ? "text-violet-900" : ""}`}>
                              {thread.partner_name}
                            </p>
                            <span className="ml-2 shrink-0 text-xs text-slate-400">{timeAgo(thread.last_at)}</span>
                          </div>
                          <p className={`truncate text-sm ${thread.unread > 0 ? "font-semibold text-slate-800" : "text-slate-500"}`}>
                            {thread.last_message}
                          </p>
                        </div>
                      </Link>
                      <Link href={`/profile/${thread.partner_id}`}
                        className="shrink-0 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-[10px] font-bold text-violet-700"
                        aria-label={`View ${thread.partner_name}'s profile`}>
                        Profile
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        </AuthGuard>
      </div>
    </AppShell>
  );
}
