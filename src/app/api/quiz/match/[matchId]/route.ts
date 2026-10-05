import {
  errorResponse, requireUser, getAdminClient, redactQuestion, finalizeDuel, awardPoints,
  casMatch, completeMatch, expireWaitingMatch, POINTS, HttpError,
} from "@/lib/quiz-server";
import type { StoredQuestion } from "@/lib/quiz-server";
import { DUEL, currentRound, planAnswer, planTimeout, roundStartMs, type Side } from "@/lib/duel";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ matchId: string }> };

type MatchRow = {
  id: string;
  host_id: string;
  guest_id: string | null;
  subject: string;
  question_count: number;
  status: "waiting" | "active" | "completed" | "declined" | "expired";
  questions: StoredQuestion[];
  host_index: number;
  guest_index: number;
  host_score: number;
  guest_score: number;
  host_finished: boolean;
  guest_finished: boolean;
  current_turn: "host" | "guest" | null;
  turn_ends_at: string | null;
  winner_id: string | null;
  points_awarded: boolean;
  created_at: string;
  host_seen_at: string | null;
  guest_seen_at: string | null;
  host_picks?: number[] | null;
  guest_picks?: number[] | null;
};

/** How often a player's presence heartbeat is written (GET polls are more frequent). */
const HEARTBEAT_MS = 5_000;

function sideOf(match: MatchRow, userId: string): Side {
  if (match.host_id === userId) return "host";
  if (match.guest_id === userId) return "guest";
  throw new HttpError(403, "You are not a participant in this match");
}

async function loadMatch(supabase: ReturnType<typeof getAdminClient>, matchId: string): Promise<MatchRow> {
  const { data } = await supabase.from("quiz_matches").select("*").eq("id", matchId).maybeSingle();
  if (!data) throw new HttpError(404, "Match not found");
  return data as unknown as MatchRow;
}

