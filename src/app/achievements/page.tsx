"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock, Share2, Trophy, Users, Zap } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import { PaywallGate } from "@/components/Paywall";
import AuthGuard from "@/components/AuthGuard";
import { currentStreakFromDates, getChannels, getProfile, getUserAttempts } from "@/lib/queries";

type AchievementDef = {
  id: string;
  code: string;
  name: string;
  description: string;
  points: number;
  icon_url: string | null;
  is_active: boolean;
  position: number;
};

type Card = {
  key: string;
  title: string;
  description: string;
  points: number;
  iconUrl: string | null;
  unlocked: boolean;
  unlockedAt: string | null;
};

export default function AchievementsPage() {
  const { user, loading: authLoading } = useUser();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationReady, setMigrationReady] = useState(true);
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [shareDone, setShareDone] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    const supabase = createSupabaseBrowserClient();

    (async () => {
      // Preferred path: DB definitions + unlock rows (needs achievements.sql)
      const defsRes = await supabase.from("achievements").select("*").eq("is_active", true).order("position");
      const defs = ((defsRes.data ?? []) as unknown) as AchievementDef[];

      if (defsRes.error || defs.length === 0) {
        // Fallback: the original client-computed badges (pre-migration)
        setMigrationReady(false);
        const [profile, attempts] = await Promise.all([
          getProfile(supabase, user.id),
          getUserAttempts(supabase, user.id, 200),
        ]);
        const streak = Math.max(profile?.streak_days ?? 0, currentStreakFromDates(attempts.map((a) => a.submitted_at ?? a.started_at)));
        const exams = attempts.length;
        const questions = attempts.reduce((s, a) => s + a.question_count, 0);
        const rules: Array<[string, string, number, boolean]> = [
          ["First Step", "Complete your first exam", 10, exams >= 1],
          ["3-Day Starter", "Reach a 3-day streak", 10, streak >= 3],
          ["One Week Warrior", "Reach a 7-day streak", 25, streak >= 7],
          ["Two-Week Champion", "Reach a 14-day streak", 50, streak >= 14],
          ["30-Day Scholar", "Reach a 30-day streak", 100, streak >= 30],
          ["100-Day Scholar", "Reach a 100-day streak", 250, streak >= 100],
          ["Century Club", "Answer 100 questions", 25, questions >= 100],
          ["Question Master", "Answer 500 questions", 75, questions >= 500],
          ["Prolific", "Complete 5 exams", 25, exams >= 5],
          ["Exam Ready", "Complete 10 exams", 50, exams >= 10],
        ];
        setCards(rules.map(([title, description, points, unlocked], i) => ({
          key: `local-${i}`, title, description, points, iconUrl: null, unlocked, unlockedAt: null,
        })));
        setLoading(false);
        return;
      }

      const [unlocksRes, pointsRes] = await Promise.all([
        supabase.from("user_achievements").select("achievement_id, unlocked_at").eq("user_id", user.id),
        supabase.rpc("my_total_points", { p_user: user.id }),
      ]);
      const unlocks = new Map(
        (((unlocksRes.data ?? []) as unknown) as Array<{ achievement_id: string; unlocked_at: string }>)
          .map((u) => [u.achievement_id, u.unlocked_at]),
      );
      setTotalPoints(Number(pointsRes.data ?? 0));

      setCards(defs.map((d) => ({
        key: d.id,
        title: d.name,
        description: d.description,
        points: d.points,
        iconUrl: d.icon_url,
        unlocked: unlocks.has(d.id),
        unlockedAt: unlocks.get(d.id) ?? null,
      })));
      setLoading(false);
    })();
  }, [user, authLoading]);

  const unlocked = cards.filter((c) => c.unlocked);
  const locked = cards.filter((c) => !c.unlocked);
  const achievementPoints = unlocked.reduce((s, c) => s + c.points, 0);

  /** Share an achievement: community post + native share sheet / clipboard. */
  async function share(card: Card) {
    if (!user) return;
    setSharing(card.key);
    try {
      const supabase = createSupabaseBrowserClient();
      const text = `🏆 I just unlocked "${card.title}" on Qubit Learn! ${card.description} (+${card.points} QPoints)`;

      // 1. Post it into the community (first channel is the general one)
      const channels = await getChannels(supabase);
      if (channels.length > 0) {
        await supabase.from("posts").insert({
          user_id: user.id,
          channel_id: channels[0].id,
          title: null,
          body: `${text}\n\n${card.iconUrl ? "" : ""}#achievement`,
        });
      }

      // 2. Outside the app: native share sheet (mobile) or copy to clipboard
      const url = typeof window !== "undefined" ? window.location.origin : "";
      if (navigator.share) {
        await navigator.share({ title: `Qubit Learn achievement: ${card.title}`, text, url }).catch(() => {});
      } else {
        await navigator.clipboard?.writeText(`${text} ${url}`).catch(() => {});
        setShareDone(card.key);
        setTimeout(() => setShareDone(null), 2500);
      }
    } finally {
      setSharing(null);
    }
  }

  return (
    <PaywallGate feature="Progress">
    <AppShell title="Achievements">
      <AuthGuard user={user} loading={authLoading}>
        <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-4xl lg:px-6">
          <div className="mb-5 overflow-hidden rounded-[28px] bg-gradient-to-br from-amber-500 to-orange-500 p-6 text-white shadow-xl shadow-amber-200/40">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-amber-100">
              <Trophy className="h-4 w-4" aria-hidden /> Achievements
            </p>
            <h1 className="mt-2 text-3xl font-black">{unlocked.length} of {cards.length} unlocked</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-bold">
                <Zap className="h-4 w-4" aria-hidden /> {achievementPoints} achievement pts
              </span>
              {totalPoints !== null && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-bold">
                  <Users className="h-4 w-4" aria-hidden /> {totalPoints} QPoints total
                </span>
              )}
            </div>
          </div>

          {!migrationReady && (
            <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
              Showing basic badges — ask an admin to run supabase/achievements.sql for icons, points and sharing.
            </p>
          )}

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((n) => <div key={n} className="h-36 animate-pulse rounded-[24px] bg-slate-100" />)}
            </div>
          ) : (
            <>
              {/* Unlocked */}
              {unlocked.length > 0 && (
                <div className="mb-6">
                  <h2 className="mb-4 text-lg font-black text-emerald-700">Unlocked ({unlocked.length})</h2>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {unlocked.map((card) => (
                      <div key={card.key} className="flex flex-col rounded-[24px] bg-emerald-50 p-5 ring-1 ring-emerald-200">
                        <div className="mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-emerald-100">
                          {card.iconUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={card.iconUrl} alt={`${card.title} icon`} className="h-14 w-14 object-cover" />
                          ) : (
                            <Trophy className="h-7 w-7 text-emerald-700" aria-hidden />
                          )}
                        </div>
                        <p className="text-lg font-black text-slate-900">{card.title}</p>
                        <p className="mt-1 flex-1 text-xs text-slate-500">{card.description}</p>
                        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">
                          <Zap className="h-3 w-3" aria-hidden /> +{card.points} pts
                          {card.unlockedAt && ` · ${new Date(card.unlockedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`}
                        </span>
                        <button type="button" onClick={() => void share(card)} disabled={sharing === card.key}
                          className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700 disabled:opacity-50">
                          <Share2 className="h-3.5 w-3.5" aria-hidden />
                          {sharing === card.key ? "Sharing…" : shareDone === card.key ? "Copied!" : "Share"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Locked */}
              {locked.length > 0 && (
                <div>
                  <h2 className="mb-4 text-lg font-black text-slate-500">Locked ({locked.length})</h2>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {locked.map((card) => (
                      <div key={card.key} className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200 opacity-70">
                        <div className="mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-slate-200 grayscale">
                          {card.iconUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={card.iconUrl} alt="" className="h-14 w-14 object-cover opacity-60" />
                          ) : (
                            <Lock className="h-6 w-6 text-slate-500" aria-hidden />
                          )}
                        </div>
                        <p className="text-lg font-black text-slate-700">{card.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{card.description}</p>
                        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-500">
                          <Zap className="h-3 w-3" aria-hidden /> {card.points} pts
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs font-bold">
                <Link href="/arena" className="text-violet-600 hover:underline">Earn more in the Arena →</Link>
                <Link href="/leaderboard" className="text-violet-600 hover:underline">See the leaderboard →</Link>
              </div>
            </>
          )}
        </div>
      </AuthGuard>
    </AppShell>
    </PaywallGate>
  );
}
