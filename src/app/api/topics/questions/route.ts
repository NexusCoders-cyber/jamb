/**
 * GET /api/topics/questions?subject=biology&topic=Cell%20Structure&count=20
 *
 * Topic practice/study for the Learn → Topics section. ALOC has no topic
 * filter (verified live), so this fetches a large pool for the subject and
 * filters it against the curated syllabus keywords in src/lib/topics.ts.
 * Requires an authenticated session.
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchAlocMany, nameToSlug, slugToName } from "@/lib/aloc";
import { getAlocApiKey } from "@/lib/env";
import { TOPICS_BY_SLUG, questionMatchesTopic } from "@/lib/topics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const subject = searchParams.get("subject") ?? "";
  const topicName = searchParams.get("topic") ?? "";
  const count = Math.min(Math.max(Number(searchParams.get("count") ?? 20), 1), 60);
  if (!subject || !topicName) {
    return NextResponse.json({ ok: false, error: "subject and topic are required" }, { status: 400 });
  }

  const apiKey = getAlocApiKey();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "Question bank is not configured" }, { status: 503 });
  }

  const slug = nameToSlug(subject);
  const topics = TOPICS_BY_SLUG[slug];
  if (!topics || topics.length === 0) {
    return NextResponse.json({ ok: false, error: `No topics available for ${slugToName(slug)}` }, { status: 404 });
  }
  const topic = topics.find((t) => t.name.toLowerCase() === topicName.trim().toLowerCase());
  if (!topic) {
    return NextResponse.json({ ok: false, error: `Unknown topic "${topicName}" for ${slugToName(slug)}` }, { status: 404 });
  }

  // Pull a big pool (two rounds when needed) and keep topic matches
  const seen = new Set<string>();
  const questions: NonNullable<Awaited<ReturnType<typeof fetchAlocMany>>> = [];
  try {
    for (const limit of [120, 120] as const) {
      const batch = await fetchAlocMany(apiKey, slug, limit, { type: "utme" });
      for (const qn of batch) {
        const id = String(qn.id);
        if (!seen.has(id)) {
          seen.add(id);
          questions.push(qn);
        }
      }
      const matchedSoFar = questions.filter((qn) => questionMatchesTopic(qn, topic.keywords));
      if (matchedSoFar.length >= count) break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "the question bank didn't respond";
    return NextResponse.json(
      { ok: false, error: `Could not load questions — ${msg}. Try again in a moment.` },
      { status: 502 },
    );
  }

  const matched = questions.filter((qn) => questionMatchesTopic(qn, topic.keywords));
  // Shuffle so repeat sessions feel fresh
  for (let i = matched.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [matched[i], matched[j]] = [matched[j], matched[i]];
  }
  const data = matched.slice(0, count);

  if (data.length === 0) {
    return NextResponse.json(
      { ok: false, error: `No questions found for "${topic.name}" right now — try another topic.` },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, provider: "ALOC+syllabus", topic: topic.name, data, total: matched.length });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  return GET(new Request(url, { headers: request.headers }));
}
