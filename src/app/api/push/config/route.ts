import { NextResponse } from "next/server";
import { pushConfig } from "@/lib/push-server";

export const dynamic = "force-dynamic";

/** The public half of the VAPID key, which the phone needs to subscribe. enabled=false until the server keys are set. */
export async function GET() {
  const cfg = pushConfig();
  return NextResponse.json({ enabled: !!cfg, publicKey: cfg?.publicKey ?? null });
}
