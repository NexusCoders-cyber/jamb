import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/pwned?prefix=ABCDE
 * Thin proxy to the Pwned Passwords range API. Receives only a 5-character hash prefix (never a password).
 * Fails soft: on any upstream problem it returns an empty list, which the client treats as "not leaked".
 */
export async function GET(request: NextRequest) {
  const prefix = request.nextUrl.searchParams.get("prefix") ?? "";
  if (!/^[0-9A-Fa-f]{5}$/.test(prefix)) {
    return NextResponse.json({ error: "prefix must be 5 hex characters" }, { status: 400 });
  }
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix.toUpperCase()}`, {
      headers: { "Add-Padding": "true", "User-Agent": "qubit-cbt-password-check" },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return new NextResponse("", { status: 200 });
    return new NextResponse(await res.text(), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return new NextResponse("", { status: 200 });
  }
}
