import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "@/lib/env";
import { NOTES_SETTING_KEY, notesAreFresh, parseNotes } from "@/lib/appUpdate";

export const dynamic = "force-dynamic";

/**
 * GET /api/version → { build, builtAt, notes }
 *
 * Which build of the app is live right now. Every open copy of the app asks this and compares it with the build it
 * was made from; if the live one is newer the "Update available" card appears (components/UpdateCard).
 *
 *  - Public on purpose (signed-out visitors and the sign-in screen need it too) and it returns nothing sensitive:
 *    a build id, a build time, and the admin's optional "what's new" lines. Nothing else is ever read from admin_settings.
 *  - Never cached by the browser, the phone or a CDN, or a phone would keep being told "no update".
 *  - The notes are looked up at most once a minute per server, however many phones ask.
 */
const NOTES_CACHE_MS = 60_000;
let notesCache: { at: number; notes: string[] } | null = null;

async function loadNotes(): Promise<string[]> {
  const now = Date.now();
  if (notesCache && now - notesCache.at < NOTES_CACHE_MS) return notesCache.notes;
  let notes: string[] = [];
  try {
    const { url, serviceRoleKey } = getSupabaseAdminEnv();
    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    const { data } = await admin.from("admin_settings").select("value, updated_at").eq("key", NOTES_SETTING_KEY).maybeSingle();
    if (data && notesAreFresh(data.updated_at as string | null, now)) notes = parseNotes(data.value);
  } catch {
    // The card works without notes; never fail the version check because of them
  }
  notesCache = { at: now, notes };
  return notes;
}

export async function GET() {
  const build = process.env.NEXT_PUBLIC_BUILD_ID ?? "";
  const builtAt = Number(process.env.NEXT_PUBLIC_BUILD_TIME ?? 0);
  return NextResponse.json(
    { build, builtAt, notes: await loadNotes() },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
  );
}
