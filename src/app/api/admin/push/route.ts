import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { pushConfig, sendPush, type PushTopic } from "@/lib/push-server";

export const dynamic = "force-dynamic";

/** Admin: is phone notification set up, and how many phones are signed up per topic? */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (ctx instanceof NextResponse) return ctx;
  const count = async (topic?: string) => {
    let q = ctx.admin.from("push_subscriptions").select("id", { count: "exact", head: true });
    if (topic) q = q.contains("topics", [topic]);
    const { count: n, error } = await q;
    return error ? null : (n ?? 0);
  };
  const [devices, blog, announcements] = await Promise.all([count(), count("blog"), count("announcements")]);
  return NextResponse.json({ configured: !!pushConfig(), tableReady: devices !== null, devices: devices ?? 0, blog: blog ?? 0, announcements: announcements ?? 0 });
}

/** Admin: send a phone notification for an announcement. { title, body, url? } */
export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (ctx instanceof NextResponse) return ctx;
  const b = (await request.json().catch(() => null)) as { title?: unknown; body?: unknown; url?: unknown } | null;
  const title = typeof b?.title === "string" ? b.title.trim() : "";
  const body = typeof b?.body === "string" ? b.body.trim() : "";
  if (title.length < 3 || body.length < 3) return NextResponse.json({ error: "A title and a message are required." }, { status: 400 });
  const topic: PushTopic = "announcements";
  const push = await sendPush(ctx.admin, topic, { title, body, url: typeof b?.url === "string" ? b.url : "/notifications", tag: "announcement" });
  return NextResponse.json({ ok: true, push });
}
