"use client";

/**
 * Messages — two separate navigation spaces (Facebook/WhatsApp style):
 *
 *   Chats     — your conversations + a link to People you may know (/people).
 *   Students  — directory with search by name, course or institution interests,
 *               so you can find friends aspiring to the same course.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import Avatar from "@/components/Avatar";
import OnlineDot from "@/components/OnlineDot";
import { getDMInbox, type DMThread } from "@/lib/queries";
import { Search, Users, MessageSquare, Sparkles, GraduationCap } from "lucide-react";

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

/** Similarity score between me and another student (higher = more in common). */
function affinity(me: Student | null, other: Student): number {
  if (!me) return 0;
  let score = 0;
  if (me.course && other.course && me.course.trim().toLowerCase() === other.course.trim().toLowerCase()) score += 5;
  const mine = new Set((me.interests ?? []).map((i) => i.toLowerCase()));
  for (const i of other.interests ?? []) if (mine.has(i.toLowerCase())) score += 2;
  return score;
}

export default function MessagesPage() {
  const { user, loading: authLoading } = useUser();
  const [tab, setTab] = useState<"chats" | "students">("chats");

  const [threads, setThreads] = useState<DMThread[]>([]);
  const [loading, setLoading] = useState(true);

  // My profile (course + interests power the Students tab)
  const [me, setMe] = useState<Student | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);

  // Chats search
  const [chatQuery, setChatQuery] = useState("");

  // Students directory search — name, course, or institution/interest
  const [studentQuery, setStudentQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [searching, setSearching] = useState(false);
  const [remoteResults, setRemoteResults] = useState<Student[] | null>(null);

  // ── Load my profile, inbox, the student directory and mutual-based suggestions ─
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    const supabase = createSupabaseBrowserClient();
    Promise.all([
      getDMInbox(supabase, user.id),
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url, course, interests, streak_days")
        .eq("id", user.id)
        .single(),
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url, course, interests, streak_days")
        .neq("id", user.id)
        .order("full_name")
        .limit(200),
    ])
      .then(([inbox, profileRes, studentsRes]) => {
        setThreads(inbox);
        setMe((profileRes.data ?? null) as Student | null);
        setAllStudents((studentsRes.data ?? []) as Student[]);
      })
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  // ── Remote name search (students tab) when the local directory is exhausted ─
  useEffect(() => {
    if (!user) return;
    const q = studentQuery.trim();
    if (q.length < 2) { setRemoteResults(null); setSearching(false); return; }
    // Only hit the server for name-like queries; course/interest filtering is local
    const looksLikeName = !courseFilter;
    if (!looksLikeName) { setRemoteResults(null); return; }
    let mounted = true;
    setSearching(true);
    const t = setTimeout(() => {
      const supabase = createSupabaseBrowserClient();
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url, course, interests, streak_days")
        .ilike("full_name", `%${q}%`)
        .neq("id", user.id)
        .limit(20)
        .then(({ data }) => {
          if (mounted) { setRemoteResults((data ?? []) as Student[]); setSearching(false); }
        });
    }, 300);
    return () => { mounted = false; clearTimeout(t); };
  }, [studentQuery, courseFilter, user]);

  // ── Chats tab filtering ────────────────────────────────────────────────────
  const visibleThreads = threads.filter((t) => {
    if (!chatQuery.trim()) return true;
    const q = chatQuery.trim().toLowerCase();
    return t.partner_name.toLowerCase().includes(q) || t.last_message.toLowerCase().includes(q);
  });

  // ── Students tab filtering: name OR course OR institution interest ────────
  const visibleStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    const cf = courseFilter.trim().toLowerCase();
    let list = remoteResults ?? allStudents;
    if (remoteResults && (cf || (q && !remoteResults.some((s) => s.full_name.toLowerCase().includes(q))))) {
      // merge remote + local for course filtering over remote results
      list = [...remoteResults, ...allStudents.filter((s) => !remoteResults.some((r) => r.id === s.id))];
    }
    return list.filter((s) => {
      if (cf && !(s.course ?? "").toLowerCase().includes(cf)) return false;
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        (s.course ?? "").toLowerCase().includes(q) ||
        (s.interests ?? []).some((i) => i.toLowerCase().includes(q))
      );
    });
  }, [allStudents, remoteResults, studentQuery, courseFilter]);

  // Distinct courses for quick-filter chips (students tab)
  const courseChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of allStudents) {
      const c = (s.course ?? "").trim();
      if (c.length > 1) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [allStudents]);

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
                <span className="text-[10px] font-bold text-slate-400">{allStudents.length}</span>
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
            {tab === "students" && (
              <>
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
                  <input
                    type="search"
                    placeholder="Search by name, course or institution…"
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none focus:border-violet-400"
                  />
                  {searching && <span className="absolute right-3 top-3.5 text-xs text-slate-400">Searching…</span>}
                </div>

                <div className="relative mb-3">
                  <GraduationCap className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
                  <input
                    type="search"
                    placeholder="Filter by aspiring course (e.g. Medicine)…"
                    value={courseFilter}
                    onChange={(e) => setCourseFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none focus:border-violet-400"
                  />
                </div>

                {courseChips.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {courseChips.map(([course, count]) => (
                      <button key={course} type="button"
                        onClick={() => setCourseFilter(courseFilter === course ? "" : course)}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                          courseFilter === course ? "bg-violet-600 text-white" : "bg-violet-50 text-violet-700 hover:bg-violet-100"
                        }`}>
                        {course} · {count}
                      </button>
                    ))}
                  </div>
                )}

                {!loading && visibleStudents.length === 0 ? (
                  <div className="rounded-[24px] bg-slate-50 p-8 text-center ring-1 ring-slate-200">
                    <p className="text-lg font-black text-slate-900">No students found</p>
                    <p className="mt-2 text-sm text-slate-500">Try a different name, course or subject.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {visibleStudents.map((s) => {
                      const score = affinity(me, s);
                      return (
                        <div key={s.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-violet-50">
                          <Link href={`/profile/${s.id}`} className="shrink-0" aria-label={`View ${s.full_name}'s profile`}>
                            <Avatar user={s} size="lg" />
                          </Link>
                          <Link href={`/profile/${s.id}`} className="min-w-0 flex-1">
                            <p className="flex items-center gap-2 truncate text-sm font-bold text-slate-900">
                              {s.full_name}
                              {score >= 5 && (
                                <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-700">SAME COURSE</span>
                              )}
                            </p>
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
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        </AuthGuard>
      </div>
    </AppShell>
  );
}
