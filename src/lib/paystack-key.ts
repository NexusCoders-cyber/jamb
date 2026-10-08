import type { SupabaseClient } from "@supabase/supabase-js";

export type PaystackSecret = { key: string; source: "env" | "database" | "none" };

const looksValid = (k: string) => /^sk_(live|test)_[A-Za-z0-9]{8,}$/.test(k);

/**
 * The Paystack secret key. The server environment variable PAYSTACK_SECRET_KEY always wins, so the key can live
 * outside the database. The key saved in admin_settings is only a fallback for apps that haven't set the variable yet.
 * Pass `dbValue` when the caller already loaded admin_settings, otherwise it is fetched here.
 */
export async function getPaystackSecret(admin: SupabaseClient, dbValue?: string | null): Promise<PaystackSecret> {
  const env = (process.env.PAYSTACK_SECRET_KEY ?? "").trim();
  if (looksValid(env)) return { key: env, source: "env" };
  let fromDb = (dbValue ?? "").trim();
  if (dbValue === undefined) {
    try {
      const { data } = await admin.from("admin_settings").select("value").eq("key", "paystack_secret_key").maybeSingle();
      fromDb = String((data as { value?: string } | null)?.value ?? "").trim();
    } catch {
      fromDb = "";
    }
  }
  return fromDb.length >= 10 ? { key: fromDb, source: "database" } : { key: "", source: "none" };
}

/** Safe to show an admin: "sk_live_…ab12". Never the whole key. */
export function maskKey(k: string): string {
  if (!k) return "";
  const prefix = k.match(/^sk_(live|test)_/)?.[0] ?? "";
  return `${prefix}…${k.slice(-4)}`;
}
