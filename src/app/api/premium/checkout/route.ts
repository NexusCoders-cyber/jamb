import { NextResponse } from "next/server";
import { getPaystackSecretKey } from "@/lib/env";
import { getPaystackSecret } from "@/lib/paystack-key";
import { getAdminClient, requireUser, HttpError, errorResponse } from "@/lib/quiz-server";

export const dynamic = "force-dynamic";

type DiscountRow = {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
};

/**
 * POST /api/premium/checkout — start a Paystack payment.
 * Body: { plan: "lifetime" | "monthly", discountCode?: string }
 * Returns { authorizationUrl, reference, amountNaira, discountNaira }.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as { plan?: string; discountCode?: string };
    const plan = body.plan === "monthly" ? "monthly" : body.plan === "lifetime" ? "lifetime" : null;
    if (!plan) throw new HttpError(400, "plan must be 'lifetime' or 'monthly'");
    if (!user.email || !user.email.includes("@")) throw new HttpError(400, "Your account needs a valid email to pay");
    const payerEmail: string = user.email;

    const supabase = getAdminClient();

    // Admin-set prices + Paystack key (admin_settings is the source of truth —
    // the env fallback may be stale/invalid, which broke this checkout before)
    const { data: settingsData } = await supabase.from("admin_settings").select("key, value");
    const settings = Object.fromEntries(((settingsData ?? []) as Array<{ key: string; value: string }>).map((s) => [s.key, s.value]));
    const baseNaira = plan === "lifetime"
      ? Number(settings.price_lifetime_naira ?? 1000)
      : Number(settings.price_monthly_naira ?? 500);
    const baseKobo = Math.max(10000, baseNaira * 100); // keep realistic charge floor (₦100)

    // Validate the discount code entirely server-side
    let discount: DiscountRow | null = null;
    let discountKobo = 0;
    const rawCode = (body.discountCode ?? "").trim().toUpperCase();
    if (rawCode) {
      const { data: dc } = await supabase
        .from("discount_codes")
        .select("*")
        .eq("code", rawCode)
        .maybeSingle();
      discount = (dc as unknown as DiscountRow) ?? null;

      if (!discount || !discount.active) throw new HttpError(400, "That discount code is not valid");
      if (discount.expires_at && new Date(discount.expires_at).getTime() < Date.now()) throw new HttpError(400, "That discount code has expired");
      if (discount.max_uses !== null && discount.used_count >= discount.max_uses) throw new HttpError(400, "That discount code has been fully used");

      // One redemption per student per code
      const { data: mine } = await supabase
        .from("discount_redemptions")
        .select("id")
        .eq("code_id", discount.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (mine) throw new HttpError(400, "You have already used this discount code");

      discountKobo = discount.kind === "percent"
        ? Math.floor((baseKobo * discount.value) / 100)
        : Math.min(discount.value, baseKobo);
    }

    // Paystack's channels on this merchant reject charges below ₦100 with
    // "No active channel to process transaction" — keep the ₦100 floor.
    const payableKobo = Math.max(10000, baseKobo - discountKobo);
    const reference = `QB-${plan.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // Record the pending payment BEFORE redirecting, so /confirm can match it
    const { error: insertErr } = await supabase.from("payments").insert({
      user_id: user.id,
      reference,
      amount_kobo: payableKobo,
      status: "pending",
      plan,
      discount_code: discount?.code ?? null,
      metadata: { plan, base_kobo: baseKobo, discount_kobo: discountKobo, code_id: discount?.id ?? null },
    });
    if (insertErr) throw new HttpError(500, `Could not record payment: ${insertErr.message}`);

    // Paystack initialize — the server env key wins, the admin-saved key is the fallback
    const settingsMap = Object.fromEntries(((settingsData ?? []) as Array<{ key: string; value: string }>).map((s) => [s.key, s.value]));
    const secretKey = (await getPaystackSecret(supabase, settingsMap.paystack_secret_key ?? "")).key || getPaystackSecretKey();
    const origin = new URL(req.url).origin;
    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: payerEmail,
        amount: payableKobo,
        reference,
        callback_url: `${origin}/premium/success`,
        metadata: { plan, user_id: user.id, discount_code: discount?.code ?? null },
      }),
      cache: "no-store",
    });
    const initJson = (await initRes.json()) as { status?: boolean; message?: string; data?: { authorization_url?: string } };
    if (!initRes.ok || !initJson.status || !initJson.data?.authorization_url) {
      throw new HttpError(502, `Paystack error: ${initJson.message ?? "could not start payment"}`);
    }

    return NextResponse.json({
      authorizationUrl: initJson.data.authorization_url,
      reference,
      amountNaira: Math.round(payableKobo / 100),
      discountNaira: Math.round(discountKobo / 100),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
