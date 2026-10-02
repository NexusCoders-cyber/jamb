/**
 * Server-side quiz engine for Qubit Arena.
 *
 * Everything in here runs ONLY inside /api/quiz/* routes with the
 * service-role key, so QPoints and match answers can never be manipulated
 * from the browser. Clients talk to matches through the API, which returns
 * redacted questions (no `answer` / `explanation`) until the match completes.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv, getAlocApiKey } from "@/lib/env";
import { fetchAlocMany, ALOC_SUBJECTS } from "@/lib/aloc";
import { evaluateAchievements } from "@/lib/achievements-server";

export type QuizPlayer = "host" | "guest";

export type StoredQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string | null;
  subject?: string | null;
};

export type PublicQuestion = Omit<StoredQuestion, "answer" | "explanation">;

/** Redact everything a client must not see mid-match. */
export function redactQuestion(q: StoredQuestion): PublicQuestion {
  return { id: q.id, prompt: q.prompt, options: q.options, subject: q.subject ?? null };
}

/** Service-role client for API routes. */
export function getAdminClient(): SupabaseClient {
  const { url, serviceRoleKey } = getSupabaseAdminEnv();
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

/**
 * Validate the request's bearer token and return the caller's id, name
 * and email (for Paystack + notifications). Throws on any failure.
 */
export async function requireUser(req: Request): Promise<{ id: string; name: string; email: string | null }> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new HttpError(401, "Missing auth token");
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, "Invalid auth token");
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", data.user.id)
    .single();
  return {
    id: data.user.id,
    name: (profile?.full_name as string | undefined) ?? data.user.email ?? "A student",
    email: data.user.email ?? null,
  };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** JSON error response from an HttpError. */
export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  console.error("[quiz api]", e);
  return Response.json({ error: "Server error" }, { status: 500 });
}

export const ARENA_SUBJECTS = ALOC_SUBJECTS.map((s) => s.name);
export const DEFAULT_QUESTION_COUNT = 10;

/** Pull a fresh set of ALOC questions for a match. Count is capped at 10. */
export async function buildQuestionSet(subject: string, count = DEFAULT_QUESTION_COUNT): Promise<StoredQuestion[]> {
  const clamped = Math.min(count, DEFAULT_QUESTION_COUNT); // never exceed 10
  const apiKey = getAlocApiKey();
  let raw: Awaited<ReturnType<typeof fetchAlocMany>>;
  try {
    raw = await fetchAlocMany(apiKey, subject, clamped, { withComprehension: false });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    // Network/HTTP failures from the question bank surface as a clear 502
    // instead of an opaque "Server error".
    console.error("[buildQuestionSet] ALOC fetch failed:", e instanceof Error ? e.message : e);
    throw new HttpError(502, "Could not load questions right now — the question bank didn't respond. Try again in a moment.");
  }
  const questions = raw
    // Skip passage-based questions — a duel needs self-contained prompts
    .filter((q) => !q.hasPassage)
    .slice(0, clamped)
    .map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      subject: q.subject ?? subject,
    }));
  if (questions.length === 0) throw new HttpError(502, "Could not load questions for this subject — try another");
  return questions;
}

/**
 * The QPoints economy. Daily cap limits grinding; the bonus rewards speed.
 */
export const POINTS = {
  correct: 10,
  speedBonus: 5, // answered within SPEED_WINDOW seconds of the question load
  winBonus: 25,
  participation: 5,
  soloPerCorrect: 8,
  dailyCap: 300,
  SPEED_WINDOW_SECONDS: 15,
};

type LedgerReason = "duel_win" | "duel_participation" | "solo_game" | "achievement" | "daily_challenge" | "admin_adjust";

/**
 * Award QPoints through the append-only ledger, enforcing the daily cap.
 * Returns the delta actually applied (may be less than requested near the cap).
 */
export async function awardPoints(
  supabase: SupabaseClient,
  userId: string,
  delta: number,
  reason: LedgerReason,
  refId?: string,
  note?: string,
): Promise<number> {
  if (delta <= 0) return 0;

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("qpoints_ledger")
    .select("delta")
    .eq("user_id", userId)
    .gte("created_at", since);
  const todayTotal = (recent ?? []).reduce((s, r) => s + (r.delta as number), 0);
  if (todayTotal >= POINTS.dailyCap) return 0;

  const applied = Math.min(delta, POINTS.dailyCap - todayTotal);
  const { error } = await supabase.from("qpoints_ledger").insert({
    user_id: userId,
    delta: applied,
    reason,
    ref_id: refId ?? null,
    note: note ?? null,
  });
  if (error) {
    console.error("[awardPoints]", error.message);
    return 0;
  }
  return applied;
}

/** Insert a notification row (service role bypasses RLS). */
export async function notify(supabase: SupabaseClient, userId: string, title: string, body: string): Promise<void> {
  await supabase.from("notifications").insert({ user_id: userId, title, body });
}

/** Base URL for share links — Vercel env var, falling back to the request origin. */
export function appUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (env) return env;
  return new URL(req.url).origin;
}

/** Shareable duel link — anyone who opens it claims the open seat. */
export function duelJoinUrl(req: Request, matchId: string): string {
  return `${appUrl(req)}/arena?join=${matchId}`;
}

