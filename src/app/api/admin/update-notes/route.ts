import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { MAX_NOTES, MAX_NOTE_CHARS, NOTES_SETTING_KEY, notesAreFresh, parseNotes } from "@/lib/appUpdate";

export const dynamic = "force-dynamic";

/**
 * Admin: the "What's new" lines shown on the "Update available" card.
 *   GET  → { notes, updatedAt, showing }   (showing = students would see them right now)
 *   POST { notes } → saves (an empty text clears them)
 * Stored in admin_settings under "update_notes". They stop showing 21 days after they were saved.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (ctx instanceof NextResponse) return ctx;
  const { data, error } = await ctx.admin.from("admin_settings").select("value, updated_at").eq("key", NOTES_SETTING_KEY).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not read the notes." }, { status: 500 });
  const updatedAt = (data?.updated_at as string | null | undefined) ?? null;
  return NextResponse.json({
    notes: typeof data?.value === "string" ? data.value : "",
    updatedAt,
    showing: notesAreFresh(updatedAt, Date.now()) && parseNotes(data?.value).length > 0,
  });
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (ctx instanceof NextResponse) return ctx;
  const body = (await request.json().catch(() => null)) as { notes?: unknown } | null;
  if (typeof body?.notes !== "string") return NextResponse.json({ error: "notes must be text." }, { status: 400 });

  const lines = parseNotes(body.notes);
  if (lines.length === 0) {
    const { error } = await ctx.admin.from("admin_settings").delete().eq("key", NOTES_SETTING_KEY);
    if (error) return NextResponse.json({ error: "Could not clear the notes." }, { status: 500 });
    return NextResponse.json({ ok: true, cleared: true });
  }
  const updatedAt = new Date().toISOString();
  const { error } = await ctx.admin
    .from("admin_settings")
    .upsert({ key: NOTES_SETTING_KEY, value: lines.join("\n"), updated_at: updatedAt }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: "Could not save the notes." }, { status: 500 });
  return NextResponse.json({ ok: true, saved: lines.length, updatedAt, limits: { lines: MAX_NOTES, chars: MAX_NOTE_CHARS } });
}
