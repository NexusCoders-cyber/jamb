import { errorResponse, requireUser, getAdminClient, HttpError, notify, updateMatch } from "@/lib/quiz-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/quiz/match/join — claim the open seat of a waiting duel.
 * Body: { matchId }
 *
 * Used by share links (/arena?join=<matchId>) and the "Accept duel" button in
 * DMs. Only the first caller wins the seat; everyone else gets a clear error.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as { matchId?: string };
    if (!body.matchId) throw new HttpError(400, "matchId is required");
    const supabase = getAdminClient();

    const { data: match } = await supabase
      .from("quiz_matches")
      .select("*")
      .eq("id", body.matchId)
      .maybeSingle();
    if (!match) throw new HttpError(404, "This duel link is not valid");
    const m = match as { id: string; host_id: string; guest_id: string | null; status: string; subject: string };

    // Host reopening their own link, or the guest reopening theirs — just open it.
    if (m.host_id === user.id || m.guest_id === user.id) {
      return Response.json({ ok: true, already: true, matchId: m.id });
    }

    if (m.status === "waiting" && !m.guest_id) {
      // Guarded update — only one caller can flip a waiting seat to taken.
      const claim = await updateMatch(
        supabase,
        m.id,
        {
          guest_id: user.id,
          status: "active",
          current_turn: "host",
          turn_ends_at: new Date(Date.now() + 45_000).toISOString(),
          guest_seen_at: new Date().toISOString(),
        },
        { status: "waiting", guest_id: null },
      );
      if (!claim.ok || claim.updated === 0) throw new HttpError(409, "Someone just joined this duel — start a new one");

      // Whoever joined first wins; the other pending invites are dead links now.
      await supabase
        .from("quiz_invites")
        .update({ status: "cancelled" })
        .eq("match_id", m.id)
        .eq("status", "pending");
      await notify(supabase, m.host_id, "⚔️ Opponent joined!", `${user.name} accepted your ${m.subject} duel — good luck!`);
      return Response.json({ ok: true, matchId: m.id });
    }

    if (m.status === "active") throw new HttpError(409, "Someone already joined this duel");
    if (m.status === "completed") throw new HttpError(409, "This duel has already finished");
    throw new HttpError(409, "This duel is no longer available");
  } catch (e) {
    return errorResponse(e);
  }
}
