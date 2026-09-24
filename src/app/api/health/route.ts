import { NextResponse } from "next/server";

export function GET() {
  const services = {
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    paystack: Boolean(process.env.PAYSTACK_SECRET_KEY),
    resend: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
    aloc: Boolean(process.env.ALOC_API_URL && process.env.ALOC_API_KEY),
  };

  return NextResponse.json({
    ok: true,
    app: "Orbit Prep",
    services,
    timestamp: new Date().toISOString(),
  });
}
