/**
 * POST /api/payments/webhook — Paystack tells us a payment went through, even if the student's phone is closed,
 * offline or lost signal right after paying. Set this URL in Paystack → Settings → API Keys & Webhooks.
 *
 * Safety:
 *  - the request must carry a valid x-paystack-signature (HMAC-SHA512 of the body with your secret key);
 *  - only payments our own checkout created are honoured (matched by reference), and the plan and price come from
 *    OUR record, never from the event's metadata;
 *  - granting is idempotent, so Paystack retrying, or the student's browser verifying at the same time, is harmless.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "@/lib/env";
import { getPaystackSecret } from "@/lib/paystack-key";
import { finalizePayment, type PaymentRow } from "@/lib/payment-finalize";
import { signatureOk } from "@/lib/paystack-webhook";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  try {
    const { url, serviceRoleKey } = getSupabaseAdminEnv();
    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

    const secret = (await getPaystackSecret(admin)).key;
    if (!secret) return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
    if (!signatureOk(raw, req.headers.get("x-paystack-signature"), secret)) {
      return NextResponse.json({ error: "Bad signature." }, { status: 401 });
    }

    let event: { event?: string; data?: { reference?: string; amount?: number; status?: string } };
    try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "Bad body." }, { status: 400 }); }

    // Only successful charges matter; acknowledge everything else so Paystack stops retrying it
    if (event.event !== "charge.success" || event.data?.status !== "success" || !event.data.reference) {
      return NextResponse.json({ ok: true, ignored: event.event ?? "unknown" });
    }

    const { data: row } = await admin
      .from("payments")
      .select("id, user_id, reference, amount_kobo, status, plan, discount_code, metadata")
      .eq("reference", event.data.reference)
      .maybeSingle();
    if (!row) {
      // Not one of our checkouts (or the record was never saved). Never grant from the event alone.
      console.warn("[paystack-webhook] unknown reference", event.data.reference);
      return NextResponse.json({ ok: true, ignored: "unknown reference" });
    }

    const result = await finalizePayment(admin, row as PaymentRow, Number(event.data.amount ?? 0));
    if (result.status === "underpaid") console.warn("[paystack-webhook] underpaid", event.data.reference);
    return NextResponse.json({ ok: true, result: result.status });
  } catch (e) {
    // A real failure: answer 500 so Paystack retries later (granting is idempotent)
    console.error("[paystack-webhook]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
