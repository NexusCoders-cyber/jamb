"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getProfile, getUserAttempts } from "@/lib/queries";

const STREAK_MILESTONES = [
  { days: 1, label: "First Step" },
  { days: 3, label: "3-Day Starter" },
  { days: 7, label: "One Week Warrior" },
  { days: 14, label: "Two-Week Champion" },
  { days: 30, label: "30-Day Scholar" },
  { days: 100, label: "100-Day Scholar" },
];

function longestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const unique = [...new Set(dates.map((d) => d.slice(0, 10)))].sort();
  let best = 1, cur = 1;
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1]);
    const curr = new Date(unique[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    cur = diff === 1 ? cur + 1 : 1;
    if (cur > best) best = cur;
  }
  return best;
}

function weeklyActivity(dates: string[]): number {
  const oneWeekAgo = Date.now() - 7 * 86400000;
  const activeDays = new Set(
    dates.filter((d) => new Date(d).getTime() >= oneWeekAgo).map((d) => d.slice(0, 10)),
  );
  return activeDays.size;
}

export default function StreaksPage() {
  const { user, loading: authLoading } = useUser();

  const [streakDays, setStreakDays] = useState(0);
  const [longestStreakDays, setLongestStreakDays] = useState(0);
  const [weekly, setWeekly] = useState(0);
  const [dailyDone, setDailyDone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    const supabase = createSupabaseBrowserClient();
    Promise.all([getProfile(supabase, user.id), getUserAttempts(supabase, user.id, 200)])
      .then(([profile, attempts]) => {
        if (profile) setStreakDays(profile.streak_days);

        const dates = attempts
          .map((a) => a.submitted_at ?? a.started_at)
          .filter(Boolean) as string[];

        setLongestStreakDays(longestStreak(dates));
        setWeekly(weeklyActivity(dates));

        // Daily done = any attempt today
        const today = new Date().toISOString().slice(0, 10);
        setDailyDone(dates.some((d) => d.slice(0, 10) === today));
      })
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const unlockedBadges = STREAK_MILESTONES.filter((m) => longestStreakDays >= m.days);
  const lockedBadges = STREAK_MILESTONES.filter((m) => longestStreakDays < m.days);

  const metrics = [
    { label: "Current streak", value: loading ? "…" : `${streakDays} ${streakDays === 1 ? "day" : "days"}` },
    { label: "Longest streak", value: loading ? "…" : `${longestStreakDays} ${longestStreakDays === 1 ? "day" : "days"}` },
    { label: "Daily goal", value: loading ? "…" : dailyDone ? "Completed ✓" : "Pending" },
    { label: "Weekly activity", value: loading ? "…" : `${weekly}/7 days` },
  ];

  return (
    <main className="min-h-screen bg-[#eef2ff] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[30px] bg-white p-6 ring-1 ring-slate-200 shadow-[0_18px_60px_rgba(93,74,228,0.1)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500">Streaks &amp; Achievements</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Progress &amp; Milestones</h1>
          </div>
          <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Dashboard
          </Link>
        </div>

        {!user && !authLoading ? (
          <div className="rounded-[24px] bg-slate-50 p-8 text-center ring-1 ring-slate-200">
            <p className="font-bold text-slate-700">Sign in to track your streaks</p>
            <Link href="/" className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">Sign in</Link>
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
                  <p className="mt-3 text-2xl font-black text-slate-900">{metric.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-[28px] bg-slate-50 p-6 ring-1 ring-slate-200">
              <h2 className="mb-5 text-2xl font-black text-slate-900">Achievements</h2>

              {unlockedBadges.length > 0 && (
                <div className="mb-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Unlocked</p>
                  <div className="flex flex-wrap gap-3">
                    {unlockedBadges.map((badge) => (
                      <span key={badge.label} className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">
                        🏅 {badge.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {lockedBadges.length > 0 && (
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Locked</p>
                  <div className="flex flex-wrap gap-3">
                    {lockedBadges.map((badge) => (
                      <span key={badge.label} className="rounded-full bg-slate-200 px-4 py-2 text-sm font-bold text-slate-500">
                        🔒 {badge.label} ({badge.days} days)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {unlockedBadges.length === 0 && lockedBadges.length === 0 && (
                <p className="text-sm text-slate-400">Complete exams daily to earn badges.</p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
