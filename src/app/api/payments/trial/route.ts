/**
 * POST /api/payments/trial
 *
 * Activates a free trial for the authenticated user.
 * Rules enforced server-side:
 *   - free_trial_enabled must be "true" in admin_settings
 *   - user must never have used a trial before (trial_used_at is null)
 *   - user must not already be Pro (premium_until > now)
 *
 * Returns: { ok: true, premiumUntil } or { error }
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "@/lib/env";

function adminClient() {
  const { url, serviceRoleKey } = getSupabaseAdminEnv();
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

export async function POST() {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in to claim your free trial." }, { status: 401 });
    }

    const admin = adminClient();

    // ── Check admin_settings ──────────────────────────────────────────────────
    const { data: settings } = await admin
      .from("admin_settings")
      .select("key, value")
      .in("key", ["free_trial_enabled", "free_trial_days"]);

    const map = Object.fromEntries(
      ((settings ?? []) as Array<{ key: string; value: string }>).map((r) => [r.key, r.value]),
    );

    if (map.free_trial_enabled !== "true") {
      return NextResponse.json(
        { error: "Free trial is not available right now." },
        { status: 403 },
      );
    }

    const trialDays = Math.max(1, parseInt(map.free_trial_days ?? "1", 10));

    // ── Check profile ─────────────────────────────────────────────────────────
    const { data: profile } = await admin
      .from("profiles")
      .select("premium_until, trial_used_at")
      .eq("id", user.id)
      .maybeSingle();

    // Already Pro
    if (profile?.premium_until && new Date(profile.premium_until) > new Date()) {
      return NextResponse.json(
        { error: "You already have an active Pro subscription." },
        { status: 409 },
      );
    }

    // Trial already used
    if (profile?.trial_used_at) {
      return NextResponse.json(
        { error: "You have already used your free trial." },
        { status: 409 },
      );
    }

    // ── Grant trial ───────────────────────────────────────────────────────────
    const premiumUntil = new Date(
      Date.now() + trialDays * 24 * 3600 * 1000,
    ).toISOString();

    const { error: updateError } = await admin
      .from("profiles")
      .update({
        premium_until: premiumUntil,
        trial_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("[trial]", updateError.message);
      return NextResponse.json({ error: "Could not activate trial. Try again." }, { status: 500 });
    }

    // ── Notification ──────────────────────────────────────────────────────────
    await admin.from("notifications").insert({
      user_id: user.id,
      title: "🎁 Free trial activated!",
      body: `Your ${trialDays}-day Pro trial is live. Enjoy full access — upgrade before it ends to keep it.`,
    });

    return NextResponse.json({ ok: true, premiumUntil, trialDays });
  } catch (e) {
    console.error("[trial]", e);
    return NextResponse.json({ error: "Server error. Try again." }, { status: 500 });
  }
}
