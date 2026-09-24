"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Notification } from "@/lib/queries";

// Static content categories — always shown
const BULLETIN_CATEGORIES = [
  {
    slug: "official",
    title: "Official announcements",
    icon: "📢",
    detail: "Authoritative JAMB registration details and exam updates.",
    color: "bg-violet-50 ring-violet-100",
    badge: "bg-violet-100 text-violet-700",
  },
  {
    slug: "prep",
    title: "Preparation updates",
    icon: "📚",
    detail: "Changes affecting your study timetable or exam process.",
    color: "bg-emerald-50 ring-emerald-100",
    badge: "bg-emerald-100 text-emerald-700",
  },
  {
    slug: "tips",
    title: "Study tips",
    icon: "💡",
    detail: "Short educational insights to improve your revision strategy.",
    color: "bg-amber-50 ring-amber-100",
    badge: "bg-amber-100 text-amber-700",
  },
  {
    slug: "app",
    title: "App announcements",
    icon: "🚀",
    detail: "Platform changes, releases, and new learning tools.",
    color: "bg-blue-50 ring-blue-100",
    badge: "bg-blue-100 text-blue-700",
  },
];

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export default function JambCentralPage() {
  const { user, loading: authLoading } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    // Fetch the user's notifications to show as a personalised bulletin feed
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setNotifications((data as Notification[]) ?? []))
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const unread = notifications.filter((n) => !n.read_at);

  return (
    <main className="min-h-screen bg-[#eef2ff] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[30px] bg-white p-6 ring-1 ring-slate-200 shadow-[0_18px_60px_rgba(93,74,228,0.1)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500">Study Bulletin</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Information Centre</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/notifications" className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
              All notifications {unread.length > 0 && <span className="ml-1 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread.length}</span>}
            </Link>
            <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              Dashboard
            </Link>
          </div>
        </div>

        {/* Category cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          {BULLETIN_CATEGORIES.map((cat) => (
            <div key={cat.slug} className={`rounded-[28px] p-5 ring-1 ${cat.color}`}>
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-xl shadow-sm ring-1 ring-slate-100">
                  {cat.icon}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-slate-900">{cat.title}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cat.badge}`}>Info</span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{cat.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Personalised notifications feed */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900">Your notifications</h2>
            {unread.length > 0 && (
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                {unread.length} unread
              </span>
            )}
          </div>

          {!user && !authLoading ? (
            <div className="rounded-[24px] bg-slate-50 p-6 text-center ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-700">
                <Link href="/" className="text-violet-600 underline">Sign in</Link> to see personalised announcements.
              </p>
            </div>
          ) : loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => <div key={n} className="animate-pulse rounded-[20px] bg-slate-100 h-14" />)}
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-[24px] bg-slate-50 p-8 text-center ring-1 ring-slate-200">
              <p className="text-lg font-black text-slate-900">No announcements yet</p>
              <p className="mt-2 text-sm text-slate-500">
                New announcements, achievements, and study reminders will appear here.
              </p>
              <Link href="/practice" className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">
                Start studying
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <div key={n.id}
                  className={`flex items-start justify-between rounded-[20px] p-4 ring-1 transition ${n.read_at ? "bg-slate-50 ring-slate-200" : "bg-violet-50 ring-violet-200"}`}>
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-600" />}
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">{n.title}</p>
                      <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>
                    </div>
                  </div>
                  <span className="ml-4 shrink-0 text-xs text-slate-400">{timeAgo(n.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
