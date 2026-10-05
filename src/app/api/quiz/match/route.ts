import { errorResponse, requireUser, getAdminClient, buildQuestionSet, sendDuelDM, duelJoinUrl } from "@/lib/quiz-server";
import { armDeadline } from "@/lib/duel";

export const dynamic = "force-dynamic";

/** POST /api/quiz/match — create a match (solo or waiting-for-guest duel). */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as {
      subject?: string;
      mode?: "solo" | "duel";
      guestId?: string | null;
    };

    const subject = body.subject?.trim();
    if (!subject) return Response.json({ error: "subject is required" }, { status: 400 });

    const supabase = getAdminClient();
    // Question count is fixed at 10 — clients cannot override this.
    const questions = await buildQuestionSet(subject, 10);

    const mode = body.mode === "solo" ? "solo" : "duel";
    const guestId = mode === "solo" ? null : (body.guestId ?? null);

    const { data: match, error } = await supabase
      .from("quiz_matches")
      .insert({
        host_id: user.id,
        guest_id: guestId,
        subject,
        question_count: questions.length,
        status: mode === "solo" ? "active" : "waiting",
        questions,
        current_turn: null,
        turn_ends_at: mode === "solo" ? armDeadline(Date.now(), "first") : null,
      })
      .select()
      .single();
    if (error) return Response.json({ error: error.message }, { status: 400 });

    // Duel: invite row + notification + a DM carrying the share link, so the
    // challenge is also actionable from Messages.
    if (guestId) {
      await supabase.from("quiz_invites").insert({ match_id: match.id, from_id: user.id, to_id: guestId, subject });
      await supabase.from("notifications").insert({
        user_id: guestId,
        title: "⚔️ Duel invite",
        body: `${user.name} challenges you to a ${subject} duel!`,
      });
      await sendDuelDM(supabase, user.id, guestId, subject, duelJoinUrl(req, match.id));
    }

    return Response.json({ matchId: match.id });
  } catch (e) {
    return errorResponse(e);
  }
}
