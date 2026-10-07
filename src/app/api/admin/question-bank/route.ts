import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { bankStats } from "@/lib/question-bank";

/** GET /api/admin/question-bank → how many questions the app has saved per subject (admins only). */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (ctx instanceof NextResponse) return ctx;
  const subjects = await bankStats();
  if (!subjects) return NextResponse.json({ ready: false, total: 0, subjects: [] });
  return NextResponse.json({ ready: true, total: subjects.reduce((n, s) => n + s.total, 0), subjects });
}
