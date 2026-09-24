"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSubjectStats } from "@/lib/queries";
import type { SubjectStats } from "@/lib/queries";

type Recommendation = {
  title: string;
  detail: string;
  status: "Priority" | "Improve" | "Review" | "Strong";
};

function statusFor(accuracy: number): Recommendation["status"] {
  if (accuracy < 50) return "Priority";
  if (accuracy < 65) return "Improve";
  if (accuracy < 80) return "Review";
  return "Strong";
}

const STATUS_BADGE: Record<string, string> = {
  Priority: "bg-rose-100 text-rose-700",
  Improve: "bg-amber-100 text-amber-700",
  Review: "bg-violet-100 text-violet-700",
  Strong: "bg-emerald-100 text-emerald-700",
};

export default function SmartCoachPage() {
  const { user, loading: authLoading } = useUser();

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    const supabase = createSupabaseBrowserClient();
    getSubjectStats(supabase, user.id)
      .then((stats: SubjectStats[]) => {
        // Sort weakest first
        const sorted = [...stats].sort((a, b) => a.accuracy - b.accuracy);
        const recs: Recommendation[] = sorted.map((s) => ({
          title: s.subjectName,
          detail: `${s.total} questions answered · Accuracy ${s.accuracy}%`,
          status: statusFor(s.accuracy),
        }));
        setRecommendations(recs);
      })
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  // The top priority recommendation
  const topRec = recommendations.find((r) => r.status === "Priority" || r.status === "Improve") ?? recommendations[0];

  // Action plan: weak → focus, medium → depth, any → speed
  const actionPlan = topRec
    ? [
        { label: `15 ${topRec.title} questions`, tag: "Focus" },
        { label: "10 calculation-style questions", tag: "Depth" },
        { label: "12-minute speed drill", tag: "Speed" },
      ]
    : [];

  return (
    <main className="min-h-screen bg-[#eef2ff] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500">Smart Coach</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Personalized recommendations</h1>
          </div>
          <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Dashboard
          </Link>
        </div>

        {!user && !authLoading ? (
          <div className="rounded-[28px] bg-white p-8 text-center ring-1 ring-slate-200">
            <p className="font-bold text-slate-700">Sign in to get personalized recommendations</p>
            <Link href="/" className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">Sign in</Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-6">
              {/* Today's focus */}
              <div className="rounded-[28px] bg-white p-6 ring-1 ring-slate-200">
                <h2 className="mb-5 text-2xl font-black text-slate-900">Today&apos;s focus</h2>

                {loading ? (
                  <p className="text-sm text-slate-400">Analysing your results…</p>
                ) : recommendations.length === 0 ? (
                  <p className="text-sm text-slate-400">Complete your first exam to get personalised coaching.</p>
                ) : (
                  <div className="space-y-4">
                    {recommendations.slice(0, 5).map((item) => (
                      <div key={item.title} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                        <div>
                          <p className="text-lg font-bold text-slate-900">{item.title}</p>
                          <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[item.status]}`}>
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recommendation banner */}
              {topRec && (
                <div className="rounded-[28px] bg-gradient-to-r from-violet-600 to-violet-500 p-6 text-white shadow-xl shadow-violet-300/20">
                  <p className="text-sm uppercase tracking-[0.22em] text-violet-100">Recommendation</p>
                  <h3 className="mt-3 text-3xl font-black">You should practice {topRec.title} today.</h3>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-violet-50">{topRec.detail}</p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href={`/practice?subject=${encodeURIComponent(topRec.title)}&count=15`}
                      className="rounded-full bg-white px-5 py-3 text-sm font-bold text-violet-700"
                    >
                      Start 15-question drill
                    </Link>
                    <Link href="/mistakes" className="rounded-full border border-white/30 px-5 py-3 text-sm font-bold text-white">
                      Review mistakes
                    </Link>
                  </div>
                </div>
              )}
            </section>

            <aside className="space-y-6">
              {/* Why section */}
              <div className="rounded-[28px] bg-white p-6 ring-1 ring-slate-200">
                <h3 className="mb-4 text-xl font-black text-slate-900">Why this recommendation?</h3>
                {topRec ? (
                  <ul className="space-y-3 text-sm text-slate-600">
                    <li>• Your accuracy in {topRec.title} needs improvement.</li>
                    <li>• You have answered fewer correct questions in this subject than others.</li>
                    <li>• Focusing here will have the biggest impact on your overall score.</li>
                    <li>• Consistent short drills improve retention more than longer occasional sessions.</li>
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">Complete more exams to unlock insights.</p>
                )}
              </div>

              {/* Action plan */}
              {actionPlan.length > 0 && (
                <div className="rounded-[28px] bg-slate-900 p-6 text-white">
                  <p className="text-sm uppercase tracking-[0.22em] text-slate-300">Action plan</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-200">
                    {actionPlan.map((step) => (
                      <div key={step.tag} className="flex justify-between rounded-2xl bg-white/5 p-3">
                        <span>{step.label}</span>
                        <strong>{step.tag}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
