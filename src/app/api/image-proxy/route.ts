import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchImageWithHttpFallback, SafeFetchError } from "@/lib/safe-fetch";

/**
 * GET /api/image-proxy?u=<absolute image url>
 *
 * Fallback for question diagrams the browser cannot load directly (http-only hosts, hot-link
 * protection, bad certificates …). The client only calls this AFTER the direct load failed.
 * Signed-in users only, rate limited, SSRF-hardened (see lib/safe-fetch.ts).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 240;
const hits = new Map<string, { count: number; start: number }>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = hits.get(userId);
  if (!entry || now - entry.start > WINDOW_MS) {
    hits.set(userId, { count: 1, start: now });
    // keep the map small
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now - v.start > WINDOW_MS) hits.delete(k);
    }
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Authentication required", 401);
  if (rateLimited(user.id)) return fail("Too many image requests. Try again in a minute.", 429);

  const target = new URL(request.url).searchParams.get("u") ?? "";
  if (!target || target.length > 2048) return fail("An image address is required.", 400);
  if (!/^https?:\/\//i.test(target)) return fail("Only http(s) image addresses can be loaded.", 400);

  try {
    const image = await fetchImageWithHttpFallback(target);
    return new Response(new Uint8Array(image.buffer), {
      status: 200,
      headers: {
        "Content-Type": image.contentType,
        "Content-Length": String(image.buffer.length),
        // The same question image is shown again and again — let the device keep it
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
        // Opened directly, an SVG must not be able to run script on our origin
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "Content-Disposition": "inline",
      },
    });
  } catch (err) {
    if (err instanceof SafeFetchError) {
      const status =
        err.code === "bad-url" ? 400
        : err.code === "blocked" ? 403
        : err.code === "too-large" ? 413
        : err.code === "not-image" ? 415
        : err.code === "upstream-status" ? 404
        : 502;
      return fail(err.message, status);
    }
    return fail("The image could not be loaded.", 502);
  }
}
