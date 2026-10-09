import { NextResponse } from "next/server";
import { verifyPaystackTransaction } from "@/lib/services";
import { getAdminClient, requireUser, HttpError, errorResponse, notify } from "@/lib/quiz-server";
import { finalizePayment } from "@/lib/payment-finalize";

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
    const body = (await req.json().catch(() => ({}))) as { reference?: string; deviceId?: string; label?: string };
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

    // Grant premium (shared with the Paystack webhook; safe to run twice, only the first one does anything)
    const done = await finalizePayment(supabase, payment, Number(result.data?.amount ?? 0), {
      deviceId: typeof body.deviceId === "string" ? body.deviceId : null,
      label: body.label ?? null,
    });
    if (done.status === "underpaid") throw new HttpError(402, "Paid amount does not match the plan price");
    if (done.status === "already") return NextResponse.json({ ok: true, alreadyPaid: true, plan: done.plan });
    const plan = done.plan;

    return NextResponse.json({ ok: true, plan });
  } catch (e) {
    return errorResponse(e);
  }
}
