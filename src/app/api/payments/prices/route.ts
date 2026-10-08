/**
 * GET /api/payments/prices
 * Current plan prices from admin_settings (public, no auth needed) — the same numbers the landing page shows.
 * Also returns whether the free trial is available.
 */
import { NextResponse } from "next/server";
import { getLivePrices } from "@/lib/prices-server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getLivePrices());
}
