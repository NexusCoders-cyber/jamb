import {
  errorResponse, requireUser, getAdminClient, redactQuestion,
  finalizeDuel, awardPoints, POINTS, HttpError,
} from "@/lib/quiz-server";
import type { StoredQuestion } from "@/lib/quiz-server";

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
};

const TURN_SECONDS = 45;

function sideOf(match: MatchRow, userId: string): "host" | "guest" {
  if (match.host_id === userId) return "host";
  if (match.guest_id === userId) return "guest";
  throw new HttpError(403, "You are not a participant in this match");
}

/** Persist pointer/turn updates, then finalize when everyone is out of questions. */
async function advance(
  supabase: ReturnType<typeof getAdminClient>,
  m: MatchRow,
  side: "host" | "guest",
  correct: boolean,
): Promise<Response> {
  const questions = (m.questions ?? []) as StoredQuestion[];
  const idx = side === "host" ? m.host_index : m.guest_index;
  const nextIdx = idx + 1;
  const done = nextIdx >= questions.length;

  const updates: Record<string, unknown> = {};
  if (side === "host") {
    updates.host_index = nextIdx;
    if (correct) updates.host_score = m.host_score + 1;
    updates.host_finished = done;
  } else {
    updates.guest_index = nextIdx;
    if (correct) updates.guest_score = m.guest_score + 1;
    updates.guest_finished = done;
  }

  // Turn passes to the opponent unless they're finished — then it stays here
  const oppSide = side === "host" ? "guest" : "host";
  const oppDone = oppSide === "host" ? m.host_finished : m.guest_finished;
  updates.current_turn = oppDone ? side : oppSide;
  updates.turn_ends_at = new Date(Date.now() + TURN_SECONDS * 1000).toISOString();

  const { data: updated } = await supabase
    .from("quiz_matches")
    .update(updates)
    .eq("id", m.id)
    .select()
    .single();
  const nm = (updated ?? m) as unknown as MatchRow;

  // Everyone out of questions → settle the match
  const hostDone = nm.host_index >= questions.length || nm.host_finished;
  const guestDone = !nm.guest_id || nm.guest_index >= questions.length || nm.guest_finished;

  if (nm.guest_id && hostDone && guestDone) {
    await finalizeDuel(supabase, nm as unknown as Record<string, unknown>);
  } else if (!nm.guest_id && hostDone) {
    // Solo: score is QPoints at soloPerCorrect per correct answer
    await supabase.from("quiz_matches")
      .update({ status: "completed", completed_at: new Date().toISOString(), points_awarded: true })
      .eq("id", nm.id);
    await awardPoints(supabase, nm.host_id, POINTS.soloPerCorrect * nm.host_score, "solo_game", nm.id,
      `Solo ${nm.subject}: ${nm.host_score}/${questions.length}`);
  }

  return Response.json({ ok: true, correct });
}

/** GET /api/quiz/match/[matchId] — live match state (redacted questions). */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { matchId } = await ctx.params;
    const supabase = getAdminClient();

    const { data: match } = await supabase
      .from("quiz_matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();
    if (!match) throw new HttpError(404, "Match not found");
    const m = match as unknown as MatchRow;
    const side = sideOf(m, user.id);

    const idx = side === "host" ? m.host_index : m.guest_index;
    const finished = side === "host" ? m.host_finished : m.guest_finished;
    const revealed = m.status === "completed";
    const questions = (m.questions ?? []) as StoredQuestion[];

    return Response.json({
      matchId: m.id,
      subject: m.subject,
      status: m.status,
      yourSide: side,
      yourIndex: idx,
      yourScore: side === "host" ? m.host_score : m.guest_score,
      yourFinished: finished,
      oppScore: side === "host" ? m.guest_score : m.host_score,
      oppIndex: side === "host" ? m.guest_index : m.host_index,
      oppFinished: side === "host" ? m.guest_finished : m.host_finished,
      isDuel: Boolean(m.guest_id),
      currentTurn: m.current_turn,
      turnEndsAt: m.turn_ends_at,
      winnerId: m.winner_id,
      question: idx < questions.length ? redactQuestion(questions[idx]) : null,
      total: questions.length,
      // Correct answers + explanations are only revealed once the duel ends
      answerKey: revealed ? questions.map((q) => ({ id: q.id, answer: q.answer, explanation: q.explanation })) : null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/quiz/match/[matchId] — answer the current question, or skip/resign. */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { matchId } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      choice?: number;
      action?: "skip" | "resign";
    };
    const supabase = getAdminClient();

    const { data: match } = await supabase
      .from("quiz_matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();
    if (!match) throw new HttpError(404, "Match not found");
    const m = match as unknown as MatchRow;
    const side = sideOf(m, user.id);

    if (body.action === "resign") {
      const oppId = side === "host" ? m.guest_id : m.host_id;
      if (!m.guest_id) {
        // Leaving a solo game just completes it (points for what you earned)
        await supabase.from("quiz_matches")
          .update({ status: "completed", completed_at: new Date().toISOString(), points_awarded: true })
          .eq("id", m.id);
        await awardPoints(supabase, m.host_id, POINTS.soloPerCorrect * m.host_score, "solo_game", m.id,
          `Solo ${m.subject}: ${m.host_score}/${((m.questions ?? []) as StoredQuestion[]).length}`);
        return Response.json({ ok: true, resigned: true });
      }
      await finalizeDuel(supabase, { ...m, status: "completed" } as unknown as Record<string, unknown>, oppId);
      return Response.json({ ok: true, resigned: true });
    }

    if (m.status !== "active") throw new HttpError(400, "Match is not active");
    if (m.current_turn !== side) throw new HttpError(400, "Not your turn");

    const questions = (m.questions ?? []) as StoredQuestion[];
    const idx = side === "host" ? m.host_index : m.guest_index;
    if (idx >= questions.length) throw new HttpError(400, "No question left to answer");

    // Expired turn or explicit skip → advance without scoring
    const expired = m.turn_ends_at && new Date(m.turn_ends_at).getTime() < Date.now();
    if (expired || body.action === "skip") {
      return await advance(supabase, m, side, false);
    }

    const q = questions[idx];
    const correct = body.choice === q.answer;
    return await advance(supabase, m, side, correct);
  } catch (e) {
    return errorResponse(e);
  }
}
