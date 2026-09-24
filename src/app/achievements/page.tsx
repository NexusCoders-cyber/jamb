"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getProfile, getUserAttempts } from "@/lib/queries";

type Badge = { title: string; description: string; unlocked: boolean };

const BADGE_RULES: Array<{
  title: string;
  description: string;
  check: (streak: number, exams: number, questions: number) => boolean;
}> = [
  { title: "First Step", description: "Complete your first exam", check: (_s, exams) => exams >= 1 },
  { title: "3-Day Starter", description: "Reach a 3-day streak", check: (streak) => streak >= 3 },
  { title: "One Week Warrior", description: "Reach a 7-day streak", check: (streak) => streak >= 7 },
  { title: "Two-Week Champion", description: "Reach a 14-day streak", check: (streak) => streak >= 14 },
  { title: "30-Day Scholar", description: "Reach a 30-day streak", check: (streak) => streak >= 30 },
  { title: "100-Day Scholar", description: "Reach a 100-day streak", check: (streak) => streak >= 100 },
  { title: "Question Master", description: "Answer 500 questions", check: (_s, _e, q) => q >= 500 },
  { title: "Exam Ready", description: "Complete 10 exams", check: (_s, exams) => exams >= 10 },
  { title: "Century Club", description: "Answer 100 questions", check: (_s, _e, q) => q >= 100 },
  { title: "Prolific", description: "Complete 5 exams", check: (_s, exams) => exams >= 5 },
];

export default function AchievementsPage() {
  const { user, loading: authLoading } = useUser();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setBadges(BADGE_RULES.map((r) => ({ title: r.title, description: r.description, unlocked: false })));
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    Promise.all([getProfile(supabase, user.id), getUserAttempts(supabase, user.id, 200)])
      .then(([profile, attempts]) => {
        const streak = profile?.streak_days ?? 0;
        const exams = attempts.length;
        const questions = attempts.reduce((s, a) => s + a.question_count, 0);

        setBadges(
          BADGE_RULES.map((r) => ({
            title: r.title,
            description: r.description,
            unlocked: r.check(streak, exams, questions),
          })),
        );
      })
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const unlocked = badges.filter((b) => b.unlocked);
  const locked = badges.filter((b) => !b.unlocked);

  return (
    <main className="min-h-screen bg-[#eef2ff] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[30px] bg-white p-6 ring-1 ring-slate-200 shadow-[0_18px_60px_rgba(93,74,228,0.1)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500">Achievements</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Streaks &amp; Milestones</h1>
          </div>
          <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Dashboard
          </Link>
        </div>

        {!user && !authLoading && (
          <div className="mb-5 rounded-[20px] bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 ring-1 ring-violet-100">
            Sign in to track your achievements.{" "}
            <Link href="/" className="underline">Sign in</Link>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((n) => <div key={n} className="animate-pulse rounded-[24px] bg-slate-100 h-32" />)}
          </div>
        ) : (
          <>
            {unlocked.length > 0 && (
              <div className="mb-6">
                <h2 className="mb-4 text-lg font-black text-emerald-700">Unlocked ({unlocked.length})</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {unlocked.map((badge) => (
                    <div key={badge.title} className="rounded-[24px] bg-emerald-50 p-5 ring-1 ring-emerald-200">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-xl">🏅</div>
                      <p className="text-lg font-black text-slate-900">{badge.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{badge.description}</p>
                      <span className="mt-3 inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">
                        Unlocked
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {locked.length > 0 && (
              <div>
                <h2 className="mb-4 text-lg font-black text-slate-500">Locked ({locked.length})</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {locked.map((badge) => (
                    <div key={badge.title} className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200 opacity-70">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200 text-xl">🔒</div>
                      <p className="text-lg font-black text-slate-900">{badge.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{badge.description}</p>
                      <span className="mt-3 inline-flex rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600">
                        Locked
                      </span>
                    </div>
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
