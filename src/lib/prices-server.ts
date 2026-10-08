import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "@/lib/env";
import { DEFAULT_PRICES, pricesFromSettings, type Prices } from "@/lib/pricing";

export const PRICE_KEYS = ["price_weekly_naira", "price_monthly_naira", "price_biannual_naira", "free_trial_enabled", "free_trial_days"];

/** The prices students are actually charged (admin_settings). Never throws: falls back to the defaults. */
export async function getLivePrices(): Promise<Prices> {
  try {
    const { url, serviceRoleKey } = getSupabaseAdminEnv();
    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    const { data, error } = await admin.from("admin_settings").select("key, value").in("key", PRICE_KEYS);
    if (error || !data) return DEFAULT_PRICES;
    return pricesFromSettings(Object.fromEntries((data as { key: string; value: string }[]).map((r) => [r.key, r.value])));
  } catch {
    return DEFAULT_PRICES;
  }
}
