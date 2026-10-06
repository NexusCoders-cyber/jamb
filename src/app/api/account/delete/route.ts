import { NextResponse } from "next/server";
import { errorResponse, getAdminClient, HttpError, requireUser } from "@/lib/quiz-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/account/delete — a student permanently deletes their own account.
 * Body: { confirm: "DELETE" }. The caller is identified only by their own bearer token; the id is never taken
 * from the body, so nobody can delete someone else. Admin accounts must be removed by another admin.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as { confirm?: string };
    if (body.confirm !== "DELETE") throw new HttpError(400, 'Type DELETE to confirm.');

    const admin = getAdminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role === "admin") throw new HttpError(403, "Admin accounts can't be deleted here. Ask another admin.");

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new HttpError(500, "Could not delete the account right now. Please try again.");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