/**
 * GET /api/quiz/match/[matchId] — live match state.
 *
 * Doubles as the presence heartbeat and as the "clock keeper": whoever polls
 * first after a round's deadline skips the players who didn't answer, so a
 * silent or disconnected player can never freeze the duel.
 */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { matchId } = await ctx.params;
    const supabase = getAdminClient();

    let m = await loadMatch(supabase, matchId);
    const side = sideOf(m, user.id);

    // An open duel nobody joined doesn't wait forever.
    if (m.status === "waiting" && Date.now() - Date.parse(m.created_at) > DUEL.WAITING_EXPIRY_MS) {
      await expireWaitingMatch(supabase, m.id);
      m = await loadMatch(supabase, matchId);
    }

    // Presence heartbeat (throttled — the board polls every ~2s).
    if (m.status === "waiting" || m.status === "active") {
      const seenKey = side === "host" ? "host_seen_at" : "guest_seen_at";
      const last = m[seenKey];
      if (!last || Date.now() - Date.parse(last) > HEARTBEAT_MS) {
        const stamp = new Date().toISOString();
        await supabase.from("quiz_matches").update({ [seenKey]: stamp }).eq("id", m.id);
        m = { ...m, [seenKey]: stamp };
      }
    }

    // Clock keeper: skip whoever ran out of time. A compare-and-swap makes
    // exactly one poller win when both clients ask in the same instant.
    for (let i = 0; i < 3 && m.status === "active"; i++) {
      const plan = planTimeout(m, Date.now());
      if (!plan) break;
      if (Object.keys(plan.updates).length === 0) {
        // Every question is resolved but the match was never settled — finish it.
        await completeMatch(supabase, m as unknown as Record<string, unknown>);
        m = await loadMatch(supabase, matchId);
        break;
      }
      const next = await casMatch(supabase, m, plan.updates);
      if (!next) { m = await loadMatch(supabase, matchId); continue; }
      m = next as unknown as MatchRow;
      if (plan.done) {
        await completeMatch(supabase, next);
        m = await loadMatch(supabase, matchId);
      }
      break;
    }

    const oppId = side === "host" ? m.guest_id : m.host_id;
    const oppSeenAt = side === "host" ? m.guest_seen_at : m.host_seen_at;
    let oppName: string | null = null;
    if (oppId) {
      const { data: opp } = await supabase.from("profiles").select("full_name").eq("id", oppId).maybeSingle();
      oppName = (opp?.full_name as string | undefined) ?? null;
    }

    const questions = (m.questions ?? []) as StoredQuestion[];
    const total = questions.length;
    const yourIndex = side === "host" ? m.host_index : m.guest_index;
    const oppIndex = side === "host" ? m.guest_index : m.host_index;
    const yourPicks = (side === "host" ? m.host_picks : m.guest_picks) ?? null;
    const oppPicks = (side === "host" ? m.guest_picks : m.host_picks) ?? null;
    const isDuel = Boolean(m.guest_id) || m.status === "waiting";
    const live = m.status === "active";
    const completed = m.status === "completed";

    const round = live ? Math.min(currentRound(m), total - 1) : total;
    const answered = live && yourIndex > round;
    const oppAnswered = live && Boolean(m.guest_id) && oppIndex > round;
    const startMs = roundStartMs(m);
    const nowMs = Date.now();
    const canAnswerNow = live && !answered && !(yourIndex >= total) && (Number.isNaN(startMs) || nowMs >= startMs);

    // The question that just finished — safe to reveal, both players have been through it.
    const prev = live && round > 0 ? questions[round - 1] : null;
    const lastRound = prev
      ? {
          index: round - 1,
          prompt: prev.prompt,
          options: prev.options,
          answer: prev.answer,
          you: yourPicks ? (yourPicks[round - 1] ?? null) : null,
          opp: oppPicks ? (oppPicks[round - 1] ?? null) : null,
        }
      : null;

    return Response.json({
      matchId: m.id,
      subject: m.subject,
      status: m.status,
      yourSide: side,
      yourIndex,
      yourScore: side === "host" ? m.host_score : m.guest_score,
      yourFinished: side === "host" ? m.host_finished : m.guest_finished,
      oppScore: side === "host" ? m.guest_score : m.host_score,
      oppIndex,
      oppFinished: side === "host" ? m.guest_finished : m.host_finished,
      // A waiting open duel (guest_id null) is still a duel — not a solo run.
      isDuel,
      // Kept for older cached clients: "your turn" == "you can answer right now".
      currentTurn: live ? (canAnswerNow ? side : side === "host" ? "guest" : "host") : null,
      // ── Simultaneous-round clock ───────────────────────────────────────
      serverNow: nowMs, // clients correct for their own clock with this
      turnEndsAt: m.turn_ends_at,
      roundStartsAt: Number.isNaN(startMs) ? null : new Date(startMs).toISOString(),
      roundSeconds: DUEL.ROUND_SECONDS,
      round,
      answered,
      oppAnswered,
      yourPick: live && answered && yourPicks ? (yourPicks[round] ?? null) : null,
      lastRound,
      winnerId: m.winner_id,
      oppId,
      oppName,
      oppSeenAt,
      // Only the question in play — never before the duel is live.
      question: live && round < total ? redactQuestion(questions[round]) : null,
      total,
      // Full review (answers, explanations, both players' picks) once it's over.
      answerKey: completed ? questions.map((q) => ({ id: q.id, answer: q.answer, explanation: q.explanation })) : null,
      review: completed
        ? questions.map((q, i) => ({
            id: q.id,
            prompt: q.prompt,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
            you: yourPicks ? (yourPicks[i] ?? null) : null,
            opp: oppPicks ? (oppPicks[i] ?? null) : null,
          }))
        : null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/quiz/match/[matchId] — answer the live question, or skip / resign / claim-win. */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { matchId } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      choice?: number;
      action?: "skip" | "resign" | "claim-win";
    };
    const supabase = getAdminClient();

    let m = await loadMatch(supabase, matchId);
    const side = sideOf(m, user.id);

    if (body.action === "resign") {
      const oppId = side === "host" ? m.guest_id : m.host_id;
      if (!m.guest_id) {
        if (m.status === "waiting") {
          // Host cancelled an open duel before anyone joined — retire it and
          // cancel pending invites so nobody walks into a dead link.
          await expireWaitingMatch(supabase, m.id);
          return Response.json({ ok: true, resigned: true });
        }
        // Leaving a solo game just completes it (points for what you earned)
        await supabase.from("quiz_matches")
          .update({ status: "completed", completed_at: new Date().toISOString(), points_awarded: true })
          .eq("id", m.id)
          .eq("points_awarded", false);
        await awardPoints(supabase, m.host_id, POINTS.soloPerCorrect * m.host_score, "solo_game", m.id,
          `Solo ${m.subject}: ${m.host_score}/${((m.questions ?? []) as StoredQuestion[]).length}`);
        return Response.json({ ok: true, resigned: true });
      }
      if (m.status === "completed") return Response.json({ ok: true, already: true });
      if (m.status === "waiting") {
        // Leaving before the duel started — nothing was played, nothing pays.
        await expireWaitingMatch(supabase, m.id);
        return Response.json({ ok: true, resigned: true });
      }
      await finalizeDuel(supabase, { ...m, status: "completed" } as unknown as Record<string, unknown>, oppId);
      return Response.json({ ok: true, resigned: true });
    }

    // Opponent left the game screen — after the grace period the win is ours.
    // Server-side proof: their match heartbeat (host/guest_seen_at) is stale.
    if (body.action === "claim-win") {
      if (!m.guest_id) throw new HttpError(400, "Solo games have no opponent");
      if (m.status === "completed") return Response.json({ ok: true, already: true });
      if (m.status !== "active") throw new HttpError(400, "Match is not active");
      // Fail closed when the presence columns don't exist yet — no instant-win
      // farming before supabase/duel_upgrades.sql has been run.
      if (m.host_seen_at === undefined || m.guest_seen_at === undefined) {
        throw new HttpError(400, "Duel presence isn't configured yet — run supabase/duel_upgrades.sql in Supabase");
      }
      const oppSeen = side === "host" ? m.guest_seen_at : m.host_seen_at;
      const ageMs = oppSeen ? Date.now() - new Date(oppSeen).getTime() : Number.POSITIVE_INFINITY;
      if (ageMs < DUEL.CLAIM_GRACE_SECONDS * 1000) throw new HttpError(409, "Opponent is still connected");
      await finalizeDuel(supabase, { ...m, status: "completed" } as unknown as Record<string, unknown>, user.id);
      return Response.json({ ok: true, claimed: true });
    }

    // ── Answer / skip ──────────────────────────────────────────────────────
    const isSkip = body.action === "skip";
    const pick = isSkip ? -1 : typeof body.choice === "number" ? body.choice : Number.NaN;
    if (!isSkip && !Number.isInteger(pick)) throw new HttpError(400, "choice is required");

    // Compare-and-swap with retry: if both players answer in the same instant
    // one write loses, re-reads the fresh row and re-plans — nothing is lost
    // and the player who completes the round is the one who re-arms the clock.
    for (let attempt = 0; attempt < 4; attempt++) {
      const plan = planAnswer(m, side, pick, Date.now());
      if (!plan.ok) throw new HttpError(plan.status, plan.error);
      const next = await casMatch(supabase, m, plan.updates);
      if (next) {
        if (plan.done) await completeMatch(supabase, next);
        return Response.json({ ok: true, done: plan.done });
      }
      m = await loadMatch(supabase, matchId);
    }
    throw new HttpError(409, "The duel was busy — tap your answer again");
  } catch (e) {
    return errorResponse(e);
  }
}
