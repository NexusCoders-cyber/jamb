/**
 * Turns a paid Paystack transaction into Pro access. The ONE place this happens: the student's browser
 * (verify / confirm routes) and Paystack's own server call (webhook) all end up here, so a payment is granted
 * exactly once no matter which of them gets there first — or whether the student's phone ever comes back.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { claimDevice, cleanLabel, DEVICE_ID_RE } from "@/lib/device-server";

export const PLAN_DAYS: Record<string, number> = { weekly: 7, monthly: 30, biannual: 180 };
const LIFETIME_DAYS = 100 * 365;
const PLAN_LABEL: Record<string, string> = { weekly: "7-day", monthly: "30-day", biannual: "6-month", lifetime: "lifetime" };

export type PaymentRow = {
  id: string;
  user_id: string;
  reference: string;
  amount_kobo: number | null;
  status: string;
  plan: string | null;
  discount_code: string | null;
  metadata: Record<string, unknown> | null;
};

export type FinalizeResult =
  | { status: "granted"; plan: string; premiumUntil: string }
  | { status: "already"; plan: string; premiumUntil: string | null }
  | { status: "underpaid"; plan: string };

/**
 * `paidKobo` is what Paystack says was charged. Price and plan come from OUR payment row (created at checkout),
 * never from anything the browser or Paystack metadata claims.
 */
export async function finalizePayment(
  admin: SupabaseClient,
  payment: PaymentRow,
  paidKobo: number,
  opts: { deviceId?: string | null; label?: string | null } = {},
): Promise<FinalizeResult> {
  const plan = payment.plan ?? "lifetime";

  const currentUntil = async (): Promise<string | null> => {
    const { data } = await admin.from("profiles").select("premium_until").eq("id", payment.user_id).maybeSingle();
    return (data as { premium_until: string | null } | null)?.premium_until ?? null;
  };

  if (payment.status === "paid") return { status: "already", plan, premiumUntil: await currentUntil() };
  if (Number(paidKobo) < Number(payment.amount_kobo ?? 0)) return { status: "underpaid", plan };

  // Claim atomically: two things arriving at once (double tap, retry, webhook + browser) cannot both grant Pro.
  const { data: claimed } = await admin
    .from("payments")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", payment.id)
    .neq("status", "paid")
    .select("id");
  if (!claimed || claimed.length === 0) return { status: "already", plan, premiumUntil: await currentUntil() };

  try {
    // Extend from today, or from the current end date if Pro is still running
    const days = plan === "lifetime" ? LIFETIME_DAYS : (PLAN_DAYS[plan] ?? 30);
    const existing = await currentUntil();
    const base = existing && new Date(existing).getTime() > Date.now() ? new Date(existing) : new Date();
    const premiumUntil = new Date(base.getTime() + days * 24 * 3600 * 1000).toISOString();
    const { error: upErr } = await admin.from("profiles").update({ premium_until: premiumUntil, updated_at: new Date().toISOString() }).eq("id", payment.user_id);
    if (upErr) throw new Error(upErr.message);

    // Everything below is best effort: Pro is already granted, none of it may undo that.
    await recordDiscount(admin, payment).catch(() => undefined);

    // The phone that paid holds the Pro licence (an older phone on the same account goes back to free)
    const deviceId = opts.deviceId ?? (typeof payment.metadata?.device_id === "string" ? payment.metadata.device_id : null);
    if (deviceId && DEVICE_ID_RE.test(deviceId)) {
      const label = opts.label ?? (typeof payment.metadata?.device_label === "string" ? payment.metadata.device_label : null);
      await claimDevice(admin, payment.user_id, deviceId, cleanLabel(label), "force").catch(() => undefined);
    }

    await admin.from("notifications").insert({
      user_id: payment.user_id,
      title: "⭐ You are now Pro!",
      body: `Your ${PLAN_LABEL[plan] ?? plan} Pro subscription is active. Enjoy unlimited access to all features!`,
    }).then(undefined, () => undefined);

    return { status: "granted", plan, premiumUntil };
  } catch (e) {
    // Pro was NOT granted — put the payment back so the next attempt (browser retry or Paystack's webhook retry) can finish the job
    await admin.from("payments").update({ status: "pending", paid_at: null }).eq("id", payment.id).eq("status", "paid");
    throw e;
  }
}

async function recordDiscount(admin: SupabaseClient, payment: PaymentRow): Promise<void> {
  let codeId = typeof payment.metadata?.code_id === "string" ? payment.metadata.code_id : null;
  if (!codeId && payment.discount_code) {
    const { data } = await admin.from("discount_codes").select("id").eq("code", payment.discount_code).maybeSingle();
    codeId = (data as { id: string } | null)?.id ?? null;
  }
  if (!codeId) return;
  // One redemption per student per code (database unique constraint); only count it the first time
  const { data: had } = await admin.from("discount_redemptions").select("id").eq("code_id", codeId).eq("user_id", payment.user_id).maybeSingle();
  await admin.from("discount_redemptions").upsert(
    { code_id: codeId, user_id: payment.user_id, payment_id: payment.id, amount_off_kobo: Number(payment.metadata?.discount_kobo ?? 0) },
    { onConflict: "code_id,user_id" },
  );
  if (had) return;
  const { error } = await admin.rpc("increment_discount_used", { p_code_id: codeId });
  if (error) {
    const { data: fresh } = await admin.from("discount_codes").select("used_count").eq("id", codeId).maybeSingle();
    await admin.from("discount_codes").update({ used_count: Number((fresh as { used_count?: number } | null)?.used_count ?? 0) + 1 }).eq("id", codeId);
  }
}
