import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED = [
  "/dashboard", "/exam", "/practice", "/results", "/review",
  "/analytics", "/smart-coach", "/knowledge-hub", "/progress",
  "/streaks", "/notifications", "/study-plan", "/mistakes",
  "/daily-challenge", "/settings", "/achievements", "/community",
  "/messages", "/speed-training", "/admin",
];

// Routes that redirect authenticated users away
const AUTH_ONLY = ["/", "/signup"];

// Routes that are always public — no redirect either way
const PUBLIC_BYPASS = ["/reset-password"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never intercept API routes — they handle auth themselves
  if (pathname.startsWith("/api/")) return NextResponse.next({ request });

  // Skip Next.js internal RSC / prefetch requests
  const isRSC =
    request.nextUrl.searchParams.has("_rsc") ||
    request.headers.has("next-router-state-tree") ||
    request.headers.get("accept")?.includes("text/x-component");

  if (isRSC) return NextResponse.next({ request });

  // Build a mutable response so Supabase SSR can refresh cookies
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip auth checks if env vars are missing (build time / misconfigured env)
  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isAuthOnly  = AUTH_ONLY.includes(pathname);
  const isBypass    = PUBLIC_BYPASS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isBypass) return response;

  // Unauthenticated → protected route: redirect to login
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated → login/signup: redirect to dashboard
  if (user && isAuthOnly) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico and static asset extensions
     * - /api/* routes (API routes never need auth proxy)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
