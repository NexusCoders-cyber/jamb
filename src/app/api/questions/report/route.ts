import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/quiz-server";
import { bankKey, normSubject } from "@/lib/question-bank";

export const dynamic = "force-dynamic";

const REASONS = ["wrong_answer", "typo", "bad_image", "unclear", "other"] as const;
const DAILY_LIMIT = 30;

/**
 * POST /api/questions/report { subject, questionId, prompt, options[], reason, note? }
 * A signed-in student flags a question. Admins review them at /admin/reports and can hide a bad question.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to report a question." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const subject = typeof body?.subject === "string" ? normSubject(body.subject).slice(0, 80) : "";
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const options = Array.isArray(body?.options) ? (body.options as unknown[]).filter((o): o is string => typeof o === "string").slice(0, 8) : [];
  const reason = typeof body?.reason === "string" && (REASONS as readonly string[]).includes(body.reason) ? body.reason : "";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;
  const questionId = typeof body?.questionId === "string" ? body.questionId.slice(0, 80) : null;
  if (!subject || prompt.length < 4 || options.length < 2 || !reason) {
    return NextResponse.json({ ok: false, error: "Missing details about the question." }, { status: 400 });
  }

  try {
    const admin = getAdminClient();
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count, error: countErr } = await admin
      .from("question_reports").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
    if (countErr) return NextResponse.json({ ok: false, error: "Reporting isn't available yet." }, { status: 503 });
    if ((count ?? 0) >= DAILY_LIMIT) {
      return NextResponse.json({ ok: false, error: "You've sent a lot of reports today. Thank you — please try again tomorrow." }, { status: 429 });
    }

    const { error } = await admin.from("question_reports").upsert(
      {
        bank_key: bankKey(subject, { prompt, options }),
        subject,
        question_id: questionId,
        prompt: prompt.slice(0, 1500),
        options,
        reason,
        note: note || null,
        user_id: user.id,
      },
      { onConflict: "bank_key,user_id", ignoreDuplicates: true },
    );
    if (error) return NextResponse.json({ ok: false, error: "Could not save the report." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not save the report." }, { status: 500 });
  }
}
