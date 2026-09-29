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

export default function AdminDashboardPage() {
  const [kpis, setKpis] = useState<KPI[]>([
    { label: "Students", value: "—" },
    { label: "Exam attempts", value: "—" },
    { label: "Questions answered", value: "—" },
    { label: "Average accuracy", value: "—" },
  ]);
  const [recent, setRecent] = useState<AttemptRow[]>([]);
  const [serviceStatus, setServiceStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
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
      fetch("/api/health").then((r) => r.json()).catch(() => undefined),
    ])
      .then(([profilesRes, attemptsRes, recentRes, health]) => {
        const studentCount = profilesRes.count ?? 0;
        const attempts = (attemptsRes.data ?? []) as { score: number; question_count: number }[];
        const attemptCount = attemptsRes.count ?? 0;
        const totalAnswered = attempts.reduce((s, a) => s + (a.question_count ?? 0), 0);
        const totalCorrect = attempts.reduce((s, a) => s + (a.score ?? 0), 0);
        const avgAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

        setKpis([
          { label: "Students", value: studentCount.toLocaleString() },
          { label: "Exam attempts", value: attemptCount.toLocaleString() },
          { label: "Questions answered", value: totalAnswered.toLocaleString() },
          { label: "Average accuracy", value: totalAnswered > 0 ? `${avgAccuracy}%` : "—" },
        ]);
        setRecent(((recentRes.data ?? []) as unknown) as AttemptRow[]);
        if (health?.services) setServiceStatus(health.services);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">Overview</p>
        <h1 className="mt-1 text-2xl font-black text-white">Dashboard</h1>
      </header>

      {/* KPIs */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <div key={item.label} className="rounded-3xl bg-slate-900 p-5 ring-1 ring-slate-800">
            <p className="text-sm text-slate-400">{item.label}</p>
            <p className={`mt-2 text-3xl font-black text-white ${loading ? "animate-pulse text-slate-600" : ""}`}>
              {item.value}
            </p>
          </div>
        ))}
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
