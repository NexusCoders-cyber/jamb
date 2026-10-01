import { errorResponse, requireUser, getAdminClient, HttpError } from "@/lib/quiz-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/quiz/invite — respond to a duel invite.
 * Body: { inviteId, accept: boolean }
 * Accepting activates the waiting match and notifies the host.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as { inviteId?: string; accept?: boolean };
    if (!body.inviteId) throw new HttpError(400, "inviteId is required");
    const supabase = getAdminClient();

    const { data: invite } = await supabase
      .from("quiz_invites")
      .select("*")
      .eq("id", body.inviteId)
      .maybeSingle();
    const inv = invite as { id: string; match_id: string; from_id: string; to_id: string; status: string } | null;
    if (!inv || inv.to_id !== user.id) throw new HttpError(404, "Invite not found");
    if (inv.status !== "pending") throw new HttpError(400, `Invite already ${inv.status}`);

    await supabase.from("quiz_invites").update({ status: body.accept ? "accepted" : "declined" }).eq("id", inv.id);

    if (body.accept) {
      const { error } = await supabase
        .from("quiz_matches")
        .update({
          guest_id: user.id,
          status: "active",
          current_turn: "host",
          turn_ends_at: new Date(Date.now() + 45_000).toISOString(),
        })
        .eq("id", inv.match_id)
        .eq("status", "waiting");
      if (error) throw new HttpError(400, error.message);

      const { data: match } = await supabase
        .from("quiz_matches")
        .select("subject")
        .eq("id", inv.match_id)
        .single();
      await supabase.from("notifications").insert({
        user_id: inv.from_id,
        title: "⚔️ Duel accepted!",
        body: `${user.name} accepted your ${match?.subject ?? ""} duel — good luck!`,
      });
    } else {
      await supabase.from("quiz_matches").update({ status: "declined" }).eq("id", inv.match_id);
      await supabase.from("notifications").insert({
        user_id: inv.from_id,
        title: "Duel declined",
        body: `${user.name} declined your duel invite.`,
      });
    }

    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
