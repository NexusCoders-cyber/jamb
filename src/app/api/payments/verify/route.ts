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
import { getPaystackSecret } from "@/lib/paystack-key";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "@/lib/env";
import { finalizePayment, type PaymentRow } from "@/lib/payment-finalize";

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

    // Paystack secret: server env first, admin_settings as fallback
    const secretKey = (await getPaystackSecret(admin)).key;
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

    // Grant Pro (shared with the Paystack webhook; safe to run twice, only the first one does anything)
    const result = await finalizePayment(admin, paymentRow as PaymentRow, Number(txn.amount), {
      deviceId: typeof body.deviceId === "string" ? body.deviceId : null,
      label: body.label ?? null,
    });
    if (result.status === "underpaid") {
      return NextResponse.json({ error: "Paid amount does not match the plan price." }, { status: 402 });
    }
    if (result.status === "already") {
      return NextResponse.json({ ok: true, already: true, plan: result.plan, premiumUntil: result.premiumUntil });
    }
    const { plan, premiumUntil } = result;
    return NextResponse.json({ ok: true, plan, premiumUntil });
  } catch (e) {
    console.error("[verify]", e);
    return NextResponse.json({ error: "Server error. Try again." }, { status: 500 });
  }
}
