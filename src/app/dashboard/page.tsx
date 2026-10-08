"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, startTransition } from "react";
import { ArrowRight, Bell, Bookmark, BookOpen, FileText, MessagesSquare, Newspaper, PenLine, RotateCcw, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { productCatalog, type Product } from "@/lib/catalog";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getProfile, getUserAttempts, getSubjectStats, getActivePromos, getAnswerRowsForAttempts } from "@/lib/queries";
import type { ExamAttempt, Promo, SubjectStats } from "@/lib/queries";
import { weightedJambEstimate, targetStatus } from "@/lib/scoring";
import { attemptLabel, attemptSubjects, accuracyToJamb, WEAK_BELOW, MIN_ANSWERED } from "@/lib/analytics";
import type { AttemptSubject } from "@/lib/analytics";
import AppShell from "@/components/AppShell";
import ExamCountdown from "@/components/ExamCountdown";
import { useNewArticles } from "@/lib/useNewArticles";

const quickActions: { label: string; detail: string; href: string; tone: string; icon: LucideIcon }[] = [
  { label: "Full mock exam", detail: "2 hrs · 180 questions", href: "/exam", tone: "bg-[#e6f5ef] text-[#0d6b3f]", icon: FileText },
  { label: "Practice", detail: "Past questions, your pace", href: "/practice", tone: "bg-[#fff3d9] text-[#9a6814]", icon: PenLine },
  { label: "Study mode", detail: "See answers as you go", href: "/practice/study", tone: "bg-[#ede8fb] text-[#4f35c2]", icon: BookOpen },
  { label: "Saved questions", detail: "Your bookmarks, offline", href: "/bookmarks", tone: "bg-[#e8f0fb] text-[#2b5c9a]", icon: Bookmark },
  { label: "Mistakes", detail: "Re-drill what you missed", href: "/mistakes", tone: "bg-[#fde9ec] text-[#b4233b]", icon: Target },
  { label: "Community", detail: "Discuss with others", href: "/community", tone: "bg-[#f6e9e1] text-[#975334]", icon: MessagesSquare },
  { label: "Blog", detail: "Study tips & news", href: "/news", tone: "bg-[#e7f3f8] text-[#1f6a8a]", icon: Newspaper },
  { label: "Notifications", detail: "Updates for you", href: "/notifications", tone: "bg-[#f3ecfb] text-[#6b3fa0]", icon: Bell },
];

const SUBJECT_COLORS = ["bg-[#d7a62d]", "bg-[#2b9b6a]", "bg-[#4a78a8]", "bg-[#b9684a]"];

