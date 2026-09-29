import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/delete-user
 * Body: { userId }
 *
 * Deletes an auth user (cascades to profile, attempts, messages, posts).
 * Admin-only: verified against the caller's JWT via the anon server client,
 * then executed with the service-role key.
 */
export async function POST(request: NextRequest) {
  // 1. Authenticate the caller with their own token (anon client)
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
  }

  const anon = await createSupabaseServerClient();
  const { data: userData, error: userErr } = await anon.auth.getUser(token);
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // 2. Check admin role server-side (bypasses RLS via service role)
  const { url, serviceRoleKey } = getSupabaseAdminEnv();
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Parse body
  let userId: string | undefined;
  try {
    ({ userId } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // 4. Guard: admins cannot delete themselves or other admins
  if (userId === userData.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }
  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (target?.role === "admin") {
    return NextResponse.json({ error: "Cannot delete another admin." }, { status: 400 });
  }

  // 5. Delete via service role (auth.users → cascades everywhere)
  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
