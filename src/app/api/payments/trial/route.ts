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
import { clampTrialDays, isProActive } from "@/lib/premium";

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

    const trialDays = clampTrialDays(map.free_trial_days);

    // ── Check profile ─────────────────────────────────────────────────────────
    const { data: profile } = await admin
      .from("profiles")
      .select("premium_until, trial_used_at")
      .eq("id", user.id)
      .maybeSingle();

    // Already Pro
    if (isProActive(profile?.premium_until)) {
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

    // The checks above and this write are separate steps, so two taps (or two phones) at the same moment could both pass
    // them. Repeat the rules inside the write itself: it only changes a row that has never had a trial and is not
    // Pro right now, and says how many rows it changed.
    const nowIso = new Date().toISOString();
    const { data: changed, error: updateError } = await admin
      .from("profiles")
      .update({
        premium_until: premiumUntil,
        trial_used_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", user.id)
      .is("trial_used_at", null)
      .or(`premium_until.is.null,premium_until.lte.${nowIso}`)
      .select("id");

    if (updateError) {
      console.error("[trial]", updateError.message);
      return NextResponse.json({ error: "Could not activate trial. Try again." }, { status: 500 });
    }
    if (!changed || changed.length === 0) {
      return NextResponse.json({ error: "Your free trial is not available (already used or Pro is active)." }, { status: 409 });
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
