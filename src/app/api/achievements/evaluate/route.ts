import { errorResponse, requireUser, getAdminClient } from "@/lib/quiz-server";
import { evaluateAchievements } from "@/lib/achievements-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/achievements/evaluate — called after exam submissions and duels.
 * Server-side evaluation against real stats; returns the newly unlocked list
 * so the client can toast + offer sharing.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const supabase = getAdminClient();
    const result = await evaluateAchievements(supabase, user.id);
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
