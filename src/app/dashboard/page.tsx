"use client";

import Link from "next/link";
import { useEffect, useState, startTransition } from "react";
import { Bell, BookOpen, FileText, MessagesSquare, PenLine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { productCatalog, type Product } from "@/lib/catalog";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getProfile, getUserAttempts, getSubjectStats } from "@/lib/queries";
import type { ExamAttempt, SubjectStats } from "@/lib/queries";
import AppShell from "@/components/AppShell";

const quickActions: { label: string; detail: string; href: string; tone: string; icon: LucideIcon }[] = [
  { label: "Full mock exam", detail: "2 hrs · 180 questions", href: "/exam", tone: "bg-[#e6f5ef] text-[#0d6b3f]", icon: FileText },
  { label: "Practice", detail: "Past questions, your pace", href: "/practice", tone: "bg-[#fff3d9] text-[#9a6814]", icon: PenLine },
  { label: "Study mode", detail: "See answers as you go", href: "/practice?mode=study", tone: "bg-[#ede8fb] text-[#4f35c2]", icon: BookOpen },
  { label: "Community", detail: "Discuss with others", href: "/community", tone: "bg-[#f6e9e1] text-[#975334]", icon: MessagesSquare },
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
  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [todayLabel] = useState(() =>
    new Intl.DateTimeFormat("en-NG", { weekday: "long", day: "numeric", month: "long" }).format(new Date()),
  );

  // Load profile + attempts once we have the auth state
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setDataLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    Promise.all([getProfile(supabase, user.id), getUserAttempts(supabase, user.id, 20), getSubjectStats(supabase, user.id)])
      .then(([profile, userAttempts, stats]) => {
        if (profile) {
          startTransition(() => {
            setUserName(profile.full_name || user.email?.split("@")[0] || "Student");
            setTargetScore(profile.target_score);
            setStreakDays(profile.streak_days);
          });
        }
        startTransition(() => {
          setAttempts(userAttempts);
          setSubjectStats(stats);
        });
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

  // Per-subject colour map — derived from real stats, capped at 4 subjects
  const subjectProgressItems = subjectStats.length > 0
    ? subjectStats.slice(0, 4).map((s, i) => ({
        name: s.subjectName,
        progress: s.accuracy,
        color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
      }))
    : (["Use of English", "Biology", "Chemistry", "Physics"] as const).map((name, i) => ({
        name,
        progress: 0,
        color: SUBJECT_COLORS[i],
      }));

  const initials = userName.slice(0, 1).toUpperCase();

  return (
    <AppShell title={`Hi, ${userName.split(" ")[0]}`}>
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-4xl lg:px-6">

        {/* Mobile greeting */}
        <header className="mb-5 flex items-center justify-between lg:hidden">
          <div>
            <p className="text-xs font-semibold text-slate-400">{todayLabel}</p>
            <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-900">
              Hi, {userName.split(" ")[0]}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/notifications" aria-label="Notifications" className="flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
              <Bell className="h-5 w-5 text-slate-600" aria-hidden />
            </Link>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6557d9] font-black text-white text-sm">{initials}</div>
          </div>
        </header>

        {/* Desktop greeting */}
        <header className="mb-6 hidden items-center justify-between lg:flex">
          <div>
            <p className="text-sm font-semibold text-slate-400">{todayLabel}</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
              Good to see you, {userName.split(" ")[0]}.
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white px-4 py-2 text-right shadow-sm ring-1 ring-slate-200">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Streak</p>
              <p className="font-black text-[#6557d9]">{streakDays} {streakDays === 1 ? "day" : "days"}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#6557d9] font-black text-white">{initials}</div>
          </div>
        </header>

        {/* Hero progress card */}
        <section className="mb-5 overflow-hidden rounded-[28px] bg-[#6557d9] p-5 text-white shadow-lg shadow-violet-400/20">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border-[20px] border-white/10 pointer-events-none" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200">Road to {targetScore}</p>
          <h2 className="mt-1.5 text-2xl font-black leading-snug">
            {dataLoading ? "Loading…"
              : attempts.length === 0 ? "Complete your first exam"
              : `${targetProgress}% to your target`}
          </h2>
          <div className="mt-4 h-2 rounded-full bg-white/15">
            <div className="h-2 rounded-full bg-[#f6c978] transition-all" style={{ width: `${targetProgress}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs font-semibold text-violet-200">
            <span>{practiceLevel} current</span>
            <span>{targetScore} target</span>
          </div>
          <div className="mt-4 flex gap-2">
            <Link href="/exam" className="inline-flex h-10 items-center rounded-xl bg-[#f6c978] px-4 text-sm font-black text-[#211b3d]">
              Take mock →
            </Link>
            <Link href="/analytics" className="inline-flex h-10 items-center rounded-xl bg-white/15 px-4 text-sm font-bold text-white">
              Analytics
            </Link>
          </div>
        </section>

        {/* Stats row */}
        <section className="mb-5 grid grid-cols-4 gap-2">
          {[
            { label: "Exams", value: attempts.length },
            { label: "Questions", value: totalAnswered > 999 ? `${(totalAnswered / 1000).toFixed(1)}k` : totalAnswered },
            { label: "Accuracy", value: `${overallAccuracy}%` },
            { label: "Streak", value: `${streakDays}d` },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-white p-3 text-center ring-1 ring-slate-100 shadow-sm">
              <p className="text-lg font-black text-slate-900">{dataLoading ? "…" : s.value}</p>
              <p className="text-[10px] font-semibold uppercase text-slate-400">{s.label}</p>
            </div>
          ))}
        </section>

        {/* Quick actions */}
        <section className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-black text-slate-800">Quick start</h2>
            <Link href="/practice" className="text-xs font-bold text-violet-600">See all</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Link key={action.label} href={action.href}
                className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-100 shadow-sm transition-colors">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${action.tone}`}>
                  <action.icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900">{action.label}</p>
                  <p className="truncate text-[11px] text-slate-400">{action.detail}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Daily goal */}
        <section className="mb-5 rounded-[24px] bg-[#fffaf0] p-4 ring-1 ring-[#f2e4c4]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#9a6814]">Daily goal</p>
              <p className="mt-0.5 text-lg font-black text-slate-900">{dailyPct}% complete</p>
            </div>
            <Link href="/practice"
              className="rounded-xl bg-[#10263c] px-4 py-2 text-xs font-bold text-white">
              {todayAnswered >= dailyGoal ? "Goal reached" : "Continue"}
            </Link>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#f1e5c9]">
            <div className="h-full rounded-full bg-[#d7a62d] transition-all" style={{ width: `${dailyPct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{todayAnswered} / {dailyGoal} questions done today</p>
        </section>

        {/* Subject progress */}
        <section className="mb-5 rounded-[24px] bg-white p-4 ring-1 ring-slate-100 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-black text-slate-800">Subjects</h2>
            <Link href="/knowledge-hub" className="text-xs font-bold text-violet-600">Syllabus</Link>
          </div>
          {dataLoading ? (
            <div className="space-y-3">{[1, 2].map((n) => <div key={n} className="h-8 animate-pulse rounded-xl bg-slate-100" />)}</div>
          ) : (
            <div className="space-y-3">
              {subjectProgressItems.map((s) => (
                <div key={s.name}>
                  <div className="mb-1 flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">{s.name}</span>
                    <span className="text-slate-400">{s.progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sessions to revisit */}
        {weakSessions.length > 0 && (
          <section className="mb-5 rounded-[24px] bg-white p-4 ring-1 ring-slate-100 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-black text-slate-800">Revisit</h2>
              <Link href="/analytics" className="text-xs font-bold text-violet-600">Analytics</Link>
            </div>
            <div className="space-y-2">
              {weakSessions.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl bg-[#fff8f4] px-4 py-3 ring-1 ring-[#f1ded5]">
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {new Date(a.started_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                    </p>
                    <p className="text-xs text-rose-500">Score {Math.round((a.score / a.question_count) * 100)}%</p>
                  </div>
                  <Link href={`/review?attemptId=${a.id}`} className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700">
                    Review
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Learning suite */}
        <section className="mb-2 rounded-[24px] bg-[#10263c] p-4 text-white">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-black">Learning suite</h2>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${productSource === "aloc" ? "bg-emerald-800 text-emerald-200" : "bg-white/10 text-slate-400"}`}>
              {productSource === "aloc" ? "Live" : "Offline"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {products.map((product) => (
              <Link key={product.slug} href={product.href}
                className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10 transition active:bg-white/20">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black ${product.tone}`}>{product.name.slice(0, 1)}</span>
                <p className="mt-2 text-sm font-black">{product.name}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-400">{product.detail}</p>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </AppShell>
  );
}
