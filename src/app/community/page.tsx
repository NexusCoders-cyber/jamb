"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import { getChannels, type Channel } from "@/lib/queries";
import Avatar from "@/components/Avatar";
import { ArrowRight, MessagesSquare, Users } from "lucide-react";

type Person = { id: string; full_name: string; avatar_url?: string | null; streak_days?: number };

function PeopleBrowser({ myId }: { myId: string }) {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setPeople([]); return; }
    let mounted = true;
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const t = setTimeout(() => {
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url, streak_days")
        .ilike("full_name", `%${query.trim()}%`)
        .neq("id", myId)
        .limit(12)
        .then(({ data }) => {
          if (mounted) { setPeople((data ?? []) as Person[]); setLoading(false); }
        });
    }, 300);
    return () => { mounted = false; clearTimeout(t); };
  }, [query, myId]);

  return (
    <div className="rounded-[24px] bg-white p-4 ring-1 ring-slate-200">
      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
        <Users className="h-4 w-4" aria-hidden /> Find students
      </p>
      <input
        type="search"
        placeholder="Search by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400"
      />
      {loading && <p className="py-2 text-xs text-slate-400">Searching…</p>}
      {!loading && query.trim() && people.length === 0 && (
        <p className="py-2 text-xs text-slate-400">No students found.</p>
      )}
      <div className="space-y-1">
        {people.map((p) => (
          <Link key={p.id} href={`/messages/${p.id}`}
            className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-violet-50">
            <Avatar user={p} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">{p.full_name}</p>
              {typeof p.streak_days === "number" && (
                <p className="text-[11px] text-slate-400">{p.streak_days}-day streak</p>
              )}
            </div>
            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold text-violet-700">Message</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const { user, loading: authLoading } = useUser();

  // Join gate — first visit asks the student to pick interest channels
  const [joined, setJoined] = useState<boolean | null>(null); // null = loading
  const [pickedChannels, setPickedChannels] = useState<string[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);

  // Load channels on mount + check whether the student already joined
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

  const myName = user?.user_metadata?.full_name as string | undefined;

  // ── Join community onboarding ────────────────────────────────────────────
  if (joined === false) {
    return (
      <AppShell title="Community">
        <div className="mx-auto max-w-xl px-4 py-6">
          <div className="mb-6 rounded-[28px] bg-gradient-to-br from-violet-600 to-violet-500 p-6 text-white shadow-xl shadow-violet-300/25">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-100">Orbit Community</p>
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
          {/* Channel directory — click a channel to enter it */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Pick a channel to enter</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {channels.map((ch) => (
                <Link key={ch.id} href={`/community/${ch.slug}`}
                  className="group rounded-[24px] bg-white p-5 ring-1 ring-slate-200 transition hover:ring-violet-300 hover:shadow-md">
                  <span className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-lg font-black text-violet-700">
                      {ch.name.slice(0, 1).toUpperCase()}
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-600" aria-hidden />
                  </span>
                  <span className="mt-3 block text-base font-black text-slate-900">{ch.name}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-400">#{ch.slug}</span>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-violet-600">
                    <MessagesSquare className="h-3.5 w-3.5" aria-hidden /> Enter channel
                  </span>
                </Link>
              ))}
            </div>
            {channels.length === 0 && (
              <div className="rounded-[24px] bg-white p-8 text-center ring-1 ring-slate-200">
                <p className="text-lg font-black text-slate-900">No channels yet</p>
                <p className="mt-1 text-sm text-slate-500">Check back soon.</p>
              </div>
            )}
          </div>

          {/* Side column */}
          <aside className="space-y-4">
            {user && (
              <>
                <PeopleBrowser myId={user.id} />
                <div className="rounded-[24px] bg-violet-600 p-4 text-white">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">Your profile</p>
                  <div className="mt-3 flex items-center gap-3">
                    <Avatar user={{ full_name: myName ?? user.email ?? "U", avatar_url: null }} />
                    <div className="min-w-0">
                      <p className="truncate font-bold">{myName ?? "Student"}</p>
                      <p className="truncate text-xs text-violet-200">{user.email}</p>
                    </div>
                  </div>
                  <Link href="/settings" className="mt-3 block rounded-xl bg-white/10 px-3 py-2 text-center text-xs font-bold text-white hover:bg-white/20">
                    Edit profile
                  </Link>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
