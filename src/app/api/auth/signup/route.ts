import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";

  if (!email) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    // Map Supabase error messages to user-friendly ones
    const msg = error.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already")) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try signing in instead." },
        { status: 400 },
      );
    }
    if (msg.includes("invalid email")) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (msg.includes("password")) {
      return NextResponse.json({ error: "Password is too weak. Use at least 8 characters." }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Supabase returns a user even when email confirmation is required.
  // identities being empty means the email is already confirmed / taken.
  if (data.user && data.user.identities?.length === 0) {
    return NextResponse.json(
      { error: "An account with this email already exists. Try signing in instead." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    user: { email: data.user?.email, user_metadata: data.user?.user_metadata },
  });
}
