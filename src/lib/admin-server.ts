import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminContext = { admin: SupabaseClient; adminId: string };

/**
 * Verifies the caller's Bearer token and that profiles.role === "admin" (checked with the service role,
 * so RLS can't be fooled). Returns either a context or a ready-made error response.
 */
export async function requireAdmin(request: NextRequest): Promise<AdminContext | NextResponse> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Missing auth token" }, { status: 401 });

  const anon = await createSupabaseServerClient();
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { url, serviceRoleKey } = getSupabaseAdminEnv();
  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: profile } = await admin.from("profiles").select("role").eq("id", data.user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return { admin, adminId: data.user.id };
}
