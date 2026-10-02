import { errorResponse, requireUser, getAdminClient, HttpError, notify, sendDuelDM, duelJoinUrl, updateMatch } from "@/lib/quiz-server";

export const dynamic = "force-dynamic";

type MatchRow = { id: string; host_id: string; guest_id: string | null; status: string; subject: string };

/**
 * POST /api/quiz/invite — create or respond to a duel invite.
 *
 * Create : { matchId, toId }  → host invites a player to their waiting duel
 *          (also delivered as a DM with the share link).
 * Respond: { inviteId, accept } → accepting activates the waiting match and
 *          notifies the host.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as {
      inviteId?: string;
      accept?: boolean;
      matchId?: string;
      toId?: string;
    };
    const supabase = getAdminClient();

    // ── Create: host invites a player to an open (waiting) duel ─────────────
    if (body.matchId && body.toId) {
      if (body.toId === user.id) throw new HttpError(400, "You can't invite yourself");
      const { data: match } = await supabase.from("quiz_matches").select("*").eq("id", body.matchId).maybeSingle();
      const m = match as MatchRow | null;
      if (!m) throw new HttpError(404, "Match not found");
      if (m.host_id !== user.id) throw new HttpError(403, "Only the host can invite players");
      if (m.status !== "waiting" || m.guest_id) throw new HttpError(400, "This duel is no longer open");

      const { error } = await supabase.from("quiz_invites").insert({
        match_id: m.id,
        from_id: user.id,
        to_id: body.toId,
        subject: m.subject,
      });
      if (error) throw new HttpError(400, error.message);

      await notify(supabase, body.toId, "⚔️ Duel invite", `${user.name} challenges you to a ${m.subject} duel!`);
      await sendDuelDM(supabase, user.id, body.toId, m.subject, duelJoinUrl(req, m.id));
      return Response.json({ ok: true });
    }

    // ── Respond: accept / decline ────────────────────────────────────────────
    if (!body.inviteId) throw new HttpError(400, "inviteId is required");

    const { data: invite } = await supabase
      .from("quiz_invites")
      .select("*")
      .eq("id", body.inviteId)
      .maybeSingle();
    const inv = invite as { id: string; match_id: string; from_id: string; to_id: string; status: string } | null;
    if (!inv || inv.to_id !== user.id) throw new HttpError(404, "Invite not found");
    if (inv.status !== "pending") throw new HttpError(400, `Invite already ${inv.status}`);

    // The duel must still be open — with two valid shapes:
    //  • open duel (guest_id null): first accepter claims the seat.
    //  • direct invite: the host already reserved the seat for THIS player
    //    (guest_id === user.id) while the duel waits for them to accept.
    const { data: match } = await supabase.from("quiz_matches").select("*").eq("id", inv.match_id).maybeSingle();
    const m = match as MatchRow | null;
    const reservedForMe = Boolean(m && m.guest_id === user.id);
    const seatOpen = Boolean(m && !m.guest_id);
    if (!m || m.status !== "waiting" || (!reservedForMe && !seatOpen)) {
      await supabase.from("quiz_invites").update({ status: "cancelled" }).eq("id", inv.id);
      throw new HttpError(400, "This duel is no longer available");
    }

    await supabase.from("quiz_invites").update({ status: body.accept ? "accepted" : "declined" }).eq("id", inv.id);

    if (body.accept) {
      const accept = await updateMatch(
        supabase,
        inv.match_id,
        {
          guest_id: user.id,
          status: "active",
          current_turn: "host",
          turn_ends_at: new Date(Date.now() + 45_000).toISOString(),
          guest_seen_at: new Date().toISOString(),
        },
        { status: "waiting" },
      );
      if (!accept.ok) throw new HttpError(400, accept.error ?? "Could not join the duel");
      if (accept.updated === 0) throw new HttpError(400, "This duel is no longer available");

      // Other pending invites for this match are dead now.
      await supabase
        .from("quiz_invites")
        .update({ status: "cancelled" })
        .eq("match_id", inv.match_id)
        .eq("status", "pending")
        .neq("id", inv.id);

      await notify(supabase, inv.from_id, "⚔️ Duel accepted!", `${user.name} accepted your ${m.subject} duel — good luck!`);
    } else {
      await supabase.from("quiz_matches").update({ status: "declined" }).eq("id", inv.match_id).eq("status", "waiting");
      await notify(supabase, inv.from_id, "Duel declined", `${user.name} declined your duel invite.`);
    }

    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
