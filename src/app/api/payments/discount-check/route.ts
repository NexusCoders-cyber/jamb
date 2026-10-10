/**
 * POST /api/payments/discount-check
 *
 * Live-validates a discount code for the signed-in student and returns the
 * discounted price preview shown on the /upgrade and /premium pages.
 * (Enforcement still happens server-side at checkout — this endpoint only
 * previews, so the code entry box is actually "connected" to the DB.)
 *
 * Body: { code: string, plan?: string, baseNaira?: number }
 * Returns: { valid, code, kind, value, discountNaira, finalNaira, message }
 *       or { valid: false, message } / { error }
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "@/lib/env";
import { applyDiscount, isExpired } from "@/lib/discount";

export const dynamic = "force-dynamic";

type CodeRow = {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
};

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in to use a discount code." }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      code?: string;
      plan?: string;
      baseNaira?: number;
    };
    const code = body.code?.trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: "Enter a discount code first." }, { status: 400 });
    }

    const { url, serviceRoleKey } = getSupabaseAdminEnv();
    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

    const { data: row } = await admin
      .from("discount_codes")
      .select("id, code, kind, value, max_uses, used_count, active, expires_at")
      .eq("code", code)
      .maybeSingle();
    const dc = row as unknown as CodeRow | null;

    if (!dc || !dc.active) {
      return NextResponse.json({ valid: false, message: "That code doesn't exist or is no longer active." });
    }
    if (isExpired(dc.expires_at)) {
      return NextResponse.json({ valid: false, message: "That code has expired." });
    }
    if (dc.max_uses !== null && dc.used_count >= dc.max_uses) {
      return NextResponse.json({ valid: false, message: "That code has reached its usage limit." });
    }

    // One redemption per student per code
    const { data: mine } = await admin
      .from("discount_redemptions")
      .select("id")
      .eq("code_id", dc.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (mine) {
      return NextResponse.json({ valid: false, message: "You have already used this code." });
    }

    // baseNaira is display-only (the client's selected plan price); the real charged amount is recomputed
    // server-side at checkout with the same applyDiscount(), including the ₦100 floor Paystack needs.
    const baseNaira = Math.max(0, Math.round(Number(body.baseNaira ?? 0)));
    const { discountKobo, payableKobo } = applyDiscount(baseNaira * 100, dc.kind, dc.value);
    const finalNaira = Math.round(payableKobo / 100);

    return NextResponse.json({
      valid: true,
      code: dc.code,
      kind: dc.kind,
      value: dc.value,
      discountNaira: Math.round(discountKobo / 100),
      finalNaira,
      message: dc.kind === "percent"
        ? `${dc.value}% off applied`
        : `₦${Math.round(discountKobo / 100).toLocaleString()} off applied`,
    });
  } catch (e) {
    console.error("[discount-check]", e);
    return NextResponse.json({ error: "Could not check the code. Try again." }, { status: 500 });
  }
}
