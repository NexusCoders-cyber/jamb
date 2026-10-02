"use client";

/**
 * People — "People you may know", Facebook style.
 *
 * A dedicated page (moved out of Messages/Community) where suggestions are
 * ranked by real mutual-friend counts, and every card has one-tap
 * Add-friend + Message actions. A search box doubles as a student finder.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import Avatar from "@/components/Avatar";
import OnlineDot from "@/components/OnlineDot";
import FriendButton from "@/components/FriendButton";
import { getSuggestedPeople, searchPeople, type SuggestedPerson } from "@/lib/queries";
import { MessageCircle, Search, Sparkles, Swords, UserPlus } from "lucide-react";

type Person = {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  course?: string | null;
  interests?: string[] | null;
  streak_days?: number | null;
  user_code?: string | null;
};

export default function PeoplePage() {
  const { user, loading: authLoading } = useUser();

  const [suggestions, setSuggestions] = useState<SuggestedPerson[]>([]);
  const [loading, setLoading] = useState(true);

  // Search — when empty we show suggestions, when typing we show matches.
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);

  // ── Load suggestions (mutual-chat-graph RPC) + no-op state ─────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    const supabase = createSupabaseBrowserClient();
    getSuggestedPeople(supabase).then((rows) => {
      setSuggestions(rows);
      setLoading(false);
    });
  }, [user, authLoading]);

  // ── Debounced search by name or user code ─────────────────────────────────
  useEffect(() => {
    if (!user || !query.trim()) { setResults([]); setSearching(false); return; }
    let mounted = true;
    setSearching(true);
    const t = setTimeout(() => {
      const supabase = createSupabaseBrowserClient();
      searchPeople(supabase, query, user.id).then((rows) => {
        if (mounted) { setResults(rows as Person[]); setSearching(false); }
      });
    }, 300);
    return () => { mounted = false; clearTimeout(t); };
  }, [query, user]);

  const showing: Array<Person & { mutual_count: number }> = useMemo(
    () => (query.trim()
      ? results.map((r) => ({ ...r, mutual_count: 0 }))
      : suggestions.map((s) => ({ ...s, mutual_count: s.mutual_count ?? 0 }))),
    [query, results, suggestions],
  );

  return (
    <AppShell title="People you may know">
      <AuthGuard user={user} loading={authLoading}>
        <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-4xl lg:px-6">
          {/* Hero */}
          <div className="mb-5 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#41348f] to-[#6557d9] p-6 text-white shadow-xl shadow-violet-300/25">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-violet-200">
              <Sparkles className="h-4 w-4 text-[#f6c978]" aria-hidden /> Grow your circle
            </p>
            <h1 className="mt-2 text-3xl font-black">People you may know</h1>
            <p className="mt-2 max-w-md text-sm text-violet-100">
              Classmates and study partners ranked by mutual friends. Add them, message them, challenge them to a duel.
            </p>
          </div>

          {/* Search — name or user code */}
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="search"
              placeholder="Search any student by name or ID (e.g. QB-7K3X9)…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-violet-400"
            />
            {searching && <span className="absolute right-4 top-3.5 text-xs text-slate-400">Searching…</span>}
          </div>

          {/* Section heading */}
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            {query.trim() ? `Results for “${query.trim()}”` : "Suggested for you"}
          </p>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="h-56 animate-pulse rounded-[24px] bg-slate-100" />)}
            </div>
          ) : showing.length === 0 ? (
            <div className="rounded-[24px] bg-white p-10 text-center ring-1 ring-slate-200">
              <UserPlus className="mx-auto h-8 w-8 text-violet-400" aria-hidden />
              <p className="mt-2 text-lg font-black text-slate-900">
                {query.trim() ? "No students found" : "No suggestions yet"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {query.trim()
                  ? "Try a different name or user ID."
                  : "Chat with a few classmates and suggestions will appear here."}
              </p>
              <Link href="/arena" className="mt-4 inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700">
                <Swords className="h-4 w-4" aria-hidden /> Meet players in the Arena
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {showing.map((p) => (
                <div key={p.id} className="flex flex-col items-center rounded-[24px] bg-white p-4 text-center ring-1 ring-slate-200">
                  <Link href={`/profile/${p.id}`} aria-label={`View ${p.full_name}'s profile`}>
                    <span className="relative mx-auto block w-fit">
                      <Avatar user={{ full_name: p.full_name, avatar_url: p.avatar_url ?? null }} />
                      <OnlineDot userId={p.id} size={40} />
                    </span>
                  </Link>
                  <Link href={`/profile/${p.id}`} className="mt-2 w-full">
                    <p className="w-full truncate text-sm font-black text-slate-900 hover:text-violet-700">{p.full_name}</p>
                  </Link>
                  {p.course && <p className="w-full truncate text-[11px] font-semibold text-slate-400">{p.course}</p>}
                  {p.mutual_count > 0 && (
                    <p className="mt-0.5 text-[10px] font-bold text-violet-600">
                      {p.mutual_count} mutual {p.mutual_count === 1 ? "friend" : "friends"}
                    </p>
                  )}
                  {p.user_code && <p className="font-mono text-[10px] text-slate-400">{p.user_code}</p>}
                  <div className="mt-3 w-full space-y-1.5">
                    {/* Add friend — one tap, Facebook style */}
                    <FriendButton targetUserId={p.id} />
                    {/* Message — one tap */}
                    <Link href={`/messages/${p.id}`}
                      className="flex w-full items-center justify-center gap-1.5 rounded-full bg-violet-600 px-3 py-2 text-xs font-black text-white transition hover:bg-violet-700">
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Message
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!query.trim() && !loading && suggestions.length > 0 && (
            <p className="mt-3 text-center text-[11px] text-slate-400">
              Ranked by mutual friends from real chats — the more you connect, the smarter it gets.
            </p>
          )}
        </div>
      </AuthGuard>
    </AppShell>
  );
}
