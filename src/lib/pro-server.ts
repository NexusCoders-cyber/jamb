/**
 * Server-side check for "may this student receive questions?" — so the Pro rules can't be skipped by calling the API
 * directly from a browser console. The app's screens already hide Pro features; this makes the server agree.
 *
 *   admin                                  → yes
 *   free plan                              → no (except small samples such as the 10-question daily challenge)
 *   paid/trial plan, licence is on ANOTHER phone (the request names this phone) → no
 *   anything else, or the database can't answer → yes (never lock a paying student out because of our own outage)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEVICE_ID_RE, getMaxDevices } from "@/lib/device-server";

export type QuestionAccess =
  | { allowed: true }
  | { allowed: false; code: "pro_required" | "device_locked"; message: string };

export const FREE_SAMPLE_MAX = 10;

export async function questionAccess(
  admin: SupabaseClient,
  userId: string,
  deviceId: string | null,
  opts: { freeSample?: boolean } = {},
): Promise<QuestionAccess> {
  try {
    const { data: profile, error } = await admin.from("profiles").select("role, premium_until").eq("id", userId).maybeSingle();
    if (error || !profile) return { allowed: true };
    if (profile.role === "admin") return { allowed: true };

    const pro = !!profile.premium_until && new Date(profile.premium_until as string).getTime() > Date.now();
    if (!pro) {
      if (opts.freeSample) return { allowed: true };
      return { allowed: false, code: "pro_required", message: "Pro is required for this. Upgrade to continue." };
    }

    if (deviceId && DEVICE_ID_RE.test(deviceId)) {
      const { data: rows, error: devErr } = await admin.from("user_devices").select("device_id, licensed").eq("user_id", userId);
      if (!devErr && rows) {
        const mine = rows.find((r) => r.device_id === deviceId);
        const taken = rows.filter((r) => r.licensed).length;
        if (!mine?.licensed && taken >= (await getMaxDevices(admin))) {
          return { allowed: false, code: "device_locked", message: "Your Pro plan is active on another phone. Upgrade here to use Pro on this phone." };
        }
      }
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}
