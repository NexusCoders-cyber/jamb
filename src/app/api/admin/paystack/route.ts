import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { getPaystackSecret, maskKey } from "@/lib/paystack-key";

export const dynamic = "force-dynamic";

/** Admin only: where the Paystack secret comes from, and a masked hint. The key itself is never returned. */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (ctx instanceof NextResponse) return ctx;
  const s = await getPaystackSecret(ctx.admin);
  const { data } = await ctx.admin.from("admin_settings").select("value").eq("key", "paystack_secret_key").maybeSingle();
  const dbHasKey = String((data as { value?: string } | null)?.value ?? "").trim().length >= 10;
  return NextResponse.json({ source: s.source, hint: maskKey(s.key), dbHasKey });
}

/** Admin only: remove the copy of the secret kept in the database (do this after setting PAYSTACK_SECRET_KEY). */
export async function DELETE(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (ctx instanceof NextResponse) return ctx;
  const s = await getPaystackSecret(ctx.admin);
  if (s.source !== "env") {
    return NextResponse.json({ error: "Set PAYSTACK_SECRET_KEY on the server first, otherwise payments would stop." }, { status: 409 });
  }
  const { error } = await ctx.admin.from("admin_settings").update({ value: "" }).eq("key", "paystack_secret_key");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
