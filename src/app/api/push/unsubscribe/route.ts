import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/quiz-server";

export const dynamic = "force-dynamic";

/** POST { endpoint } → this phone stops receiving notifications. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string" || !body.endpoint) return NextResponse.json({ error: "Missing endpoint." }, { status: 400 });
  // Works even if the session has expired: anyone holding the endpoint URL can only remove that one phone.
  const q = getAdminClient().from("push_subscriptions").delete().eq("endpoint", body.endpoint);
  const { error } = await (user ? q.eq("user_id", user.id) : q);
  if (error) return NextResponse.json({ error: "Could not turn notifications off." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
