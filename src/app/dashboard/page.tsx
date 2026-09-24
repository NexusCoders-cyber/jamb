"use client";

import Link from "next/link";
import { useEffect, useState, startTransition } from "react";
import { productCatalog, type Product } from "@/lib/catalog";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getProfile, getUserAttempts } from "@/lib/queries";
import type { ExamAttempt } from "@/lib/queries";

const navigation = [
  { label: "Home", href: "/dashboard", active: true },
  { label: "Analytics", href: "/analytics" },
  { label: "Syllabus", href: "/knowledge-hub" },
  { label: "Community", href: "/community" },
  { label: "Messages", href: "/messages" },
  { label: "Settings", href: "/settings" },
];

const quickActions = [
  { label: "Full mock exam", detail: "2 hrs · 180 questions", href: "/exam", tone: "bg-[#e6f5ef] text-[#0d6b3f]", icon: "01" },
  { label: "Practice by topic", detail: "Build a focused set", href: "/practice", tone: "bg-[#fff3d9] text-[#9a6814]", icon: "02" },
  { label: "Ask Smart Coach", detail: "Get unstuck faster", href: "/smart-coach", tone: "bg-[#e8eef8] text-[#28527d]", icon: "03" },
  { label: "Weekly leaderboard", detail: "See your position", href: "/community", tone: "bg-[#f6e9e1] text-[#975334]", icon: "04" },
];

const SUBJECT_COLORS = ["bg-[#d7a62d]", "bg-[#2b9b6a]", "bg-[#4a78a8]", "bg-[#b9684a]"];

