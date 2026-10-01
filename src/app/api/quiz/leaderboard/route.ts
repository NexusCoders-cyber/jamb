import { errorResponse, requireUser, getAdminClient, getPeriodStart } from "@/lib/quiz-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/quiz/leaderboard — weekly ranking from the qpoints ledger.
 * The period start comes from admin_settings (admin-controlled reset),
 * falling back to "this week since last Sunday UTC".
 */
export async function GET(req: Request) {
  try {
    await requireUser(req);
    const supabase = getAdminClient();
    const since = await getPeriodStart(supabase);

    const { data, error } = await supabase.rpc("weekly_leaderboard", { p_since: since });
    if (error) return Response.json({ error: error.message }, { status: 400 });

    const rows = ((data ?? []) as Array<{ user_id: string; full_name: string; user_code: string | null; avatar_url: string | null; points: number }>)
      .map((r, i) => ({ rank: i + 1, ...r, points: Number(r.points) }));

    return Response.json({ since, rows });
  } catch (e) {
    return errorResponse(e);
  }
}
