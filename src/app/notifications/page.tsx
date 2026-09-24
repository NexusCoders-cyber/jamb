"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getNotifications, markAllNotificationsRead } from "@/lib/queries";
import type { Notification } from "@/lib/queries";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useUser();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    const supabase = createSupabaseBrowserClient();
    getNotifications(supabase, user.id)
      .then((rows) => setNotifications(rows))
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  async function handleMarkAllRead() {
    if (!user || marking) return;
    setMarking(true);
    const supabase = createSupabaseBrowserClient();
    await markAllNotificationsRead(supabase, user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setMarking(false);
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <main className="min-h-screen bg-[#eef2ff] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-[30px] bg-white p-6 ring-1 ring-slate-200 shadow-[0_18px_60px_rgba(93,74,228,0.1)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500">Notifications</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">
              Center {unreadCount > 0 && <span className="ml-2 rounded-full bg-violet-600 px-2 py-0.5 text-sm font-bold text-white">{unreadCount}</span>}
            </h1>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={marking}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              {marking ? "Marking…" : "Mark all read"}
            </button>
          )}
        </div>

        {!user && !authLoading ? (
          <div className="rounded-[24px] bg-slate-50 p-8 text-center ring-1 ring-slate-200">
            <p className="font-bold text-slate-700">Sign in to view your notifications</p>
            <Link href="/" className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">Sign in</Link>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="animate-pulse rounded-[24px] bg-slate-100 p-4 h-16" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-[24px] bg-slate-50 p-8 text-center ring-1 ring-slate-200">
            <p className="text-lg font-black text-slate-900">You&apos;re all caught up</p>
            <p className="mt-2 text-sm text-slate-500">No notifications yet. Keep studying to earn achievements!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((item) => (
              <div
                key={item.id}
                className={`flex items-start justify-between rounded-[24px] p-4 ring-1 transition ${item.read_at ? "bg-slate-50 ring-slate-200" : "bg-violet-50 ring-violet-200"}`}
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    {!item.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-violet-600" />}
                    <p className="text-lg font-black text-slate-900">{item.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                  <p className="mt-1 text-xs text-slate-400">{relativeTime(item.created_at)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-violet-100 px-3 py-1 text-[10px] font-bold text-violet-700">
                  {item.read_at ? "Read" : "New"}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <Link href="/dashboard" className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
