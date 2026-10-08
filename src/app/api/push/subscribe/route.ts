import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/quiz-server";
import { PUSH_TOPICS } from "@/lib/push-server";

export const dynamic = "force-dynamic";

const validEndpoint = (e: unknown): e is string => typeof e === "string" && /^https:\/\//.test(e) && e.length <= 1000;

async function currentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** GET ?endpoint=… → is this phone registered, and for which topics? */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!validEndpoint(endpoint)) return NextResponse.json({ subscribed: false, topics: [] });
  const { data, error } = await getAdminClient().from("push_subscriptions").select("topics").eq("endpoint", endpoint).eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ subscribed: false, topics: [], ready: false });
  return NextResponse.json({ subscribed: !!data, topics: (data as { topics?: string[] } | null)?.topics ?? [], ready: true });
}

/** POST { subscription, topics? } → register (or update) this phone for the signed-in student. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; topics?: unknown } | null;
  const sub = body?.subscription;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!validEndpoint(sub?.endpoint) || typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100) {
    return NextResponse.json({ error: "That doesn't look like a valid subscription." }, { status: 400 });
  }
  const topics = Array.isArray(body?.topics)
    ? [...new Set((body!.topics as unknown[]).filter((t): t is string => typeof t === "string" && (PUSH_TOPICS as readonly string[]).includes(t)))]
    : [...PUSH_TOPICS];

  const admin = getAdminClient();
  // A student can have many phones, but one phone belongs to whoever is signed in on it now.
  const { error } = await admin.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint: sub!.endpoint, p256dh, auth, topics, user_agent: (request.headers.get("user-agent") ?? "").slice(0, 200), updated_at: new Date().toISOString() },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: "Notifications aren't set up on the server yet." }, { status: 503 });
  return NextResponse.json({ ok: true, topics });
}
