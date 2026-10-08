import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";

export const dynamic = "force-dynamic";

const STATUSES = ["open", "actioned", "dismissed"];

/**
 * GET  /api/admin/dm-reports?status=open|actioned|dismissed → reports with names, the snapshot and whether the reported person is already barred
 * POST /api/admin/dm-reports { id, status }                  → close / reopen a report
 * POST /api/admin/dm-reports { userId, action: "ban"|"unban", reason? } → stop / allow a person to send direct messages
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (ctx instanceof NextResponse) return ctx;
  const status = request.nextUrl.searchParams.get("status") ?? "open";
  if (!STATUSES.includes(status)) return NextResponse.json({ error: "Bad status" }, { status: 400 });

  const { data, error } = await ctx.admin
    .from("dm_reports")
    .select("id, reporter_id, reported_user_id, message_body, context, reason, note, status, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return NextResponse.json({ ready: false, reports: [] });

  type Row = { id: string; reporter_id: string; reported_user_id: string; message_body: string | null; context: unknown; reason: string; note: string | null; status: string; created_at: string };
  const rows = (data ?? []) as Row[];
  const ids = [...new Set(rows.flatMap((r) => [r.reporter_id, r.reported_user_id]))];
  const [{ data: people }, { data: bans }, { data: counts }] = await Promise.all([
    ids.length ? ctx.admin.from("profiles").select("id, full_name, email").in("id", ids) : Promise.resolve({ data: [] }),
    ids.length ? ctx.admin.from("dm_bans").select("user_id").in("user_id", ids) : Promise.resolve({ data: [] }),
    // how many reports each reported person has in total (repeat offenders stand out)
    ctx.admin.from("dm_reports").select("reported_user_id").in("reported_user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const name = new Map(((people ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [p.id, p]));
  const banned = new Set(((bans ?? []) as { user_id: string }[]).map((b) => b.user_id));
  const total = new Map<string, number>();
  for (const c of (counts ?? []) as { reported_user_id: string }[]) total.set(c.reported_user_id, (total.get(c.reported_user_id) ?? 0) + 1);

  return NextResponse.json({
    ready: true,
    reports: rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      note: r.note,
      status: r.status,
      createdAt: r.created_at,
      messageBody: r.message_body,
      context: Array.isArray(r.context) ? r.context : [],
      reporter: { id: r.reporter_id, name: name.get(r.reporter_id)?.full_name ?? "Student" },
      reported: {
        id: r.reported_user_id,
        name: name.get(r.reported_user_id)?.full_name ?? "Student",
        email: name.get(r.reported_user_id)?.email ?? null,
        banned: banned.has(r.reported_user_id),
        totalReports: total.get(r.reported_user_id) ?? 1,
      },
    })),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (ctx instanceof NextResponse) return ctx;
  const body = (await request.json().catch(() => null)) as { id?: unknown; status?: unknown; userId?: unknown; action?: unknown; reason?: unknown } | null;

  if (typeof body?.id === "string" && typeof body.status === "string") {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Bad status" }, { status: 400 });
    const { error } = await ctx.admin.from("dm_reports").update({ status: body.status }).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (typeof body?.userId === "string" && (body.action === "ban" || body.action === "unban")) {
    if (body.userId === ctx.adminId) return NextResponse.json({ error: "You can't bar yourself." }, { status: 400 });
    const { error } = body.action === "ban"
      ? await ctx.admin.from("dm_bans").upsert({ user_id: body.userId, reason: typeof body.reason === "string" ? body.reason.slice(0, 300) : null, banned_by: ctx.adminId })
      : await ctx.admin.from("dm_bans").delete().eq("user_id", body.userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Nothing to do" }, { status: 400 });
}
