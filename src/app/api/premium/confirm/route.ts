import { NextResponse } from "next/server";
import { verifyPaystackTransaction } from "@/lib/services";
import { getAdminClient, requireUser, HttpError, errorResponse, notify } from "@/lib/quiz-server";

export const dynamic = "force-dynamic";

type PaymentRow = {
  id: string;
  user_id: string;
  reference: string;
  amount_kobo: number;
  status: string;
  plan: string | null;
  discount_code: string | null;
  metadata: Record<string, unknown> | null;
};

/**
 * POST /api/premium/confirm — finalize a payment after the Paystack redirect.
 * Verifies server-side with Paystack (never trusts the client), grants
 * premium, records discount redemption. Body: { reference }
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as { reference?: string };
    const reference = (body.reference ?? "").trim();
    if (!reference) throw new HttpError(400, "Payment reference is required");

    const supabase = getAdminClient();

    const { data: paymentRow } = await supabase
      .from("payments")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();
    const payment = (paymentRow as unknown as PaymentRow) ?? null;
    if (!payment) throw new HttpError(404, "Payment not found");
    if (payment.user_id !== user.id) throw new HttpError(403, "This payment belongs to a different account");
    if (payment.status === "paid") {
      return NextResponse.json({ ok: true, alreadyPaid: true, plan: payment.plan });
    }

    // Verify with Paystack
    const result = await verifyPaystackTransaction(reference);
    const success = result.status === true && result.data?.status === "success";
    if (!success) throw new HttpError(402, "Payment was not successful — no premium applied");

    // Guard against tampered amounts
    const paidKobo = Number(result.data?.amount ?? 0);
    if (paidKobo < payment.amount_kobo) throw new HttpError(402, "Paid amount does not match the plan price");

    // Claim atomically so a double tap / retry cannot grant premium twice
    const { data: claimed } = await supabase
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", payment.id)
      .neq("status", "paid")
      .select("id");
    if (!claimed || claimed.length === 0) return NextResponse.json({ ok: true, alreadyPaid: true, plan: payment.plan });

    // Grant premium
    const plan = payment.plan ?? "lifetime";
    if (plan === "lifetime") {
      await supabase.from("profiles").update({ premium_lifetime: true }).eq("id", user.id);
    } else {
      const { data: p } = await supabase.from("profiles").select("premium_until").eq("id", user.id).single();
      const current = (p as { premium_until: string | null } | null)?.premium_until;
      const from = current && new Date(current).getTime() > Date.now() ? new Date(current) : new Date();
      const until = new Date(from.getTime() + 30 * 24 * 3600 * 1000);
      await supabase.from("profiles").update({ premium_until: until.toISOString() }).eq("id", user.id);
    }

    // Record discount usage (one per student per code — DB unique constraint)
    if (payment.discount_code) {
      const { data: dc } = await supabase
        .from("discount_codes")
        .select("id, code")
        .eq("code", payment.discount_code)
        .maybeSingle();
      const code = dc as { id: string; code: string } | null;
      if (code) {
        await supabase.from("discount_redemptions").upsert({
          code_id: code.id,
          user_id: user.id,
          payment_id: payment.id,
          amount_off_kobo: Number(payment.metadata?.discount_kobo ?? 0),
        }, { onConflict: "code_id,user_id" });
        // increment usage counter
        const { data: fresh } = await supabase.from("discount_codes").select("used_count").eq("id", code.id).single();
        await supabase.from("discount_codes").update({ used_count: ((fresh?.used_count as number) ?? 0) + 1 }).eq("id", code.id);
      }
    }

    await notify(
      supabase,
      user.id,
      "👑 Premium activated!",
      plan === "lifetime" ? "Your lifetime premium is now active. Enjoy Qubit!" : "Your monthly premium is active for 30 days.",
    );

    return NextResponse.json({ ok: true, plan });
  } catch (e) {
    return errorResponse(e);
  }
}
