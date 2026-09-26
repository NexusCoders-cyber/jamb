import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/health
 *
 * Returns service configuration status. Gated behind an internal secret
 * (HEALTH_SECRET env var) so external callers cannot probe which services
 * are configured. Pass the secret as the `Authorization: Bearer <secret>`
 * header or `?secret=<secret>` query param.
 *
 * If HEALTH_SECRET is not set the endpoint falls back to allowing all
 * requests (useful during local development before the var is configured).
 */
export function GET(request: NextRequest) {
  const secret = process.env.HEALTH_SECRET;

  if (secret) {
    const authHeader = request.headers.get("authorization") ?? "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const querySecret = request.nextUrl.searchParams.get("secret");
    const provided = bearerToken ?? querySecret;

    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const services = {
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    paystack: Boolean(process.env.PAYSTACK_SECRET_KEY),
    resend: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
    aloc: Boolean(process.env.ALOC_API_KEY),
  };

  return NextResponse.json({
    ok: true,
    app: "Orbit Prep",
    services,
    timestamp: new Date().toISOString(),
  });
}
