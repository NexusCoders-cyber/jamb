import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { productCatalog } from "@/lib/catalog";
import {
  ALOC_SUBJECTS,
  fetchAlocQuestions,
  fetchAlocQuestionCount,
} from "@/lib/aloc";
import { getAlocApiKey } from "@/lib/env";

function getApiKey(): string {
  return getAlocApiKey();
}

// ─── GET /api/aloc?endpoint=...  ──────────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint") ?? "health";
  const subject = searchParams.get("subject") ?? "";
  const year = searchParams.get("year") ?? undefined;
  const type = searchParams.get("type") ?? "utme";
  const count = Number(searchParams.get("count") ?? 40);
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
      const questions = await fetchAlocQuestions(apiKey, subject, { year, type });
      if (questions.length === 0) {
        return NextResponse.json({ ok: false, error: "No questions returned for this subject" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, provider: "ALOC", source: "aloc", data: questions });
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
      return NextResponse.json({ ok: true, provider: "ALOC", source: "aloc", data: questions });
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
