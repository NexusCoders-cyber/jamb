"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import type { Notification } from "@/lib/queries";
import { GraduationCap, Lightbulb, Library, Megaphone, Rocket } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Static content categories — always shown
const BULLETIN_CATEGORIES: { slug: string; title: string; icon: LucideIcon; detail: string; color: string; badge: string }[] = [
  {
    slug: "official",
    title: "Official announcements",
    icon: Megaphone,
    detail: "Authoritative JAMB registration details and exam updates.",
    color: "bg-violet-50 ring-violet-100",
    badge: "bg-violet-100 text-violet-700",
  },
  {
    slug: "prep",
    title: "Preparation updates",
    icon: Library,
    detail: "Changes affecting your study timetable or exam process.",
    color: "bg-emerald-50 ring-emerald-100",
    badge: "bg-emerald-100 text-emerald-700",
  },
  {
    slug: "tips",
    title: "Study tips",
    icon: Lightbulb,
    detail: "Short educational insights to improve your revision strategy.",
    color: "bg-amber-50 ring-amber-100",
    badge: "bg-amber-100 text-amber-700",
  },
  {
    slug: "app",
    title: "App announcements",
    icon: Rocket,
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
    void supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setNotifications((data as Notification[]) ?? []);
        setLoading(false);
      })
      .then(undefined, () => setLoading(false));
  }, [user, authLoading]);

  const unread = notifications.filter((n) => !n.read_at);

  return (
    <AppShell title="Info Centre">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-4xl lg:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-black text-slate-900">Info Centre</h1>
          <Link href="/notifications" className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-700">
            Notifications {unread.length > 0 && <span className="ml-1 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread.length}</span>}
          </Link>
        </div>

        {/* Category cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          {BULLETIN_CATEGORIES.map((cat) => (
            <div key={cat.slug} className={`rounded-[28px] p-5 ring-1 ${cat.color}`}>
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                  <cat.icon className="h-5 w-5 text-violet-600" aria-hidden />
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

          {loading ? (
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
    </AppShell>
  );
}
