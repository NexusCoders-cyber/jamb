"use client";

/**
 * Admin dashboard — live KPIs, recent exam activity and system health.
 * Reads run under admin RLS policies (see supabase/admin_and_blog.sql).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, XCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type KPI = { label: string; value: string };
type AttemptRow = {
  id: string;
  score: number;
  question_count: number;
  status: string;
  started_at: string;
  profiles?: { full_name: string } | null;
};

/** One row of the admin_student_progress() RPC (see supabase/admin_student_progress.sql). */
type StudentProgress = {
  id: string;
  full_name: string;
  email: string | null;
  course: string | null;
  exams: number;
  questions: number;
  accuracy: number;
  jamb_estimate: number;
  target_score: number;
  progress_pct: number;
  on_track: boolean;
  last_exam_at: string | null;
};

type BankInfo = { ready: boolean; total: number; subjects: { subject: string; total: number; withImages: number }[] };

export default function AdminDashboardPage() {
  const [bank, setBank] = useState<BankInfo | null>(null);
  const [kpis, setKpis] = useState<KPI[]>([
    { label: "Students", value: "—" },
    { label: "Pro students", value: "—" },
    { label: "Exam attempts", value: "—" },
    { label: "Questions answered", value: "—" },
    { label: "Average accuracy", value: "—" },
  ]);
  const [recent, setRecent] = useState<AttemptRow[]>([]);
  const [progress, setProgress] = useState<StudentProgress[]>([]);
  const [serviceStatus, setServiceStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Question bank totals (admin API, service role)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      fetch("/api/admin/question-bank", { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (j) setBank(j as BankInfo); })
        .catch(() => undefined);
    });

    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gt("premium_until", new Date().toISOString()),
      supabase
        .from("exam_attempts")
        .select("id, score, question_count", { count: "exact" })
        .eq("status", "submitted")
        .limit(5000),
      supabase
        .from("exam_attempts")
        .select("id, score, question_count, status, started_at, profiles(full_name)")
        .order("started_at", { ascending: false })
        .limit(8),
      // Per-student target tracking (admin RPC). Falls back to a plain
      // join-free client-side computation when the RPC isn't applied yet.
      supabase.rpc("admin_student_progress").then(
        ({ data, error }: { data: StudentProgress[] | null; error: { message: string } | null }) =>
          error ? null : (data ?? []),
      ),
      fetch("/api/health").then((r) => r.json()).catch(() => undefined),
    ])
      .then(async ([profilesRes, proRes, attemptsRes, recentRes, rpcProgress, health]) => {
        const studentCount = profilesRes.count ?? 0;
        const attempts = (attemptsRes.data ?? []) as { score: number; question_count: number }[];
        const attemptCount = attemptsRes.count ?? 0;
        const totalAnswered = attempts.reduce((s, a) => s + (a.question_count ?? 0), 0);
        const totalCorrect = attempts.reduce((s, a) => s + (a.score ?? 0), 0);
        const avgAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

        setKpis([
          { label: "Students", value: studentCount.toLocaleString() },
          { label: "Pro students", value: (proRes.count ?? 0).toLocaleString() },
          { label: "Exam attempts", value: attemptCount.toLocaleString() },
          { label: "Questions answered", value: totalAnswered.toLocaleString() },
          { label: "Average accuracy", value: totalAnswered > 0 ? `${avgAccuracy}%` : "—" },
        ]);
        setRecent(((recentRes.data ?? []) as unknown) as AttemptRow[]);
        if (health?.services) setServiceStatus(health.services);

        if (rpcProgress && rpcProgress.length > 0) {
          setProgress(rpcProgress);
        } else {
          // Fallback: derive per-student progress client-side (admin RLS
          // permits reading all profiles + attempts).
          const [{ data: profs }, { data: atts }] = await Promise.all([
            supabase.from("profiles").select("id, full_name, email, course, target_score").limit(500),
            supabase
              .from("exam_attempts")
              .select("user_id, score, question_count, submitted_at")
              .eq("status", "submitted")
              .limit(5000),
          ]);
          const byUser = new Map<string, { q: number; c: number; exams: number; last: string | null }>();
          const attemptRows = ((atts ?? []) as { user_id: string; score: number; question_count: number; submitted_at: string | null }[]);
          for (const a of attemptRows) {
            const cur = byUser.get(a.user_id) ?? { q: 0, c: 0, exams: 0, last: null as string | null };
            cur.q += a.question_count ?? 0;
            cur.c += a.score ?? 0;
            cur.exams += 1;
            if (a.submitted_at && (!cur.last || a.submitted_at > cur.last)) cur.last = a.submitted_at;
            byUser.set(a.user_id, cur);
          }
          const rows: StudentProgress[] = ((profs ?? []) as Array<{
            id: string; full_name: string; email: string | null; course: string | null; target_score: number;
          }>).map((p) => {
            const s = byUser.get(p.id) ?? { q: 0, c: 0, exams: 0, last: null };
            const jamb = s.q > 0 ? Math.round((s.c / s.q) * 400) : 0;
            return {
              id: p.id,
              full_name: p.full_name,
              email: p.email,
              course: p.course,
              exams: s.exams,
              questions: s.q,
              accuracy: s.q > 0 ? Math.round((s.c / s.q) * 100) : 0,
              jamb_estimate: jamb,
              target_score: p.target_score ?? 300,
              progress_pct: jamb > 0 && p.target_score > 0 ? Math.min(100, Math.round((jamb / p.target_score) * 100)) : 0,
              on_track: jamb >= (p.target_score ?? 300),
              last_exam_at: s.last,
            };
          });
          setProgress(rows);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Target-tracking aggregates (from the student progress rows)
  const active = progress.filter((p) => p.exams > 0);
  const onTrackCount = active.filter((p) => p.on_track).length;
  const closeCount = active.filter((p) => !p.on_track && p.progress_pct >= 65).length;
  const behindCount = active.filter((p) => p.progress_pct < 65).length;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">Overview</p>
        <h1 className="mt-1 text-2xl font-black text-white">Dashboard</h1>
      </header>

      {/* KPIs */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((item) => (
          <div key={item.label} className="rounded-3xl bg-slate-900 p-5 ring-1 ring-slate-800">
            <p className="text-sm text-slate-400">{item.label}</p>
            <p className={`mt-2 text-3xl font-black text-white ${loading ? "animate-pulse text-slate-600" : ""}`}>
              {item.value}
            </p>
          </div>
        ))}
      </section>

      {/* Question bank — every question the ALOC API returned, saved in our own database */}
      <section className="mb-6 rounded-3xl bg-slate-900 p-6 ring-1 ring-slate-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-black text-white">Question bank</h2>
            <p className="text-xs text-slate-500">Questions saved in your database as students use the app (also served if ALOC is down)</p>
          </div>
          {bank?.ready && <span className="rounded-full bg-violet-500/15 px-3 py-1.5 text-xs font-black text-violet-300">{bank.total.toLocaleString()} saved</span>}
        </div>
        {!bank ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !bank.ready ? (
          <p className="rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-300">The question bank isn&apos;t set up yet. Run <code className="font-mono">supabase/question_bank.sql</code> once in the Supabase SQL Editor.</p>
        ) : bank.total === 0 ? (
          <p className="text-sm text-slate-500">Empty so far — it fills automatically the next time a student starts practice.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {bank.subjects.map((s) => (
              <span key={s.subject} className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-bold capitalize text-slate-300">
                {s.subject} <span className="text-slate-500">· {s.total.toLocaleString()}{s.withImages ? ` (${s.withImages} with pictures)` : ""}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Target tracking — connected to student target scores */}
      <section className="mb-6 rounded-3xl bg-slate-900 p-6 ring-1 ring-slate-800">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-black text-white">Target tracking</h2>
            <p className="text-xs text-slate-500">JAMB-scale estimate vs each student&apos;s target score</p>
          </div>
          <div className="flex gap-2 text-[11px] font-bold">
            <span className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-emerald-400">🏆 On track: {onTrackCount}</span>
            <span className="rounded-full bg-amber-500/15 px-3 py-1.5 text-amber-400">Close: {closeCount}</span>
            <span className="rounded-full bg-rose-500/15 px-3 py-1.5 text-rose-400">Behind: {behindCount}</span>
          </div>
        </div>
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded-2xl bg-slate-800" />)}</div>
        ) : active.length === 0 ? (
          <p className="text-sm text-slate-500">No submitted exams yet — tracking starts with the first attempt.</p>
        ) : (
          <div className="space-y-2">
            {active.slice(0, 8).map((p) => (
              <Link key={p.id} href={`/admin/exams?q=${encodeURIComponent(p.email ?? p.full_name)}`}
                className="flex items-center gap-3 rounded-2xl bg-slate-800/50 p-3 transition hover:bg-slate-800">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{p.full_name}</p>
                  <p className="text-[11px] text-slate-500">
                    {p.exams} exam{p.exams === 1 ? "" : "s"} · {p.questions.toLocaleString()} questions · {p.accuracy}% accuracy
                    {p.last_exam_at ? ` · last ${new Date(p.last_exam_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}` : ""}
                  </p>
                </div>
                <div className="w-28 shrink-0 sm:w-40">
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                    <div className={`h-full rounded-full ${p.on_track ? "bg-emerald-400" : p.progress_pct >= 65 ? "bg-amber-400" : "bg-rose-400"}`}
                      style={{ width: `${p.progress_pct}%` }} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-sm font-black ${p.on_track ? "text-emerald-400" : "text-slate-200"}`}>
                    {p.jamb_estimate}<span className="text-[10px] font-bold text-slate-500">/{p.target_score}</span>
                  </p>
                  <p className="text-[10px] text-slate-500">{p.progress_pct}%</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Recent exam activity */}
        <section className="rounded-3xl bg-slate-900 p-6 ring-1 ring-slate-800">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-white">Recent exam activity</h2>
            <Link href="/admin/exams" className="text-sm font-bold text-violet-400 hover:text-violet-300">
              All exams →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded-2xl bg-slate-800" />)}
            </div>
          ) : recent.length === 0 ? (
            <p className="text-sm text-slate-500">No exam attempts yet.</p>
          ) : (
            <div className="space-y-2">
              {recent.map((a) => {
                const pct = a.question_count > 0 ? Math.round(((a.score ?? 0) / a.question_count) * 100) : 0;
                return (
                  <Link
                    key={a.id}
                    href={`/admin/exams?q=${a.id}`}
                    className="flex items-center justify-between rounded-2xl bg-slate-800/50 p-3 transition hover:bg-slate-800"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">
                        {a.profiles?.full_name ?? "Unknown student"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {a.status} · {new Date(a.started_at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
                      pct >= 50 ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                    }`}>
                      {a.score ?? 0}/{a.question_count}
                      <span className="ml-1 font-bold text-slate-400">
                        · {a.question_count > 0 ? Math.round(((a.score ?? 0) / a.question_count) * 400) : 0}/400
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* System health */}
        <aside className="space-y-6">
          <div className="rounded-3xl bg-slate-900 p-6 ring-1 ring-slate-800">
            <h3 className="mb-4 text-lg font-black text-white">System health</h3>
            <div className="space-y-3 text-sm">
              {Object.entries({
                Supabase: serviceStatus.supabase,
                Paystack: serviceStatus.paystack,
                Resend: serviceStatus.resend,
                ALOC: serviceStatus.aloc,
              }).map(([name, ok]) => (
                <div key={name} className="flex justify-between">
                  <span className="text-slate-400">{name}</span>
                  <strong className={ok ? "text-emerald-400" : "text-rose-400"}>
                    {ok === undefined ? "Checking…" : ok ? (
                      <span className="inline-flex items-center gap-1"><Check className="h-4 w-4" aria-hidden /> Connected</span>
                    ) : (
                      <span className="inline-flex items-center gap-1"><XCircle className="h-4 w-4" aria-hidden /> Missing</span>
                    )}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-violet-600/20 p-6 ring-1 ring-violet-500/30">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300">Quick actions</p>
            <div className="mt-4 space-y-2">
              <Link href="/admin/blog" className="flex h-10 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white hover:bg-violet-500">
                Write a blog post
              </Link>
              <Link href="/admin/users" className="flex h-10 items-center justify-center rounded-xl bg-slate-800 text-sm font-bold text-slate-200 hover:bg-slate-700">
                Manage users
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