/** Deliver a duel challenge as a DM so the invite also lands in Messages. */
export async function sendDuelDM(
  supabase: SupabaseClient,
  fromId: string,
  toId: string,
  subject: string,
  joinUrl: string,
): Promise<void> {
  await supabase.from("direct_messages").insert({
    sender_id: fromId,
    receiver_id: toId,
    body: `⚔️ Duel challenge: ${subject}!\nTap to accept and play: ${joinUrl}`,
  });
}

/**
 * Finish a duel: declare the winner by score, award QPoints once
 * (points_awarded guards double payouts), notify both players.
 */
export async function finalizeDuel(
  supabase: SupabaseClient,
  match: Record<string, unknown>,
  forcedWinner?: string | null,
): Promise<void> {
  const id = match.id as string;
  const hostId = match.host_id as string;
  const guestId = match.guest_id as string | null;
  const hostScore = match.host_score as number;
  const guestScore = match.guest_score as number;
  const subject = match.subject as string;

  const winnerId =
    forcedWinner !== undefined
      ? forcedWinner
      : guestId === null
        ? null
        : hostScore === guestScore
          ? null
          : hostScore > guestScore
            ? hostId
            : guestId;

  // Atomic settle: only the first caller flips points_awarded, so a resign
  // racing a claim-win can never pay out twice.
  const { data: settled } = await supabase
    .from("quiz_matches")
    .update({ status: "completed", winner_id: winnerId, completed_at: new Date().toISOString(), points_awarded: true })
    .eq("id", id)
    .eq("points_awarded", false)
    .select("id");
  if (!settled || settled.length === 0) return;

  // ── Scoring: a duel only pays when it truly ends ─────────────────────────
  // • Forfeit (resign / claim-win): only the player who stayed earns points;
  //   whoever walked away earns 0.
  // • Decisive finish: winner earns participation + win bonus + correct-answer
  //   points; the loser keeps participation + correct-answer points.
  // • Draw: both keep participation + correct-answer points, no win bonus.
  // Abandoned / expired / declined duels never reach this function — they pay
  // nothing at all.
  const isForfeit = forcedWinner !== undefined;
  const awarded: Array<{ userId: string; total: number }> = [];
  for (const pid of [hostId, guestId]) {
    if (!pid) continue;
    const isWinner = winnerId === pid;
    // The player who forfeited (or lost by forfeit) gets nothing.
    if (!isWinner && isForfeit) {
      awarded.push({ userId: pid, total: 0 });
      continue;
    }
    let total = POINTS.participation;
    if (isWinner) total += POINTS.winBonus;
    total += POINTS.correct * (pid === hostId ? hostScore : guestScore);
    const applied = await awardPoints(supabase, pid, total, isWinner ? "duel_win" : "duel_participation", id,
      isWinner ? "Won a duel" : "Duel participation");
    awarded.push({ userId: pid, total: applied });
  }

  for (const { userId, total } of awarded) {
    await notify(
      supabase,
      userId,
      isWinnerId(winnerId, userId) ? "🏆 Duel won!" : "Duel finished",
      total > 0
        ? `Your ${subject} duel is over — you earned ${total} QPoints.`
        : `Your ${subject} duel ended by forfeit — leaving a live duel earns no QPoints.`,
    );
  }

  // Duel results can unlock achievements (First Blood, Duelist, Point Hoarder…)
  for (const { userId } of awarded) {
    await evaluateAchievements(supabase, userId);
  }
}

function isWinnerId(winnerId: string | null, userId: string): boolean {
  return winnerId !== null && winnerId === userId;
}

/**
 * Update a match row, tolerating databases where supabase/duel_upgrades.sql
 * hasn't run yet: if the *_seen_at columns are missing the update retries
 * without them (duels keep working; presence-based win claims just stay off).
 */
let seenColumnsState: "unknown" | "yes" | "no" = "unknown";

export async function updateMatch(
  supabase: SupabaseClient,
  matchId: string,
  updates: Record<string, unknown>,
  extraGuards: Record<string, string | null> = {},
): Promise<{ ok: boolean; error: string | null; updated: number }> {
  const build = (u: Record<string, unknown>) => {
    let q = supabase.from("quiz_matches").update(u).eq("id", matchId);
    for (const [k, v] of Object.entries(extraGuards)) {
      q = v === null ? q.is(k, null) : q.eq(k, v);
    }
    return q.select();
  };
  if (seenColumnsState !== "no") {
    const { data, error } = await build(updates);
    if (!error) {
      seenColumnsState = "yes";
      return { ok: true, error: null, updated: data?.length ?? 0 };
    }
    if (/host_seen_at|guest_seen_at/i.test(error.message)) {
      seenColumnsState = "no"; // migration not applied yet — fall back
    } else {
      return { ok: false, error: error.message, updated: 0 };
    }
  }
  const fallback = { ...updates };
  delete fallback.host_seen_at;
  delete fallback.guest_seen_at;
  const { data, error } = await build(fallback);
  return error ? { ok: false, error: error.message, updated: 0 } : { ok: true, error: null, updated: data?.length ?? 0 };
}

/** Current weekly period start from admin_settings (defaults to last Sunday UTC). */
export async function getPeriodStart(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.from("admin_settings").select("value").eq("key", "leaderboard_period_start").maybeSingle();
  if (data?.value) return data.value as string;
  const d = new Date();
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
