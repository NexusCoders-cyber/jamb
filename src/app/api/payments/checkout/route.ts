/**
 * POST /api/payments/checkout
 *
 * Initialises a Paystack transaction. The Paystack keys are stored in
 * admin_settings so the admin can rotate them without redeploying.
 *
 * Body: { plan: "weekly" | "monthly" | "biannual", code?: string }
 * Returns: { authorizationUrl, reference, publicKey, amountKobo }
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPaystackSecret } from "@/lib/paystack-key";
import { cleanLabel, DEVICE_ID_RE } from "@/lib/device-server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "@/lib/env";

const PLAN_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  biannual: 180,
};

const PLAN_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  biannual: "6-Month",
};

function adminClient() {
  const { url, serviceRoleKey } = getSupabaseAdminEnv();
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

async function getSettings(supabase: ReturnType<typeof adminClient>) {
  const { data } = await supabase
    .from("admin_settings")
    .select("key, value")      .in("key", [
      "price_weekly_naira",
      "price_monthly_naira",
      "price_biannual_naira",
      "paystack_secret_key",
      "paystack_public_key",
      "paystack_channels",
    ]);
  return Object.fromEntries(
    ((data ?? []) as Array<{ key: string; value: string }>).map((r) => [r.key, r.value]),
  );
}

export async function POST(req: Request) {
  try {
    // Auth — must be signed in
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in to subscribe." }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      plan?: string;
      code?: string;
      deviceId?: string;
      label?: string;
    };

    const plan = body.plan?.toLowerCase();
    if (!plan || !PLAN_DAYS[plan]) {
      return NextResponse.json(
        { error: "Invalid plan. Choose weekly, monthly, or biannual." },
        { status: 400 },
      );
    }

    const admin = adminClient();
    const settings = await getSettings(admin);

    const secretKey = (await getPaystackSecret(admin, settings.paystack_secret_key)).key;
    const publicKey = settings.paystack_public_key?.trim();
    if (!secretKey || secretKey.length < 10) {
      return NextResponse.json(
        { error: "Payment is not configured yet. Contact support." },
        { status: 503 },
      );
    }

    // Base price in naira
    const priceKey = `price_${plan}_naira`;
    const baseNaira = parseInt(settings[priceKey] ?? "0", 10);
    if (!baseNaira) {
      return NextResponse.json({ error: "Plan price not set." }, { status: 500 });
    }

    // Apply discount code if provided
    let discountKobo = 0;
    let codeId: string | null = null;
    const code = body.code?.trim().toUpperCase();
    if (code) {
      const { data: codeRow } = await admin
        .from("discount_codes")
        .select("id, kind, value, max_uses, used_count, active, expires_at")
        .eq("code", code)
        .maybeSingle();

      if (!codeRow || !codeRow.active) {
        return NextResponse.json({ error: "Discount code is invalid or expired." }, { status: 400 });
      }
      if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
        return NextResponse.json({ error: "Discount code has expired." }, { status: 400 });
      }
      if (codeRow.max_uses !== null && codeRow.used_count >= codeRow.max_uses) {
        return NextResponse.json({ error: "Discount code has reached its usage limit." }, { status: 400 });
      }
      // Check user hasn't used this code before
      const { data: existing } = await admin
        .from("discount_redemptions")
        .select("id")
        .eq("code_id", codeRow.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ error: "You have already used this discount code." }, { status: 400 });
      }

      const baseKobo = baseNaira * 100;
      if (codeRow.kind === "percent") {
        discountKobo = Math.round((baseKobo * codeRow.value) / 100);
      } else {
        discountKobo = Math.min(codeRow.value, baseKobo);
      }
      codeId = codeRow.id;
    }

    // Paystack's channels on this merchant reject charges below ₦100 with
    // "No active channel to process transaction" — so after discounts, never
    // charge less than the ₦100 floor (verified against the live account).
    const finalKobo = Math.max(10000, baseNaira * 100 - discountKobo);

    // Create Paystack transaction
    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const email = profile?.email ?? user.email ?? "";
    const name = (profile?.full_name as string | undefined) ?? "";

    // Payment channels set by the admin in /admin/payments. Leaving it empty is
    // important: with no `channels` in the request, Paystack uses EVERY channel
    // enabled on the business account, which avoids the
    // "There is no active channel to process this transaction" error that a
    // hard-coded channel list causes when a channel isn't active.
    const channelsRaw = settings.paystack_channels?.trim() ?? "";
    const channels = channelsRaw
      ? channelsRaw.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean)
      : [];

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: finalKobo,
        currency: "NGN",
        ...(channels.length > 0 ? { channels } : {}), // admin-set channels; empty = account defaults
        metadata: {
          user_id: user.id,
          full_name: name,
          plan,
          code_id: codeId,
          discount_kobo: discountKobo,
        },
        callback_url: `${new URL(req.url).origin}/upgrade?verified=1`,
      }),
    });

    if (!paystackRes.ok) {
      const err = (await paystackRes.json().catch(() => ({}))) as { message?: string };
      return NextResponse.json(
        { error: err.message ?? "Could not initialise payment." },
        { status: 502 },
      );
    }

    const psData = (await paystackRes.json()) as {
      status: boolean;
      data?: { authorization_url: string; reference: string };
    };

    if (!psData.status || !psData.data) {
      return NextResponse.json({ error: "Paystack did not return a transaction." }, { status: 502 });
    }

    // Pre-create a pending payment row so verify can update it
    await admin.from("payments").insert({
      user_id: user.id,
      reference: psData.data.reference,
      amount_kobo: finalKobo,
      currency: "NGN",
      status: "pending",
      plan,
      discount_code: code ?? null,
      metadata: {
        plan,
        code_id: codeId,
        discount_kobo: discountKobo,
        label: PLAN_LABELS[plan],
        // The phone that is paying — the Paystack webhook gives Pro to this phone even if the app is closed
        ...(typeof body.deviceId === "string" && DEVICE_ID_RE.test(body.deviceId) ? { device_id: body.deviceId, device_label: cleanLabel(body.label) } : {}),
      },
    });

    return NextResponse.json({
      authorizationUrl: psData.data.authorization_url,
      reference: psData.data.reference,
      publicKey,
      amountKobo: finalKobo,
      plan,
      label: PLAN_LABELS[plan],
    });
  } catch (e) {
    console.error("[checkout]", e);
    return NextResponse.json({ error: "Server error. Try again." }, { status: 500 });
  }
}
