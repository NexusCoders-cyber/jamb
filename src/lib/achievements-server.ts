/**
 * Achievement evaluation — runs ONLY server-side (API route / finalizeDuel)
 * with the service-role client. Checks each active achievement's rule against
 * the user's real stats, inserts unlocks, awards the achievement's points as
 * bonus QPoints and notifies the user.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type AchievementRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  points: number;
  icon_url: string | null;
  is_active: boolean;
};

type UserStats = {
  streak: number;
  exams: number;
  questions: number;
  duelWins: number;
  totalPoints: number;
};

/** All rules keyed by the achievement code seeded in supabase/achievements.sql. */
const RULES: Record<string, (s: UserStats) => boolean> = {
  first_exam: (s) => s.exams >= 1,
  streak_3: (s) => s.streak >= 3,
  streak_7: (s) => s.streak >= 7,
  streak_14: (s) => s.streak >= 14,
  streak_30: (s) => s.streak >= 30,
  streak_100: (s) => s.streak >= 100,
  questions_100: (s) => s.questions >= 100,
  questions_500: (s) => s.questions >= 500,
  exams_5: (s) => s.exams >= 5,
  exams_10: (s) => s.exams >= 10,
  duel_win_1: (s) => s.duelWins >= 1,
  duel_win_5: (s) => s.duelWins >= 5,
  points_500: (s) => s.totalPoints >= 500,
};

async function loadStats(supabase: SupabaseClient, userId: string): Promise<UserStats> {
  const [profileRes, attemptsRes, winsRes, pointsRes] = await Promise.all([
    supabase.from("profiles").select("streak_days").eq("id", userId).single(),
    supabase.from("exam_attempts").select("question_count").eq("user_id", userId).eq("status", "submitted"),
    supabase.from("quiz_matches").select("id", { count: "exact", head: true }).eq("winner_id", userId),
    supabase.from("qpoints_ledger").select("delta").eq("user_id", userId),
  ]);

  const attempts = attemptsRes.data ?? [];
  return {
    streak: (profileRes.data as { streak_days: number | null } | null)?.streak_days ?? 0,
    exams: attempts.length,
    questions: attempts.reduce((s, a) => s + ((a as { question_count: number }).question_count ?? 0), 0),
    duelWins: winsRes.count ?? 0,
    totalPoints: (pointsRes.data ?? []).reduce((s, r) => s + (r.delta as number), 0),
  };
}

export type EvalResult = { unlocked: Array<{ code: string; name: string; points: number }> };

/**
 * Evaluate every active achievement for the user. Safe to call after every
 * exam/duel — already-unlocked achievements are skipped.
 */
export async function evaluateAchievements(supabase: SupabaseClient, userId: string): Promise<EvalResult> {
  const result: EvalResult = { unlocked: [] };
  try {
    const [defsRes, unlockedRes, stats] = await Promise.all([
      supabase.from("achievements").select("*").eq("is_active", true),
      supabase.from("user_achievements").select("achievement_id").eq("user_id", userId),
      loadStats(supabase, userId),
    ]);

    const defs = (defsRes.data ?? []) as unknown as AchievementRow[];
    const ownedIds = new Set(((unlockedRes.data ?? []) as Array<{ achievement_id: string }>).map((r) => r.achievement_id));

    for (const def of defs) {
      if (ownedIds.has(def.id)) continue;
      const rule = RULES[def.code];
      if (!rule || !rule(stats)) continue;

      const { error } = await supabase.from("user_achievements").insert({ user_id: userId, achievement_id: def.id });
      if (error) continue; // race with another evaluation — skip

      result.unlocked.push({ code: def.code, name: def.name, points: def.points });

      // Bonus QPoints (ledger reason: achievement) — bypasses the daily cap
      // intentionally? No: keep the cap fair. Achievements are capped too.
      if (def.points > 0) {
        await supabase.from("qpoints_ledger").insert({
          user_id: userId,
          delta: def.points,
          reason: "achievement",
          ref_id: def.id,
          note: `Achievement: ${def.name}`,
        });
      }

      await supabase.from("notifications").insert({
        user_id: userId,
        title: "🏆 Achievement unlocked!",
        body: `${def.name} — ${def.description} (+${def.points} QPoints)`,
      });
    }
  } catch (e) {
    // Tables may not exist yet (migration pending) — never break the caller
    console.error("[achievements]", e);
  }
  return result;
}
