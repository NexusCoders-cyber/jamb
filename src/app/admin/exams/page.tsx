"use client";

/**
 * Admin — Exams. Every attempt across the platform with student names,
 * scores, per-question review and deletion of bad data.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Search, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";

type AttemptRow = {
  id: string;
  user_id: string;
  question_count: number;
  status: string;
  score: number;
  started_at: string;
  submitted_at: string | null;
  profiles?: { full_name: string; email: string | null } | null;
};

type AnswerRow = {
  id: string;
  question_id: string;
  selected_option: number | null;
  is_correct: boolean | null;
  question_data: { prompt: string; options: string[]; correct_option: number; explanation: string | null } | null;
};

function correctLetter(ans: AnswerRow): string {
  const idx = ans.question_data?.correct_option;
  return typeof idx === "number" ? String.fromCharCode(65 + idx) : "—";
}

export default function AdminExamsPage() {
  const searchParams = useSearchParams();
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerRow[]>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("exam_attempts")
      .select("id, user_id, question_count, status, score, started_at, submitted_at, profiles(full_name, email)")
      .order("started_at", { ascending: false })
      .limit(100);
    setAttempts(((data ?? []) as unknown) as AttemptRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = attempts.filter((a) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      a.id.toLowerCase().includes(q) ||
      (a.profiles?.full_name ?? "").toLowerCase().includes(q) ||
      (a.profiles?.email ?? "").toLowerCase().includes(q)
    );
  });

  async function toggleExpand(attemptId: string) {
    if (expanded === attemptId) { setExpanded(null); return; }
    setExpanded(attemptId);
    if (answers[attemptId]) return;
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("attempt_answers")
      .select("id, question_id, selected_option, is_correct, question_data")
      .eq("attempt_id", attemptId)
      .order("answered_at", { ascending: true });
    setAnswers((prev) => ({ ...prev, [attemptId]: (data ?? []) as AnswerRow[] }));
  }

  async function deleteAttempt(attempt: AttemptRow) {
    if (!window.confirm(`Delete this attempt by ${attempt.profiles?.full_name ?? "student"}? This also deletes its answers.`)) return;
    setBusyId(attempt.id);
    setNotice(null);
    const supabase = createSupabaseBrowserClient();
    // Delete answers first (RLS allows admin), then the attempt.
    const { error: ansErr } = await supabase.from("attempt_answers").delete().eq("attempt_id", attempt.id);
    if (ansErr) { setNotice(ansErr.message); setBusyId(null); return; }
    const { error } = await supabase.from("exam_attempts").delete().eq("id", attempt.id);
    if (error) {
      setNotice(error.message);
    } else {
      setAttempts((prev) => prev.filter((a) => a.id !== attempt.id));
      setNotice("Attempt deleted.");
    }
    setBusyId(null);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">Oversight</p>
        <h1 className="mt-1 text-2xl font-black text-white">Exam history</h1>
        <p className="mt-1 text-sm text-slate-500">All submitted attempts across the platform, newest first.</p>
      </header>

      {notice && (
        <div className="mb-4 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-400 ring-1 ring-rose-500/30">
          {notice}
        </div>
      )}

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" aria-hidden />
        <input
          type="search"
          placeholder="Search by student name, email or attempt ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-2xl border border-slate-800 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-500"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((n) => <div key={n} className="h-16 animate-pulse rounded-2xl bg-slate-900" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl bg-slate-900 p-8 text-center ring-1 ring-slate-800">
          <p className="font-black text-white">No exam attempts found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const pct = a.question_count > 0 ? Math.round(((a.score ?? 0) / a.question_count) * 100) : 0;
            const isOpen = expanded === a.id;
            return (
              <div key={a.id} className="overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-800">
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-white">{a.profiles?.full_name ?? "Unknown student"}</p>
                    <p className="truncate text-xs text-slate-500">{a.profiles?.email ?? a.user_id}</p>
                    <p className="text-[11px] text-slate-600">
                      {a.status} · started {new Date(a.started_at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {a.submitted_at && ` · submitted ${new Date(a.submitted_at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
                    a.status !== "submitted" ? "bg-slate-800 text-slate-400"
                    : pct >= 50 ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                  }`}>
                    {a.score ?? 0}/{a.question_count} ({pct}%)
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Link
                      href={`/review?attemptId=${a.id}`}
                      className="rounded-full bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-violet-300 ring-1 ring-slate-700 hover:bg-slate-700"
                    >
                      Review
                    </Link>
                    <button
                      type="button"
                      onClick={() => void toggleExpand(a.id)}
                      aria-label="Toggle question breakdown"
                      className="rounded-full bg-slate-800 p-2 text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700"
                    >
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
                    </button>
                    {busyId === a.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden />
                    ) : (
                      <button
                        type="button"
                        onClick={() => void deleteAttempt(a)}
                        aria-label="Delete attempt"
                        className="rounded-full bg-rose-500/10 p-2 text-rose-400 ring-1 ring-rose-500/30 hover:bg-rose-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-800 bg-slate-950/60 p-4">
                    {!answers[a.id] ? (
                      <p className="text-xs text-slate-500">Loading answers…</p>
                    ) : answers[a.id].length === 0 ? (
                      <p className="text-xs text-slate-500">No recorded answers.</p>
                    ) : (
                      <div className="space-y-2">
                        {answers[a.id].map((ans, i) => {
                          const qd = ans.question_data;
                          return (
                            <div key={ans.id} className={`rounded-xl p-3 text-xs ring-1 ${
                              ans.is_correct ? "bg-emerald-500/5 ring-emerald-500/20" : "bg-rose-500/5 ring-rose-500/20"
                            }`}>
                              <p className="font-bold text-slate-300">Q{i + 1} · selected {ans.selected_option === null ? "—" : String.fromCharCode(65 + ans.selected_option)} · correct {correctLetter(ans)}</p>
                              {qd?.prompt && <p className="mt-1 line-clamp-2 text-slate-400">{qd.prompt}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
