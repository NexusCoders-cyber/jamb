import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { productCatalog } from "@/lib/catalog";
import {
  ALOC_SUBJECTS,
  fetchAlocQuestions,
  fetchAlocQuestionCount,
} from "@/lib/aloc";
import { getAlocApiKey } from "@/lib/env";
import { assembleEnglishPaper } from "@/lib/englishPaper";

// Question sets are topped up over several ALOC calls, which can take longer than a single page
export const maxDuration = 30;

function getApiKey(): string {
  return getAlocApiKey();
}

/** Parse an optional positive integer query value (null when absent / invalid). */
function parseCount(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ─── GET /api/aloc?endpoint=...  ──────────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint") ?? "health";
  const subject = searchParams.get("subject") ?? "";
  const year = searchParams.get("year") ?? undefined;
  const type = searchParams.get("type") ?? "utme";
  const requested = parseCount(searchParams.get("count"));
  const count = requested ?? 40;
  const apiKey = getApiKey();

  // ── Health check — public, no auth needed ─────────────────────────────────
  if (endpoint === "health") {
    return NextResponse.json({ ok: true, provider: "ALOC", timestamp: new Date().toISOString() });
  }

  // ── Subjects list — public, no auth needed ────────────────────────────────
  if (endpoint === "subjects") {
    return NextResponse.json({
      ok: true,
      provider: "ALOC",
      source: "local",
      data: ALOC_SUBJECTS.map((s) => ({ name: s.name, slug: s.slug, count: s.name === "English Language" ? 60 : 40 })),
    });
  }

  // ── Products — public, no auth needed ─────────────────────────────────────
  if (endpoint === "products") {
    return NextResponse.json({
      ok: true,
      provider: "ALOC",
      source: "local-fallback",
      data: productCatalog,
    });
  }

  // ── All question endpoints require an authenticated session ───────────────
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  // ── Questions — bulk (default) ─────────────────────────────────────────────
  if (endpoint === "questions") {
    if (!subject) {
      return NextResponse.json({ ok: false, error: "subject is required" }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "ALOC_API_KEY not configured" }, { status: 503 });
    }

    try {
      // `count` is optional: without it the response is the usual ~40-question page; with it the
      // set is topped up server-side so the client gets a full pool in one round trip.
      const questions = await fetchAlocQuestions(apiKey, subject, { year, type, count: requested ?? undefined });
      if (questions.length === 0) {
        return NextResponse.json({ ok: false, error: "No questions returned for this subject" }, { status: 404 });
      }
      return NextResponse.json({
        ok: true,
        provider: "ALOC",
        source: "aloc",
        data: questions,
        meta: { requested: requested ?? 40, returned: questions.length, short: Math.max(0, (requested ?? 0) - questions.length) },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ALOC request failed";
      return NextResponse.json({ ok: false, provider: "ALOC", error: msg }, { status: 502 });
    }
  }

  // ── English paper — JAMB-style: passages + 5-9 novel questions + lexis + oral ──
  if (endpoint === "english-paper") {
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "ALOC_API_KEY not configured" }, { status: 503 });
    }
    try {
      const paper = await assembleEnglishPaper(apiKey, { year, type });
      if (paper.questions.length === 0) {
        return NextResponse.json({ ok: false, error: "No English questions returned" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, provider: "ALOC", source: "aloc", data: paper.questions, meta: paper.meta });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ALOC request failed";
      return NextResponse.json({ ok: false, provider: "ALOC", error: msg }, { status: 502 });
    }
  }

  // ── Questions — specific count ─────────────────────────────────────────────
  if (endpoint === "questions-count") {
    if (!subject) {
      return NextResponse.json({ ok: false, error: "subject is required" }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "ALOC_API_KEY not configured" }, { status: 503 });
    }

    try {
      const questions = await fetchAlocQuestionCount(apiKey, subject, count, { year, type });
      if (questions.length === 0) {
        return NextResponse.json({ ok: false, error: "No questions returned" }, { status: 404 });
      }
      return NextResponse.json({
        ok: true,
        provider: "ALOC",
        source: "aloc",
        data: questions,
        meta: { requested: count, returned: questions.length, short: Math.max(0, count - questions.length) },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ALOC request failed";
      return NextResponse.json({ ok: false, provider: "ALOC", error: msg }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: false, error: `Unknown endpoint: ${endpoint}` }, { status: 400 });
}

// ─── POST /api/aloc (passthrough for any direct ALOC call) ────────────────────
export async function POST(request: Request) {
  // Require authentication
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const subject = typeof body?.subject === "string" ? body.subject : "";
  const count = typeof body?.count === "number" ? body.count : 40;
  const year = typeof body?.year === "string" ? body.year : undefined;
  const type = typeof body?.type === "string" ? body.type : "utme";
  const apiKey = getApiKey();

  if (!endpoint) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: "ALOC_API_KEY not configured" }, { status: 503 });
  }

  try {
    let questions;
    if (endpoint === "questions-count") {
      questions = await fetchAlocQuestionCount(apiKey, subject, count, { year, type });
    } else {
      questions = await fetchAlocQuestions(apiKey, subject, { year, type });
    }
    return NextResponse.json({ ok: true, provider: "ALOC", data: questions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ALOC request failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
