import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { forgetHiddenCache } from "@/lib/question-bank";

/**
 * GET  /api/admin/reports?status=open|hidden|dismissed → reports grouped per question (most-reported first)
 * POST /api/admin/reports { bankKey, status }          → sets the status of every report for that question
 *      "hidden" stops the question being served to students; "dismissed" closes the report; "open" reopens it.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (ctx instanceof NextResponse) return ctx;
  const status = request.nextUrl.searchParams.get("status") ?? "open";
  if (!["open", "hidden", "dismissed"].includes(status)) return NextResponse.json({ error: "Bad status" }, { status: 400 });

  const { data, error } = await ctx.admin
    .from("question_reports")
    .select("id, bank_key, subject, question_id, prompt, options, reason, note, status, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ ready: false, groups: [] });

  type Row = { id: string; bank_key: string; subject: string; prompt: string; options: string[] | null; reason: string; note: string | null; status: string; created_at: string };
  const groups = new Map<string, { bankKey: string; subject: string; prompt: string; options: string[]; status: string; latest: string; reasons: Record<string, number>; notes: string[]; count: number }>();
  for (const r of (data ?? []) as Row[]) {
    const g = groups.get(r.bank_key) ?? { bankKey: r.bank_key, subject: r.subject, prompt: r.prompt, options: r.options ?? [], status: r.status, latest: r.created_at, reasons: {}, notes: [], count: 0 };
    g.count += 1;
    g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1;
    if (r.note && g.notes.length < 3) g.notes.push(r.note);
    groups.set(r.bank_key, g);
  }
  const list = [...groups.values()].sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest));
  return NextResponse.json({ ready: true, groups: list });
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (ctx instanceof NextResponse) return ctx;
  const body = (await request.json().catch(() => null)) as { bankKey?: unknown; status?: unknown } | null;
  const bankKey = typeof body?.bankKey === "string" ? body.bankKey : "";
  const status = typeof body?.status === "string" ? body.status : "";
  if (!bankKey || !["open", "hidden", "dismissed"].includes(status)) return NextResponse.json({ error: "bankKey and a valid status are required" }, { status: 400 });
  const { error } = await ctx.admin.from("question_reports").update({ status }).eq("bank_key", bankKey);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  forgetHiddenCache();
  return NextResponse.json({ ok: true });
}