/** "Today", "Yesterday", "3 days ago", then a plain date — easier to scan than a bare "2 Oct". */
function whenLabel(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const lagos = (x: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(x);
  const days = Math.round((new Date(lagos(new Date())).getTime() - new Date(lagos(d)).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

/** Small score ring used by the Revisit rows. */
function MiniRing({ pct }: { pct: number }) {
  const R = 16;
  const C = 2 * Math.PI * R;
  const tone = pct >= 50 ? "stroke-amber-500 text-amber-700" : "stroke-rose-500 text-rose-700";
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center" role="img" aria-label={`Score ${pct} percent`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="20" cy="20" r={R} fill="none" strokeWidth="4" stroke="currentColor" className="text-slate-400/30" />
        <circle
          cx="20" cy="20" r={R} fill="none" strokeWidth="4" strokeLinecap="round"
          className={tone.split(" ")[0]}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - Math.min(Math.max(pct, 0), 100) / 100)}
        />
      </svg>
      <span className={`text-[11px] font-black tabular-nums ${tone.split(" ")[1]}`}>{pct}</span>
    </span>
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useUser();
  const newArticles = useNewArticles();

  const [userName, setUserName] = useState("Student");
  const [targetScore, setTargetScore] = useState(300);
  const [streakDays, setStreakDays] = useState(0);
  const [products, setProducts] = useState<Product[]>(productCatalog);
  const [productSource, setProductSource] = useState("local-fallback");
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [revisitSubjects, setRevisitSubjects] = useState<Map<string, AttemptSubject[]>>(new Map());
  const [promos, setPromos] = useState<Promo[]>([]);
  const [slide, setSlide] = useState(0); // 0 = target card, 1..n = promos

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

  // Load active promos for the hero carousel (target card slides into them)
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let alive = true;
    getActivePromos(supabase)
      .then((rows) => { if (alive) setPromos(rows); })
      .catch(() => undefined); // table may not exist yet — hero still shows
    return () => { alive = false; };
  }, []);

  // Auto-advance the hero carousel while promos exist
  useEffect(() => {
    const total = 1 + promos.length;
    if (total <= 1) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % total), 6000);
    return () => clearInterval(t);
  }, [promos.length]);

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

  // Derived stats — computed by the shared scoring engine (src/lib/scoring.ts)
  // so dashboard, analytics, results and admin all agree.
  const totalAnswered = attempts.reduce((s, a) => s + a.question_count, 0);
  const totalCorrect = attempts.reduce((s, a) => s + a.score, 0);
  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  // Question-weighted JAMB estimate: long mocks count more than short drills.
  const practiceLevel = weightedJambEstimate(attempts);
  const status = targetStatus(practiceLevel, targetScore);
  const targetProgress = status.progressPct;

  // Daily goal — counted in Lagos time so the day flips at Nigerian midnight
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const todayAnswered = attempts
    .filter((a) => {
      const ts = a.submitted_at ?? a.started_at;
      if (!ts) return false;
      const d = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date(ts));
      return d === todayStr;
    })
    .reduce((s, a) => s + a.question_count, 0);
  const dailyGoal = 20;
  const dailyPct = Math.min(100, Math.round((todayAnswered / dailyGoal) * 100));

  // Weak sessions
  const weakSessions = attempts
    .filter((a) => a.question_count > 0 && (a.score / a.question_count) * 100 < 60)
    .slice(0, 3);
  const weakIdsKey = weakSessions.map((a) => a.id).join(",");
  const moreWeak = attempts.filter((a) => a.question_count > 0 && (a.score / a.question_count) * 100 < 60).length - weakSessions.length;

  // Subjects the student keeps getting wrong (enough answers to be meaningful) — shown as practise chips
  const weakSubjects = useMemo(
    () => subjectStats.filter((x) => x.total >= MIN_ANSWERED && x.accuracy < WEAK_BELOW).sort((a, b) => a.accuracy - b.accuracy).slice(0, 4),
    [subjectStats],
  );

  // Which subjects each weak session covered (small query: only those few attempts)
  useEffect(() => {
    if (!weakIdsKey) return;
    let alive = true;
    const supabase = createSupabaseBrowserClient();
    getAnswerRowsForAttempts(supabase, weakIdsKey.split(","))
      .then((rows) => { if (alive) startTransition(() => setRevisitSubjects(attemptSubjects(rows))); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [weakIdsKey]);

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
              <p className="font-black text-[#6557d9]">
                {streakDays <= 0 ? "0 days" : `${streakDays} ${streakDays === 1 ? "day" : "days"}`}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#6557d9] font-black text-white">{initials}</div>
          </div>
        </header>

        {/* Hero carousel: target card + promos share the same card frame */}
        <section aria-roledescription="carousel" className="relative mb-5">
          <div className="overflow-hidden rounded-[28px] shadow-lg shadow-violet-400/20">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${slide * 100}%)` }}
            >
              {/* Slide 0 — target score card (original style preserved) */}
              <div className="relative w-full shrink-0 overflow-hidden bg-[#6557d9] p-5 text-white">
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border-[20px] border-white/10 pointer-events-none" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200">Road to {targetScore}</p>
                <h2 className="mt-1.5 text-2xl font-black leading-snug">
                  {dataLoading ? "Loading…" : status.headline}
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
              </div>

              {/* Slides 1..n — promo banners (same card frame) */}
              {promos.map((promo) => (
                <div key={promo.id} className="relative w-full shrink-0 overflow-hidden bg-[#6557d9] text-white">
                  {promo.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={promo.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#211b3d]/90 via-[#211b3d]/55 to-[#211b3d]/20" />
                  <div className="relative p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f6c978]">Promotion</p>
                    <h2 className="mt-1.5 text-2xl font-black leading-snug">{promo.title}</h2>
                    {promo.body && <p className="mt-1 max-w-md text-sm font-semibold text-violet-100">{promo.body}</p>}
                    {promo.cta_label && promo.cta_href && (
                      promo.cta_href.startsWith("http") ? (
                        <a href={promo.cta_href} target="_blank" rel="noreferrer"
                          className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#f6c978] px-4 text-sm font-black text-[#211b3d]">
                          {promo.cta_label} →
                        </a>
                      ) : (
                        <Link href={promo.cta_href}
                          className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#f6c978] px-4 text-sm font-black text-[#211b3d]">
                          {promo.cta_label} →
                        </Link>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Slide dots + manual controls — only when promos exist */}
          {promos.length > 0 && (
            <>
              <button type="button" aria-label="Previous slide"
                onClick={() => setSlide((s) => (s - 1 + promos.length + 1) % (promos.length + 1))}
                className="absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur transition hover:bg-black/40 sm:flex">
                ‹
              </button>
              <button type="button" aria-label="Next slide"
                onClick={() => setSlide((s) => (s + 1) % (promos.length + 1))}
                className="absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur transition hover:bg-black/40 sm:flex">
                ›
              </button>
              <div className="mt-2.5 flex justify-center gap-1.5">
                {[0, ...promos.map((_, i) => i + 1)].map((i) => (
                  <button key={i} type="button" aria-label={`Go to slide ${i + 1}`} onClick={() => setSlide(i)}
                    className={`h-1.5 rounded-full transition-all ${slide === i ? "w-5 bg-[#6557d9]" : "w-1.5 bg-slate-300 hover:bg-slate-400"}`} />
                ))}
              </div>
            </>
          )}
        </section>

        {/* Stats row */}
        <ExamCountdown />

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
                  <p className="truncate text-sm font-black text-slate-900">
                    {action.label}
                    {action.href === "/news" && newArticles > 0 && (
                      <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 align-middle text-[9px] font-black text-white">NEW</span>
                    )}
                  </p>
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
        {(weakSessions.length > 0 || weakSubjects.length > 0) && (
          <section className="mb-5 rounded-[24px] bg-white p-4 ring-1 ring-slate-100 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-800">Revisit</h2>
                <p className="text-[11px] font-semibold text-slate-400">Sessions under {WEAK_BELOW}% — fix these first</p>
              </div>
              <Link href="/analytics" className="text-xs font-bold text-violet-600">Analytics</Link>
            </div>

            {weakSessions.length > 0 && (
              <div className="space-y-2">
                {weakSessions.map((a) => {
                  const pct = Math.round((a.score / a.question_count) * 100);
                  const subjects = revisitSubjects.get(a.id);
                  const label = attemptLabel(a, subjects);
                  const weakest = subjects && subjects.length > 1
                    ? [...subjects].filter((x) => x.answered > 0).sort((x, y) => x.correct / x.answered - y.correct / y.answered)[0]
                    : null;
                  return (
                    <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-[#fff8f4] p-3 ring-1 ring-[#f1ded5]">
                      <MiniRing pct={pct} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-800">{label.title}</p>
                        <p className="text-xs font-semibold text-slate-500">
                          {whenLabel(a.submitted_at ?? a.started_at)} · {a.score}/{a.question_count} correct
                          {label.kind === "mock" ? ` · ≈ ${accuracyToJamb(a.score, a.question_count)}/400` : ""}
                        </p>
                        <p className={`text-xs font-bold ${pct < 40 ? "text-rose-600" : "text-amber-700"}`}>
                          Score {pct}%
                          {weakest && (
                            <span className="font-semibold text-slate-500">
                              {" "}· weakest: {weakest.name.replace(" Language", "")} {Math.round((weakest.correct / weakest.answered) * 100)}%
                            </span>
                          )}
                        </p>
                      </div>
                      <Link
                        href={`/review?attemptId=${a.id}`}
                        className="inline-flex min-h-10 shrink-0 touch-manipulation items-center gap-1 rounded-xl bg-rose-100 px-3 text-xs font-black text-rose-700 active:scale-[0.98]"
                      >
                        Review <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </div>
                  );
                })}
                {moreWeak > 0 && (
                  <Link href="/analytics" className="block rounded-xl py-1.5 text-center text-xs font-bold text-violet-600">
                    + {moreWeak} more session{moreWeak === 1 ? "" : "s"} to revisit
                  </Link>
                )}
              </div>
            )}

            {weakSubjects.length > 0 && (
              <div className={weakSessions.length > 0 ? "mt-4" : ""}>
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Weak subjects — practise these</p>
                <div className="flex flex-wrap gap-2">
                  {weakSubjects.map((x) => (
                    <Link
                      key={x.subjectName}
                      href="/practice"
                      className="inline-flex min-h-10 touch-manipulation items-center gap-1.5 rounded-full bg-slate-100 px-3.5 text-xs font-bold text-slate-700 active:scale-[0.98]"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-violet-600" aria-hidden />
                      {x.subjectName.replace(" Language", "")}
                      <span className={x.accuracy < 40 ? "text-rose-600" : "text-amber-700"}>{x.accuracy}%</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
        {!dataLoading && attempts.length > 0 && weakSessions.length === 0 && weakSubjects.length === 0 && (
          <section className="mb-5 rounded-[24px] bg-emerald-50 p-4 ring-1 ring-emerald-100">
            <p className="text-sm font-black text-emerald-800">Nothing to revisit 🎉</p>
            <p className="mt-0.5 text-xs font-semibold text-emerald-700">Your recent sessions are all above {WEAK_BELOW}%. Keep the streak going.</p>
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
