"use client";

/**
 * Messages — two separate navigation spaces (Facebook/WhatsApp style):
 *
 *   Chats     — your conversations + a link to People you may know (/people).
 *   Students  — directory (components/StudentsTab.tsx) with search by name, course or subject,
 *               so you can find friends aiming for the same course.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import Avatar from "@/components/Avatar";
import OnlineDot from "@/components/OnlineDot";
import StudentsTab from "@/components/StudentsTab";
import { getDMInbox, type DMThread } from "@/lib/queries";
import { DIRECTORY_FETCH_LIMIT, withoutHidden, type Student } from "@/lib/studentDirectory";
import { Search, Users, MessageSquare, Sparkles } from "lucide-react";

const STUDENT_COLUMNS = "id, full_name, avatar_url, course, interests, streak_days";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function MessagesPage() {
  const { user, loading: authLoading } = useUser();
  const [tab, setTab] = useState<"chats" | "students">("chats");

  const [threads, setThreads] = useState<DMThread[]>([]);
  const [loading, setLoading] = useState(true);

  // My profile (course + subjects decide who is listed first in the Students tab) and the student directory
  const [me, setMe] = useState<Student | null>(null);
  const [rawStudents, setRawStudents] = useState<Student[]>([]);
  const [blocked, setBlocked] = useState<ReadonlySet<string>>(() => new Set());
  const [studentsError, setStudentsError] = useState(false);

  // Chats search
  const [chatQuery, setChatQuery] = useState("");

  const load = useCallback(async (uid: string) => {
    const supabase = createSupabaseBrowserClient();
    try {
      // Most recently active first, so a big school's directory shows the people who are actually around
      let students = await supabase
        .from("profiles")
        .select(STUDENT_COLUMNS)
        .neq("id", uid)
        .order("last_seen_at", { ascending: false, nullsFirst: false })
        .limit(DIRECTORY_FETCH_LIMIT);
      if (students.error) {
        // last_seen_at not added to this database yet: fall back to A–Z
        students = await supabase.from("profiles").select(STUDENT_COLUMNS).neq("id", uid).order("full_name").limit(DIRECTORY_FETCH_LIMIT);
      }
      const [inbox, profileRes, blockRes] = await Promise.all([
        getDMInbox(supabase, uid),
        supabase.from("profiles").select(STUDENT_COLUMNS).eq("id", uid).maybeSingle(),
        supabase.from("user_blocks").select("blocked_id").eq("blocker_id", uid),
      ]);
      setThreads(inbox);
      setMe((profileRes.data ?? null) as Student | null);
      setBlocked(new Set(((blockRes.data ?? []) as { blocked_id: string }[]).map((r) => r.blocked_id)));
      if (students.error) setStudentsError(true);
      else setRawStudents((students.data ?? []) as Student[]);
    } catch {
      setStudentsError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Signed-out visitors get the sign-in prompt from AuthGuard, so there is nothing to load for them
    if (authLoading || !user) return;
    const t = window.setTimeout(() => void load(user.id), 0);
    return () => window.clearTimeout(t);
  }, [user, authLoading, load]);

  const directory = useMemo(() => withoutHidden(rawStudents, user?.id, blocked), [rawStudents, user?.id, blocked]);

  // ── Chats tab filtering ────────────────────────────────────────────────────
  const visibleThreads = threads.filter((t) => {
    if (!chatQuery.trim()) return true;
    const q = chatQuery.trim().toLowerCase();
    return t.partner_name.toLowerCase().includes(q) || t.last_message.toLowerCase().includes(q);
  });

  const totalUnread = threads.reduce((s, t) => s + t.unread, 0);

  return (
    <AppShell title="Messages">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-black text-slate-900">
            Messages {totalUnread > 0 && <span className="ml-2 rounded-full bg-violet-600 px-2 py-0.5 text-sm font-bold text-white">{totalUnread}</span>}
          </h1>
          <Link
            href="/community"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-700"
          >
            Community
          </Link>
        </div>
        <AuthGuard user={user} loading={authLoading}>
          <>
            {/* ── Tab switcher: separate Chats and Students navigation ── */}
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setTab("chats")}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black transition ${
                  tab === "chats" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <MessageSquare className="h-4 w-4" aria-hidden />
                Chats
                {totalUnread > 0 && (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">{totalUnread}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setTab("students")}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black transition ${
                  tab === "students" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Users className="h-4 w-4" aria-hidden />
                Students
                {directory.length > 0 && <span className="text-[10px] font-bold text-slate-400">{directory.length}</span>}
              </button>
            </div>

            {/* ══ CHATS TAB ══ */}
            {tab === "chats" && (
              <>
                <div className="relative mb-4">
                  <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
                  <input
                    type="search"
                    placeholder="Search your chats…"
                    value={chatQuery}
                    onChange={(e) => setChatQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none focus:border-violet-400"
                  />
                </div>

                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((n) => <div key={n} className="h-16 animate-pulse rounded-[20px] bg-slate-100" />)}
                  </div>
                ) : visibleThreads.length === 0 ? (
                  <div className="rounded-[24px] bg-slate-50 p-8 text-center ring-1 ring-slate-200">
                    <p className="text-lg font-black text-slate-900">No conversations yet</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Open the <button type="button" onClick={() => setTab("students")} className="font-bold text-violet-600 underline">Students</button> tab to find friends to chat with.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-[20px] border border-slate-200 overflow-hidden">
                    {visibleThreads.map((thread) => (
                      <div key={thread.partner_id} className="flex items-center gap-4 px-4 py-4 transition hover:bg-violet-50">
                        <Link href={`/messages/${thread.partner_id}`} className="flex min-w-0 flex-1 items-center gap-4" aria-label={`Open chat with ${thread.partner_name}`}>
                          <div className="relative">
                            <Avatar user={{ full_name: thread.partner_name, avatar_url: thread.partner_avatar_url }} size="lg" />
                            <OnlineDot userId={thread.partner_id} size={48} />
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
                )}

                <Link href="/messages/blocked" className="mt-4 block text-center text-xs font-semibold text-slate-400 hover:text-slate-600">
                  Blocked people
                </Link>

                {/* People you may know — moved to its own Facebook-style page */}
                {!loading && (
                  <Link href="/people"
                    className="mt-6 flex items-center gap-3 rounded-[24px] bg-white p-4 ring-1 ring-slate-200 transition hover:ring-violet-300">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100">
                      <Sparkles className="h-5 w-5 text-violet-600" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-slate-900">People you may know</span>
                      <span className="block text-xs text-slate-500">Suggestions from your classmates — add friends &amp; start chatting</span>
                    </span>
                    <span className="shrink-0 text-lg text-violet-600" aria-hidden>→</span>
                  </Link>
                )}
              </>
            )}

            {/* ══ STUDENTS TAB ══ */}
            {tab === "students" && user && (
              <StudentsTab
                myId={user.id}
                me={me}
                directory={directory}
                blocked={blocked}
                loading={loading}
                loadError={studentsError}
                onRetry={() => { setStudentsError(false); setLoading(true); void load(user.id); }}
              />
            )}
          </>
        </AuthGuard>
      </div>
    </AppShell>
  );
}
