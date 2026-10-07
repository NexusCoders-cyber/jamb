import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { DEVICE_ID_RE, getMaxDevices } from "@/lib/device-server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET  /api/admin/devices?userId=…  → { devices, premiumUntil, maxDevices }
 * POST /api/admin/devices { userId, action, deviceId?, days? }
 *   action: "reset"      — free every licence slot (the student's next phone takes it, no new payment)
 *           "revoke"     — free one device's licence
 *           "forget"     — delete one device record
 *           "grant_pro"  — extend Pro by `days` (1–3650) from today or from the current expiry
 *           "remove_pro" — end Pro now
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (ctx instanceof NextResponse) return ctx;

  const userId = request.nextUrl.searchParams.get("userId") ?? "";
  if (!UUID_RE.test(userId)) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const [{ data: devices, error }, { data: profile }, maxDevices] = await Promise.all([
    ctx.admin.from("user_devices")
      .select("device_id, label, licensed, licensed_at, first_seen, last_seen")
      .eq("user_id", userId)
      .order("last_seen", { ascending: false })
      .limit(50),
    ctx.admin.from("profiles").select("premium_until").eq("id", userId).maybeSingle(),
    getMaxDevices(ctx.admin),
  ]);
  if (error) {
    // Table not created yet → show an empty list instead of an error wall
    return NextResponse.json({ devices: [], premiumUntil: profile?.premium_until ?? null, maxDevices, setup: true });
  }
  return NextResponse.json({ devices: devices ?? [], premiumUntil: profile?.premium_until ?? null, maxDevices });
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (ctx instanceof NextResponse) return ctx;

  let body: { userId?: unknown; action?: unknown; deviceId?: unknown; days?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const userId = typeof body.userId === "string" ? body.userId : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!UUID_RE.test(userId)) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  if (action === "reset") {
    const { error } = await ctx.admin.from("user_devices").update({ licensed: false, licensed_at: null }).eq("user_id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "revoke" || action === "forget") {
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    if (!DEVICE_ID_RE.test(deviceId)) return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
    const q = action === "revoke"
      ? ctx.admin.from("user_devices").update({ licensed: false, licensed_at: null }).eq("user_id", userId).eq("device_id", deviceId)
      : ctx.admin.from("user_devices").delete().eq("user_id", userId).eq("device_id", deviceId);
    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "grant_pro") {
    const days = Number(body.days);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      return NextResponse.json({ error: "days must be a whole number from 1 to 3650" }, { status: 400 });
    }
    const { data: p } = await ctx.admin.from("profiles").select("premium_until").eq("id", userId).maybeSingle();
    const current = p?.premium_until ? new Date(p.premium_until).getTime() : 0;
    const from = Math.max(Date.now(), current);
    const until = new Date(from + days * 86_400_000).toISOString();
    const { error } = await ctx.admin.from("profiles").update({ premium_until: until }).eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, premiumUntil: until });
  }

  if (action === "remove_pro") {
    const { error } = await ctx.admin.from("profiles").update({ premium_until: null }).eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, premiumUntil: null });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
