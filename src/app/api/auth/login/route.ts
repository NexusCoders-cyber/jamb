import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = error.message.toLowerCase();
    // Don't leak whether the email exists — keep it generic
    if (msg.includes("invalid") || msg.includes("credentials") || msg.includes("password") || msg.includes("not found")) {
      return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
    }
    if (msg.includes("email not confirmed") || msg.includes("confirm")) {
      return NextResponse.json(
        { error: "Please confirm your email address before signing in. Check your inbox." },
        { status: 401 },
      );
    }
    if (msg.includes("rate limit") || msg.includes("too many")) {
      return NextResponse.json(
        { error: "Too many login attempts. Please wait a few minutes and try again." },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: "Unable to sign in right now. Please try again." }, { status: 401 });
  }

  return NextResponse.json({
    user: { email: data.user.email, user_metadata: data.user.user_metadata },
  });
}
