/**
 * GET /api/payments/prices
 * Returns current plan prices from admin_settings (public, no auth needed).
 * Also returns whether free trial is available.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { url, serviceRoleKey } = getSupabaseAdminEnv();
    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

    const { data } = await admin
      .from("admin_settings")
      .select("key, value")
      .in("key", [
        "price_weekly_naira",
        "price_monthly_naira",
        "price_biannual_naira",
        "free_trial_enabled",
        "free_trial_days",
      ]);

    const settings = Object.fromEntries(
      ((data ?? []) as Array<{ key: string; value: string }>).map((r) => [r.key, r.value]),
    );

    return NextResponse.json({
      weekly:   parseInt(settings.price_weekly_naira   ?? "200",  10),
      monthly:  parseInt(settings.price_monthly_naira  ?? "800",  10),
      biannual: parseInt(settings.price_biannual_naira ?? "1700", 10),
      freeTrialEnabled: settings.free_trial_enabled === "true",
      freeTrialDays:    parseInt(settings.free_trial_days ?? "1", 10),
    });
  } catch (_e) {
    // Fallback to hardcoded defaults if DB unreachable
    return NextResponse.json({ weekly: 200, monthly: 800, biannual: 1700, freeTrialEnabled: false, freeTrialDays: 1 });
  }
}