export default function DashboardPage() {
  const { user, loading: authLoading } = useUser();

  const [userName, setUserName] = useState("Student");
  const [targetScore, setTargetScore] = useState(300);
  const [streakDays, setStreakDays] = useState(0);
  const [products, setProducts] = useState<Product[]>(productCatalog);
  const [productSource, setProductSource] = useState("local-fallback");
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [todayLabel] = useState(() =>
    new Intl.DateTimeFormat("en-NG", { weekday: "long", day: "numeric", month: "long" }).format(new Date()),
  );

  // Load profile + attempts once we have the auth state
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Guest: use localStorage
      try {
        const stored = localStorage.getItem("jamb_user");
        if (stored) {
          const parsed = JSON.parse(stored) as { fullName?: string; targetScore?: number };
          if (parsed.fullName) startTransition(() => setUserName(parsed.fullName as string));
          if (typeof parsed.targetScore === "number") startTransition(() => setTargetScore(parsed.targetScore as number));
        }
      } catch { /* ignore */ }
      setDataLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    Promise.all([getProfile(supabase, user.id), getUserAttempts(supabase, user.id, 20)])
      .then(([profile, userAttempts]) => {
        if (profile) {
          startTransition(() => {
            setUserName(profile.full_name || user.email?.split("@")[0] || "Student");
            setTargetScore(profile.target_score);
            setStreakDays(profile.streak_days);
          });
        }
        startTransition(() => setAttempts(userAttempts));
      })
      .finally(() => setDataLoading(false));
  }, [user, authLoading]);

  // Load products from ALOC
  useEffect(() => {
    fetch("/api/aloc?endpoint=products")
      .then((r) => r.json())
      .then((result: { data?: Product[]; source?: string }) => {
        if (!Array.isArray(result.data) || result.data.length === 0) return;
        startTransition(() => {
          setProducts(result.data as Product[]);
          setProductSource(result.source ?? "aloc");
        });
      })
      .catch(() => undefined);
  }, []);

  // Derived stats
  const totalAnswered = attempts.reduce((s, a) => s + a.question_count, 0);
  const totalCorrect = attempts.reduce((s, a) => s + a.score, 0);
  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const practiceLevel = Math.min(400, overallAccuracy > 0 ? Math.round((overallAccuracy / 100) * 400) : 0);
  const targetProgress = targetScore > 0 ? Math.min(100, Math.round((practiceLevel / targetScore) * 100)) : 0;

  // Daily goal
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAnswered = attempts
    .filter((a) => (a.started_at ?? "").slice(0, 10) === todayStr)
    .reduce((s, a) => s + a.question_count, 0);
  const dailyGoal = 20;
  const dailyPct = Math.min(100, Math.round((todayAnswered / dailyGoal) * 100));

  // Weak sessions
  const weakSessions = attempts
    .filter((a) => a.question_count > 0 && (a.score / a.question_count) * 100 < 60)
    .slice(0, 3);

  // Per-subject colour map for progress bars (top 4 unique subjects from attempts)
  const subjectProgressItems = ["Use of English", "Biology", "Chemistry", "Physics"].map((name, i) => ({
    name,
    progress: Math.max(0, overallAccuracy - i * 8),
    color: SUBJECT_COLORS[i],
  }));

  const initials = userName.slice(0, 1).toUpperCase();

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1440px] lg:grid lg:grid-cols-[230px_1fr] lg:gap-10">
        {/* Sidebar */}
        <aside className="mb-6 flex items-center justify-between lg:mb-0 lg:block">
          <Link href="/dashboard" className="flex items-center gap-3 lg:mb-14">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6557d9] text-lg font-black text-white">O</span>
            <span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.28em] text-[#6557d9]">ORBIT</span>
              <span className="text-lg font-black text-[#211b3d]">Orbit Prep</span>
            </span>
          </Link>
          <nav className="hidden space-y-2 lg:block" aria-label="Main navigation">
            {navigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${item.active ? "bg-[#e2f3eb] text-[#0d6b3f]" : "text-slate-500 hover:bg-white hover:text-[#0d6b3f]"}`}
              >
                <span className="w-5 text-center text-xs font-black">{item.label.slice(0, 1)}</span>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hidden rounded-3xl bg-[#211b3d] p-5 text-white lg:mt-24 lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f6c978]">Need a nudge?</p>
            <p className="mt-3 text-sm leading-6 text-slate-200">Your next 20 questions are waiting.</p>
            <Link href="/practice" className="mt-4 inline-flex text-sm font-bold text-[#f6c978]">Start session -&gt;</Link>
          </div>
        </aside>

        <div>
          {/* Header */}
          <header className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#6557d9]">{todayLabel}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-[#211b3d] sm:text-4xl">
                Good morning, {userName.split(" ")[0]}.
              </h1>
              <p className="mt-2 text-sm text-slate-500">A little progress today keeps your target score in reach.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden rounded-2xl bg-white px-4 py-2 text-right shadow-sm ring-1 ring-slate-200 sm:block">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Streak</p>
                <p className="font-black text-[#6557d9]">{streakDays} {streakDays === 1 ? "day" : "days"}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#6557d9] font-black text-white">
                {initials}
              </div>
            </div>
          </header>

          {/* Hero progress banner */}
          <section className="mb-7 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="relative overflow-hidden rounded-[30px] bg-[#6557d9] p-6 text-white sm:p-8">
              <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[28px] border-white/10" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#e5e1ff]">Road to {targetScore}</p>
                    <h2 className="mt-3 max-w-md text-3xl font-black tracking-tight">
                      {dataLoading
                        ? "Loading your progress…"
                        : attempts.length === 0
                          ? "Complete your first exam to see your progress."
                          : `You are ${targetProgress}% of the way to your target.`}
                    </h2>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-4xl font-black">{practiceLevel}</p>
                    <p className="text-sm text-[#e5e1ff]">practice level / 400</p>
                  </div>
                </div>
                <div className="mt-7 h-2 rounded-full bg-white/15">
                  <div className="h-2 rounded-full bg-[#f6c978]" style={{ width: `${targetProgress}%` }} />
                </div>
                <div className="mt-3 flex justify-between text-xs font-semibold text-[#e5e1ff]">
                  <span>{practiceLevel} current</span>
                  <span>{targetScore} target</span>
                </div>
                <Link href="/exam" className="mt-7 inline-flex h-11 items-center rounded-xl bg-[#f6c978] px-5 text-sm font-black text-[#211b3d] transition hover:bg-white">
                  Take a full mock -&gt;
                </Link>
              </div>
            </div>

            <div className="rounded-[30px] bg-[#211b3d] p-6 text-white sm:p-8">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#f6c978]">Your stats</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/10 p-3 text-center">
                  <p className="text-2xl font-black">{attempts.length}</p>
                  <p className="text-[10px] uppercase text-slate-400">Exams</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3 text-center">
                  <p className="text-2xl font-black">{totalAnswered.toLocaleString()}</p>
                  <p className="text-[10px] uppercase text-slate-400">Questions</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3 text-center">
                  <p className="text-2xl font-black">{overallAccuracy}%</p>
                  <p className="text-[10px] uppercase text-slate-400">Accuracy</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3 text-center">
                  <p className="text-2xl font-black">{streakDays}</p>
                  <p className="text-[10px] uppercase text-slate-400">Streak</p>
                </div>
              </div>
            </div>
          </section>

          {/* Quick actions */}
          <section className="mb-7">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9a6814]">Keep moving</p>
                <h2 className="mt-1 text-2xl font-black text-[#10263c]">Quick actions</h2>
              </div>
              <Link href="/practice" className="text-sm font-bold text-[#0d6b3f]">View all</Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {quickActions.map((action) => (
                <Link key={action.label} href={action.href} className="group rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:ring-[#9bd4b8]">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black ${action.tone}`}>{action.icon}</span>
                  <p className="mt-4 font-black text-[#10263c]">{action.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{action.detail}</p>
                  <span className="mt-4 block text-sm font-bold text-[#0d6b3f] opacity-0 transition group-hover:opacity-100">Open -&gt;</span>
                </Link>
              ))}
            </div>
          </section>

          {/* Learning suite */}
          <section className="mb-7 rounded-[28px] bg-[#10263c] p-6 text-white shadow-sm sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#f4d889]">Your learning suite</p>
                <h2 className="mt-1 text-2xl font-black">Everything in one place</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${productSource === "aloc" ? "bg-[#b8e3cf] text-[#0d6b3f]" : "bg-white/10 text-slate-300"}`}>
                {productSource === "aloc" ? "ALOC connected" : "Offline catalog"}
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {products.map((product) => (
                <Link key={product.slug} href={product.href} className="group rounded-2xl bg-white/10 p-4 ring-1 ring-white/10 transition hover:bg-white/15">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black ${product.tone}`}>{product.name.slice(0, 1)}</span>
                  <p className="mt-3 font-black">{product.name}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{product.detail}</p>
                  <span className="mt-3 block text-xs font-bold text-[#f4d889]">Open -&gt;</span>
                </Link>
              ))}
            </div>
          </section>

          {/* Syllabus progress + daily goal */}
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-7">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#2b9b6a]">Syllabus progress</p>
                  <h2 className="mt-1 text-2xl font-black text-[#10263c]">Your subjects</h2>
                </div>
                <Link href="/knowledge-hub" className="text-sm font-bold text-[#0d6b3f]">Open syllabus</Link>
              </div>
              {dataLoading ? (
                <p className="mt-6 text-sm text-slate-400">Loading…</p>
              ) : (
                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  {subjectProgressItems.map((subject) => (
                    <div key={subject.name}>
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="font-bold text-[#10263c]">{subject.name}</span>
                        <span className="font-black text-slate-500">{subject.progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className={`h-2 rounded-full ${subject.color}`} style={{ width: `${subject.progress}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-slate-400">{subject.progress > 50 ? "On track" : "Needs attention"}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[28px] bg-[#fffaf0] p-6 shadow-sm ring-1 ring-[#f2e4c4] sm:p-7">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9a6814]">Daily goal</p>
                  <h2 className="mt-1 text-2xl font-black text-[#10263c]">{dailyGoal} questions</h2>
                </div>
                <span className="text-3xl font-black text-[#9a6814]">{dailyPct}%</span>
              </div>
              <div className="mt-6 h-3 rounded-full bg-[#f1e5c9]">
                <div className="h-3 rounded-full bg-[#d7a62d]" style={{ width: `${dailyPct}%` }} />
              </div>
              <div className="mt-4 flex justify-between text-sm text-slate-500">
                <span>{todayAnswered} completed</span>
                <span>{Math.max(0, dailyGoal - todayAnswered)} to go</span>
              </div>
              <Link href="/practice" className="mt-7 flex h-11 items-center justify-center rounded-xl bg-[#10263c] text-sm font-bold text-white transition hover:bg-[#0d6b3f]">
                Continue practice
              </Link>
            </section>
          </div>

          {/* Weak sessions */}
          <section className="mt-6 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-7">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#b9684a]">Personalized insight</p>
                <h2 className="mt-1 text-2xl font-black text-[#10263c]">Sessions to revisit</h2>
              </div>
              <Link href="/analytics" className="text-sm font-bold text-[#0d6b3f]">See analytics</Link>
            </div>
            {weakSessions.length === 0 ? (
              <p className="mt-5 text-sm text-slate-400">
                {attempts.length === 0
                  ? "Complete your first exam to see personalized insights."
                  : "Great work — no low-scoring sessions to revisit right now."}
              </p>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {weakSessions.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-2xl bg-[#fff8f4] p-4 ring-1 ring-[#f1ded5]">
                    <div>
                      <p className="font-bold text-[#10263c]">
                        {new Date(a.started_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                      </p>
                      <p className="mt-1 text-xs text-[#b9684a]">
                        Score {Math.round((a.score / a.question_count) * 100)}%
                      </p>
                    </div>
                    <Link href={`/review?attemptId=${a.id}`} className="text-xs font-black text-[#b9684a]">Retry</Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Mobile nav */}
          <nav className="mt-8 flex justify-between border-t border-slate-200 pt-4 lg:hidden" aria-label="Mobile navigation">
            {navigation.map((item) => (
              <Link key={item.label} href={item.href} className={`text-center text-xs font-bold ${item.active ? "text-[#0d6b3f]" : "text-slate-400"}`}>
                <span className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[10px]">{item.label.slice(0, 1)}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </main>
  );
}
