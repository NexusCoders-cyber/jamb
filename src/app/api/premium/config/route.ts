import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/quiz-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/premium/config — plan prices set by admins in /admin/payments.
 * Falls back to sensible defaults before premium_payments.sql is applied.
 */
export async function GET() {
  const supabase = getAdminClient();
  const { data } = await supabase.from("admin_settings").select("key, value");
  const settings = Object.fromEntries(((data ?? []) as Array<{ key: string; value: string }>).map((s) => [s.key, s.value]));

  return NextResponse.json({
    lifetimeNaira: Number(settings.price_lifetime_naira ?? 1000),
    monthlyNaira: Number(settings.price_monthly_naira ?? 500),
  });
}
