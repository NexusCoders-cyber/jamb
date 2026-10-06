/**
 * POST /api/payments/verify
 *
 * Verifies a Paystack transaction, marks the payment as paid, grants
 * premium_until on the profile, and records discount redemption.
 *
 * Body: { reference: string }
 * Returns: { ok: true, plan, premiumUntil } or { error }
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "@/lib/env";
import { claimDevice, cleanLabel, DEVICE_ID_RE } from "@/lib/device-server";

const PLAN_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  biannual: 180,
};

function adminClient() {
  const { url, serviceRoleKey } = getSupabaseAdminEnv();
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    // Auth
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { reference?: string; deviceId?: string; label?: string };
    const reference = body.reference?.trim();
    if (!reference) {
      return NextResponse.json({ error: "Reference is required." }, { status: 400 });
    }

    const admin = adminClient();

    // Get Paystack secret key from admin_settings
    const { data: keyRow } = await admin
      .from("admin_settings")
      .select("value")
      .eq("key", "paystack_secret_key")
      .maybeSingle();
    const secretKey = (keyRow?.value as string | undefined)?.trim();
    if (!secretKey) {
      return NextResponse.json({ error: "Payment not configured." }, { status: 503 });
    }

    // Verify with Paystack
    const psRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
        cache: "no-store",
      },
    );
    if (!psRes.ok) {
      return NextResponse.json({ error: "Could not verify payment." }, { status: 502 });
    }

    const psJson = (await psRes.json()) as {
      status: boolean;
      data?: {
        status: string;
        reference: string;
        amount: number;
        metadata?: {
          user_id?: string;
          plan?: string;
          code_id?: string;
          discount_kobo?: number;
        };
      };
    };

    const txn = psJson.data;
    if (!txn || txn.status !== "success") {
      return NextResponse.json({ error: "Payment was not successful." }, { status: 402 });
    }

    // Look up the payment row that OUR checkout created for this student. The price and plan come from that row,
    // never from Paystack metadata: a student can open Paystack's own checkout with the public key and set any
    // amount/plan in the metadata, so trusting it would let ₦100 buy six months of Pro.
    const { data: paymentRow } = await admin
      .from("payments")
      .select("id, user_id, status, plan, amount_kobo, discount_code, metadata")
      .eq("reference", reference)
      .maybeSingle();

    if (!paymentRow || paymentRow.user_id !== user.id) {
      return NextResponse.json({ error: "Transaction does not belong to your account." }, { status: 403 });
    }

    // Idempotency — already paid
    if (paymentRow.status === "paid") {
      const { data: prof } = await admin
        .from("profiles")
        .select("premium_until")
        .eq("id", user.id)
        .maybeSingle();
      return NextResponse.json({
        ok: true,
        already: true,
        plan: paymentRow.plan,
        premiumUntil: prof?.premium_until,
      });
    }

    // The amount actually charged must cover the price we quoted
    if (Number(txn.amount) < Number(paymentRow.amount_kobo ?? 0)) {
      return NextResponse.json({ error: "Paid amount does not match the plan price." }, { status: 402 });
    }

    // Claim the payment atomically, so two parallel verify calls (double tap / retry) cannot both grant Pro
    const { data: claimed } = await admin
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", paymentRow.id)
      .neq("status", "paid")
      .select("id");
    if (!claimed || claimed.length === 0) {
      const { data: prof } = await admin.from("profiles").select("premium_until").eq("id", user.id).maybeSingle();
      return NextResponse.json({ ok: true, already: true, plan: paymentRow.plan, premiumUntil: prof?.premium_until });
    }

    const plan = (paymentRow.plan ?? "monthly") as string;
    const days = PLAN_DAYS[plan] ?? 30;

    // Extend premium_until from now (or from current expiry if still active)
    const { data: currentProfile } = await admin
      .from("profiles")
      .select("premium_until")
      .eq("id", user.id)
      .maybeSingle();

    const base =
      currentProfile?.premium_until && new Date(currentProfile.premium_until) > new Date()
        ? new Date(currentProfile.premium_until)
        : new Date();

    const premiumUntil = new Date(base.getTime() + days * 24 * 3600 * 1000).toISOString();

    // Grant premium
    await admin
      .from("profiles")
      .update({ premium_until: premiumUntil, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    // Record discount redemption
    const codeId = paymentRow.metadata?.code_id ?? txn.metadata?.code_id;
    if (codeId) {
      try {
        await admin.from("discount_redemptions").insert({
          code_id: codeId,
          user_id: user.id,
          payment_id: paymentRow.id,
          amount_off_kobo: paymentRow.metadata?.discount_kobo ?? txn.metadata?.discount_kobo ?? 0,
        });
        // Increment used_count — RPC may not exist on older DBs, ignore failure
        await admin.rpc("increment_discount_used", { p_code_id: codeId }).then(
          undefined,
          () => { /* RPC not deployed yet */ },
        );
      } catch (_e) { /* silently skip */ }
    }

    // The phone that just paid now holds the Pro licence (another phone on the same account goes back to free)
    if (typeof body.deviceId === "string" && DEVICE_ID_RE.test(body.deviceId)) {
      await claimDevice(admin, user.id, body.deviceId, cleanLabel(body.label), "force");
    }

    // Pro notification
    const planLabel: Record<string, string> = {
      weekly: "7-day",
      monthly: "30-day",
      biannual: "6-month",
    };
    await admin.from("notifications").insert({
      user_id: user.id,
      title: "⭐ You are now Pro!",
      body: `Your ${planLabel[plan] ?? plan} Pro subscription is active. Enjoy unlimited access to all features!`,
    });

    return NextResponse.json({ ok: true, plan, premiumUntil });
  } catch (e) {
    console.error("[verify]", e);
    return NextResponse.json({ error: "Server error. Try again." }, { status: 500 });
  }
}
