import { NextResponse } from "next/server";
import { createResendClient } from "@/lib/services";
import { getResendConfig } from "@/lib/env";
import { getAdminClient } from "@/lib/quiz-server";
import { HttpError, errorResponse } from "@/lib/quiz-server";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 50; // Resend caps recipients per request

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br/>");
}

/**
 * POST /api/admin/send-email — admin-only bulk email.
 * Body: { emails: string[], subject: string, body: string }
 */
export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) throw new HttpError(401, "Missing auth token");

    const supabase = getAdminClient();
    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !userData?.user) throw new HttpError(401, "Invalid auth token");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();
    if (profile?.role !== "admin") throw new HttpError(403, "Admins only");

    const bodyJson = (await req.json().catch(() => ({}))) as {
      emails?: string[];
      subject?: string;
      body?: string;
    };
    const emails = (bodyJson.emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
    const subject = (bodyJson.subject ?? "").trim();
    const text = (bodyJson.body ?? "").trim();
    if (emails.length === 0) throw new HttpError(400, "No recipients");
    if (!subject) throw new HttpError(400, "Subject is required");
    if (!text) throw new HttpError(400, "Message body is required");

    const resend = createResendClient();
    const from = getResendConfig().from;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <p style="font-weight:800;font-size:18px;color:#4c1d95;">Qubit</p>
        <div style="font-size:15px;line-height:1.6;color:#1e293b;"><p>${escapeHtml(text)}</p></div>
        <p style="margin-top:24px;font-size:12px;color:#94a3b8;">Sent by the Qubit team · <a href="https://qubit.ng" style="color:#7c3aed;">open Qubit</a></p>
      </div>`;

    let sent = 0;
    const errors: string[] = [];
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);
      const { error } = await resend.emails.send({ from, to: batch, subject, html });
      if (error) errors.push(error.message);
      else sent += batch.length;
    }

    return NextResponse.json({ sent, failed: emails.length - sent, errors });
  } catch (e) {
    return errorResponse(e);
  }
}
