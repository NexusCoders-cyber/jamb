"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type KPI = { label: string; value: string };
type Activity = { text: string; ts: string };

export default function AdminPage() {
  const { user, loading: authLoading } = useUser();
  const [kpis, setKpis] = useState<KPI[]>([
    { label: "Students", value: "—" },
    { label: "Exam attempts", value: "—" },
    { label: "Questions answered", value: "—" },
    { label: "Average accuracy", value: "—" },
  ]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [serviceStatus, setServiceStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    const supabase = createSupabaseBrowserClient();

    // Check if user is admin
    supabase.from("profiles").select("role").eq("id", user.id).single()
      .then(({ data }) => setIsAdmin(data?.role === "admin"));

    // Fetch live KPI data using service-role via API route
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("exam_attempts").select("id, score, question_count", { count: "exact" }).eq("status", "submitted").limit(1000),
      supabase.from("exam_attempts").select("id, started_at, status").order("started_at", { ascending: false }).limit(5),
    ]).then(([profilesRes, attemptsRes, recentRes]) => {
      const studentCount = profilesRes.count ?? 0;
      const attempts = (attemptsRes.data ?? []) as { score: number; question_count: number }[];
      const attemptCount = attemptsRes.count ?? 0;
      const totalAnswered = attempts.reduce((s, a) => s + a.question_count, 0);
      const totalCorrect = attempts.reduce((s, a) => s + a.score, 0);
      const avgAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

      setKpis([
        { label: "Students", value: studentCount.toLocaleString() },
        { label: "Exam attempts", value: attemptCount.toLocaleString() },
        { label: "Questions answered", value: totalAnswered.toLocaleString() },
        { label: "Average accuracy", value: totalAnswered > 0 ? `${avgAccuracy}%` : "—" },
      ]);

      const recent = (recentRes.data ?? []) as { id: string; started_at: string; status: string }[];
      setActivities(recent.map((a) => ({
        text: `Exam attempt ${a.status} — ${a.id.slice(0, 8)}`,
        ts: new Date(a.started_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }),
      })));
    }).finally(() => setLoading(false));

    // Health check
    fetch("/api/health")
      .then((r) => r.json())
      .then((d: { services?: Record<string, boolean> }) => { if (d.services) setServiceStatus(d.services); })
      .catch(() => undefined);
  }, [user, authLoading]);

  if (!authLoading && !user) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="rounded-[28px] bg-white p-8 text-center ring-1 ring-slate-200">
          <p className="font-bold text-slate-700">Sign in to access the admin portal.</p>
          <Link href="/" className="mt-4 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">Sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between rounded-[26px] bg-slate-950 p-5 text-white shadow-xl">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Admin Portal</p>
            <h1 className="mt-1 text-2xl font-black">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-300">Admin</span>
            )}
            <div className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
              {loading ? "Loading…" : "Live data"}
            </div>
          </div>
        </header>

        {/* KPIs */}
        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpis.map((item) => (
            <div key={item.label} className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className={`mt-2 text-3xl font-black text-slate-900 ${loading ? "animate-pulse text-slate-300" : ""}`}>
                {loading ? "—" : item.value}
              </p>
            </div>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          {/* Recent activity */}
          <section className="rounded-[28px] bg-white p-6 ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900">Recent exam activity</h2>
              <Link href="/analytics" className="text-sm font-semibold text-violet-600">View analytics</Link>
            </div>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="animate-pulse rounded-2xl bg-slate-100 h-10" />)}</div>
            ) : activities.length === 0 ? (
              <p className="text-sm text-slate-400">No exam attempts yet.</p>
            ) : (
              <div className="space-y-3">
                {activities.map((a, i) => (
                  <div key={i} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                    <span className="text-sm text-slate-700">{a.text}</span>
                    <span className="text-xs font-semibold text-slate-500">{a.ts}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* System health */}
          <aside className="space-y-6">
            <div className="rounded-[28px] bg-white p-6 ring-1 ring-slate-200">
              <h3 className="mb-4 text-xl font-black text-slate-900">System health</h3>
              <div className="space-y-3 text-sm">
                {Object.entries({
                  Supabase: serviceStatus.supabase,
                  Paystack: serviceStatus.paystack,
                  Resend: serviceStatus.resend,
                  ALOC: serviceStatus.aloc,
                }).map(([name, ok]) => (
                  <div key={name} className="flex justify-between">
                    <span className="text-slate-600">{name}</span>
                    <strong className={ok ? "text-emerald-600" : "text-rose-500"}>
                      {ok === undefined ? "Checking…" : ok ? "✓ Connected" : "✗ Missing"}
                    </strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] bg-violet-600 p-6 text-white shadow-xl shadow-violet-300/20">
              <p className="text-sm uppercase tracking-[0.22em] text-violet-100">Quick actions</p>
              <div className="mt-4 space-y-2">
                <Link href="/community" className="flex h-10 w-full items-center justify-center rounded-xl bg-white/10 text-sm font-bold hover:bg-white/20">
                  View community
                </Link>
                <Link href="/analytics" className="flex h-10 w-full items-center justify-center rounded-xl bg-white/10 text-sm font-bold hover:bg-white/20">
                  View analytics
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
