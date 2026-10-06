/**
 * Server side of the "one Pro licence per phone" rule. Uses the service role; the database function
 * claim_pro_device() does the locking (see supabase/user_devices.sql).
 *
 * Everything here FAILS OPEN: if the table/function is missing or the database hiccups, a paying student
 * keeps Pro. Never lock someone out of what they paid for because of our own infrastructure problem.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const DEVICE_ID_RE = /^[A-Za-z0-9-]{16,64}$/;

export function cleanLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[^\w .,()·+\-/]/g, "").trim().slice(0, 80);
  return s || null;
}

export async function getMaxDevices(admin: SupabaseClient): Promise<number> {
  try {
    const { data } = await admin.from("admin_settings").select("value").eq("key", "pro_max_devices").maybeSingle();
    const n = parseInt(String(data?.value ?? "1"), 10);
    return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 1;
  } catch {
    return 1;
  }
}

export type ClaimMode = "track" | "claim" | "force";

/** @returns whether this device now holds the licence, or null if the licence system is unavailable. */
export async function claimDevice(
  admin: SupabaseClient,
  userId: string,
  deviceId: string,
  label: string | null,
  mode: ClaimMode,
): Promise<boolean | null> {
  try {
    const max = await getMaxDevices(admin);
    const { data, error } = await admin.rpc("claim_pro_device", {
      p_user: userId,
      p_device: deviceId,
      p_label: label,
      p_mode: mode,
      p_max: max,
    });
    if (error) return null;
    return data === true;
  } catch {
    return null;
  }
}
