import { NextResponse } from "next/server";
import { errorResponse, getAdminClient, requireUser } from "@/lib/quiz-server";
import { claimDevice, cleanLabel, DEVICE_ID_RE, getMaxDevices } from "@/lib/device-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/device/check  { deviceId, label }
 * Called by the app after sign-in. Records the device for every student and, for a paying (or trial) student,
 * decides whether THIS device holds the Pro licence:
 *   - already licensed          → pro features on
 *   - a free slot (default 1)   → this device takes it (the first phone to open the app after paying)
 *   - slots all taken           → licensed:false — the app asks them to pay to use Pro on this phone
 * Admins are exempt. Fails open (licensed:true) if the licence system is unavailable.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as { deviceId?: string; label?: string };
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    if (!DEVICE_ID_RE.test(deviceId)) return NextResponse.json({ error: "Invalid device id" }, { status: 400 });
    const label = cleanLabel(body.label);

    const admin = getAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role, premium_until")
      .eq("id", user.id)
      .maybeSingle();

    const pro = !!profile?.premium_until && new Date(profile.premium_until as string) > new Date();
    const isAdmin = profile?.role === "admin";

    if (!pro || isAdmin) {
      await claimDevice(admin, user.id, deviceId, label, "track");
      return NextResponse.json({ ok: true, pro, licensed: pro });
    }

    const licensed = await claimDevice(admin, user.id, deviceId, label, "claim");
    if (licensed === null) return NextResponse.json({ ok: true, pro, licensed: true, degraded: true });

    let otherDevice: string | null = null;
    if (!licensed) {
      const { data } = await admin
        .from("user_devices")
        .select("label, last_seen")
        .eq("user_id", user.id)
        .eq("licensed", true)
        .order("last_seen", { ascending: false })
        .limit(1);
      otherDevice = (data?.[0]?.label as string | undefined) ?? null;
    }
    return NextResponse.json({ ok: true, pro, licensed, maxDevices: await getMaxDevices(admin), otherDevice });
  } catch (e) {
    return errorResponse(e);
  }
}
