"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, startTransition } from "react";
import { ArrowRight, Bell, Bookmark, BookOpen, ChevronRight, FileText, Flame, MessagesSquare, Newspaper, PenLine, RotateCcw, Target } from "lucide-react";
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
import { useDailyGoal } from "@/lib/dailyGoal";
import { DAY_MS, lagosDayKey, lastDays } from "@/lib/trends";

/** The three ways to study — big, with a sentence each, because these are what a student opens the app for. */
const studyModes: { label: string; detail: string; href: string; tone: string; icon: LucideIcon }[] = [
  { label: "Full mock exam", detail: "Timed like the real UTME: 4 subjects, 180 questions, 2 hours", href: "/exam", tone: "bg-[#e6f5ef] text-[#0d6b3f]", icon: FileText },
  { label: "Practice", detail: "Past questions by subject and year, at your own pace", href: "/practice", tone: "bg-[#fff3d9] text-[#9a6814]", icon: PenLine },
  { label: "Study mode", detail: "See the answer and explanation after every question", href: "/practice/study", tone: "bg-[#ede8fb] text-[#4f35c2]", icon: BookOpen },
];

/** Everything else, as short labels so nothing is cut off on a small phone. */
const shortcuts: { label: string; href: string; tone: string; icon: LucideIcon }[] = [
  { label: "Saved", href: "/bookmarks", tone: "bg-[#e8f0fb] text-[#2b5c9a]", icon: Bookmark },
  { label: "Mistakes", href: "/mistakes", tone: "bg-[#fde9ec] text-[#b4233b]", icon: Target },
  { label: "Community", href: "/community", tone: "bg-[#f6e9e1] text-[#975334]", icon: MessagesSquare },
  { label: "Blog", href: "/news", tone: "bg-[#e7f3f8] text-[#1f6a8a]", icon: Newspaper },
  { label: "Updates", href: "/notifications", tone: "bg-[#f3ecfb] text-[#6b3fa0]", icon: Bell },
];

const JAMB_MAX = 400;
/** "Today", "Yesterday", "3 days ago", then a plain date — easier to scan than a bare "2 Oct". */
function whenLabel(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.round((Date.parse(lagosDayKey(new Date().getTime())) - Date.parse(lagosDayKey(d))) / DAY_MS);
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


/**
 * The 0–400 UTME scale as a ruler: where the student's practice results put them, and where their target sits.
 * The fill grows in once when the page opens (and stays still for people who prefer reduced motion).
 */
function ScoreRuler({ estimate, target, armed, hasData }: { estimate: number; target: number; armed: boolean; hasData: boolean }) {
  const est = Math.min(Math.max(estimate, 0), JAMB_MAX);
  const tgt = Math.min(Math.max(target, 0), JAMB_MAX);
  const estPct = (est / JAMB_MAX) * 100;
  const tgtPct = (tgt / JAMB_MAX) * 100;
  const flagLeft = tgtPct > 78; // keep the flag's label on screen near the right end
  return (
    <div className="mt-6" role="img" aria-label={hasData ? `Estimated score ${estimate} out of 400. Target ${target}.` : `Target ${target} out of 400. No exams taken yet.`}>
      <div className="relative h-14">
        {/* target flag */}
        <div className="absolute inset-y-0" style={{ left: `${tgtPct}%` }}>
          <span className={`absolute top-0 whitespace-nowrap text-[11px] font-bold leading-none text-[#f6c978] ${flagLeft ? "right-1.5" : "left-1.5"}`}>Target {target}</span>
          <span className="absolute bottom-0 top-0 w-0.5 -translate-x-1/2 rounded-full bg-[#f6c978]" />
        </div>
        {/* track */}
        <div className="absolute inset-x-0 bottom-0 h-4 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#8f84f5] to-[#b9b1ff] transition-[width] duration-[1400ms] ease-out motion-reduce:transition-none"
            style={{ width: armed ? `${estPct}%` : "0%" }}
          />
        </div>
        {/* estimate pin */}
        {hasData && (
          <span
            className="keep-light absolute bottom-[1px] h-[14px] w-[14px] -translate-x-1/2 rounded-full border-[3px] border-[#1d1747] bg-white transition-[left] duration-[1400ms] ease-out motion-reduce:transition-none"
            style={{ left: armed ? `${estPct}%` : "0%" }}
          />
        )}
      </div>
      {/* tick marks every 50 marks, numbers every 100 */}
      <div className="relative mt-1 h-6" aria-hidden>
        {Array.from({ length: 9 }, (_, i) => i * 50).map((v) => (
          <span key={v} className="absolute top-0 -translate-x-1/2" style={{ left: `${(v / JAMB_MAX) * 100}%` }}>
            <span className={`mx-auto block w-px bg-white/40 ${v % 100 === 0 ? "h-2" : "h-1"}`} />
            {v % 100 === 0 && (
              <span className={`mt-0.5 block text-[10px] font-semibold tabular-nums text-violet-200/80 ${v === 0 ? "translate-x-[5px]" : v === JAMB_MAX ? "-translate-x-[7px]" : ""}`}>{v}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Last seven days (Lagos time): filled = at least one session finished that day. */
function WeekDots({ days }: { days: { key: string; label: string; done: boolean; today: boolean }[] }) {
  return (
    <ol className="flex items-end justify-between gap-1" aria-label="Last seven days">
      {days.map((d) => (
        <li key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black ${
              d.done ? "bg-[#6557d9] text-white" : "bg-slate-100 text-transparent"
            } ${d.today ? "ring-2 ring-[#6557d9] ring-offset-2 ring-offset-white" : ""}`}
            aria-label={`${d.label}${d.today ? " (today)" : ""}: ${d.done ? "practised" : "no practice"}`}
          >
            {d.done ? "✓" : "·"}
          </span>
          <span className={`text-[11px] font-semibold ${d.today ? "text-slate-900" : "text-slate-400"}`}>{d.label}</span>
        </li>
      ))}
    </ol>
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
  const dailyGoal = useDailyGoal();
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

  // Daily goal — counted in Lagos time so the day flips at Nigerian midnight
  const todayKey = lagosDayKey(new Date().getTime());
  const todayAnswered = attempts
    .filter((a) => {
      const ts = a.submitted_at ?? a.started_at;
      return !!ts && lagosDayKey(ts) === todayKey;
    })
    .reduce((sum, a) => sum + a.question_count, 0);
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

  // Last seven days, Lagos time, for the week strip
  const attemptDays = new Set(attempts.map((a) => ((a.submitted_at ?? a.started_at) ? lagosDayKey((a.submitted_at ?? a.started_at) as string) : "")));
  const weekDays = lastDays(7).map((d) => ({ key: d.key, label: d.label.slice(0, 1), done: attemptDays.has(d.key), today: d.isToday }));

  // One clear next step: drill the weakest subject; otherwise start, or sit a mock
  const weakest = weakSubjects[0];
  const nextStep = weakest
    ? { label: `Drill ${weakest.subjectName.replace(" Language", "")}`, note: `${weakest.accuracy}% so far`, href: "/practice" }
    : attempts.length === 0
      ? { label: "Start practising", note: "", href: "/practice" }
      : { label: "Take a mock", note: "", href: "/exam" };
  const hasData = attempts.length > 0;
  const marksToGo = status.marksRemaining;

  const firstName = userName.split(" ")[0];
  const initials = userName.slice(0, 1).toUpperCase();
  const goalPips = 20;
  const pipsDone = Math.min(goalPips, Math.round((todayAnswered / dailyGoal) * goalPips));

  // Subjects: colour says whether it is above the pass line, not which subject it is
  const subjectProgressItems = subjectStats.length > 0
    ? subjectStats.slice(0, 4).map((x) => ({ name: x.subjectName, progress: x.accuracy, answered: x.total }))
    : (["Use of English", "Biology", "Chemistry", "Physics"] as const).map((name) => ({ name, progress: 0, answered: 0 }));


  return (
    <AppShell title={`Hi, ${firstName}`}>
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-5xl lg:px-6">

        {/* Phone: the top bar already says hello, so the page starts with the score */}
        <h1 className="sr-only lg:hidden">Hi, {firstName}</h1>

        {/* Desktop greeting */}
        <header className="mb-6 hidden items-center justify-between lg:flex">
          <div>
            <p className="text-sm font-semibold text-slate-400">{todayLabel}</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
              Good to see you, {firstName}.
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/notifications" aria-label="Notifications" className="flex h-11 w-11 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
              <Bell className="h-5 w-5 text-slate-600" aria-hidden />
            </Link>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#6557d9] font-black text-white">{initials}</div>
          </div>
        </header>

        <div className="lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
          <div className="min-w-0">

            {/* Hero carousel: score ruler + promos share the same card frame */}
            <section aria-roledescription="carousel" className="relative mb-5">
              <div className="overflow-hidden rounded-[28px] shadow-lg shadow-violet-400/20">
                <div
                  className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
                  style={{ transform: `translateX(-${slide * 100}%)` }}
                >
                  {/* Slide 0 — where you stand on the 0–400 scale */}
                  <div className="relative w-full shrink-0 overflow-hidden bg-[#1d1747] p-5 text-white">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-violet-200">{hasData ? "Your estimated UTME score" : "Your UTME score"}</p>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold">
                        <Flame className="h-3.5 w-3.5 text-[#f6c978]" aria-hidden />
                        {dataLoading ? "…" : `${streakDays} ${streakDays === 1 ? "day" : "days"}`}
                      </span>
                    </div>
                    <p className="mt-1 flex items-baseline gap-2">
                      <span className={`text-[76px] font-black leading-[0.95] tracking-tighter tabular-nums ${hasData || dataLoading ? "" : "text-white/35"}`}>
                        {dataLoading ? "…" : hasData ? practiceLevel : 0}
                      </span>
                      <span className="text-xl font-bold text-violet-300">/ {JAMB_MAX}</span>
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-5 text-violet-100">
                      {dataLoading
                        ? "Loading your results…"
                        : !hasData
                          ? `Finish one practice or mock to see where you stand against your target of ${targetScore}.`
                          : status.onTrack
                            ? `You are at your target of ${targetScore}. Keep it there.`
                            : `${marksToGo} marks to reach your target of ${targetScore}`}
                    </p>

                    <ScoreRuler estimate={practiceLevel} target={targetScore} armed={!dataLoading} hasData={hasData} />

                    <div className="mt-4 flex gap-2">
                      <Link href={nextStep.href} className="inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-xl bg-[#f6c978] px-3 text-sm font-black text-[#211b3d] active:scale-[0.98]">
                        <span className="truncate">{nextStep.label}{nextStep.note ? <span className="hidden min-[360px]:inline">{` · ${weakest?.accuracy}%`}</span> : null}</span>
                      </Link>
                      <Link
                        href={nextStep.href === "/exam" ? "/analytics" : "/exam"}
                        className="inline-flex h-11 shrink-0 items-center rounded-xl bg-white/15 px-4 text-sm font-bold text-white active:scale-[0.98]"
                      >
                        {nextStep.href === "/exam" ? "Analytics" : "Take mock"}
                      </Link>
                    </div>

                    <ExamCountdown variant="hero" />
                  </div>

                  {/* Slides 1..n — promo banners (same card frame) */}
                  {promos.map((promo) => (
                    <div key={promo.id} className="relative w-full shrink-0 overflow-hidden bg-[#1d1747] text-white">
                      {promo.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={promo.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#211b3d]/90 via-[#211b3d]/55 to-[#211b3d]/20" />
                      <div className="relative flex h-full flex-col justify-end p-5">
                        <p className="text-sm font-bold text-[#f6c978]">Promotion</p>
                        <h2 className="mt-1.5 text-2xl font-black leading-snug">{promo.title}</h2>
                        {promo.body && <p className="mt-1 max-w-md text-sm font-semibold text-violet-100">{promo.body}</p>}
                        {promo.cta_label && promo.cta_href && (
                          promo.cta_href.startsWith("http") ? (
                            <a href={promo.cta_href} target="_blank" rel="noreferrer"
                              className="mt-4 inline-flex h-11 w-fit items-center rounded-xl bg-[#f6c978] px-4 text-sm font-black text-[#211b3d]">
                              {promo.cta_label} →
                            </a>
                          ) : (
                            <Link href={promo.cta_href}
                              className="mt-4 inline-flex h-11 w-fit items-center rounded-xl bg-[#f6c978] px-4 text-sm font-black text-[#211b3d]">
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
                    onClick={() => setSlide((x) => (x - 1 + promos.length + 1) % (promos.length + 1))}
                    className="absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur transition hover:bg-black/40 sm:flex">
                    ‹
                  </button>
                  <button type="button" aria-label="Next slide"
                    onClick={() => setSlide((x) => (x + 1) % (promos.length + 1))}
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

            {/* Today: daily goal, the last seven days, and lifetime totals */}
            <section className="mb-5 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100" aria-labelledby="today-title">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="today-title" className="text-base font-black text-slate-900">Today</h2>
                <p className="text-sm font-semibold text-slate-500">
                  <span className="font-black tabular-nums text-slate-900">{dataLoading ? "…" : todayAnswered}</span>{todayAnswered > dailyGoal ? " questions" : ` of ${dailyGoal} questions`}
                </p>
              </div>
              <div className="mt-3 flex gap-[3px]" role="img" aria-label={`${dailyPct} percent of today's goal`}>
                {Array.from({ length: goalPips }, (_, i) => (
                  <span key={i} className={`h-2.5 flex-1 rounded-[3px] ${i < pipsDone ? "bg-[#d7a62d]" : "bg-slate-100"}`} />
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-500">
                  {todayAnswered >= dailyGoal ? "Daily goal reached" : `${dailyGoal - todayAnswered} more to reach today's goal`}
                </p>
                {todayAnswered < dailyGoal && (
                  <Link href="/practice" className="inline-flex min-h-9 items-center text-xs font-black text-violet-700">Continue</Link>
                )}
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <WeekDots days={weekDays} />
              </div>

              <dl className="mt-4 grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 pt-4 text-center">
                {[
                  { label: "Exams", value: attempts.length },
                  { label: "Questions", value: totalAnswered > 999 ? `${(totalAnswered / 1000).toFixed(1)}k` : totalAnswered },
                  { label: "Accuracy", value: `${overallAccuracy}%` },
                ].map((x) => (
                  <div key={x.label}>
                    <dd className="text-xl font-black tabular-nums text-slate-900">{dataLoading ? "…" : x.value}</dd>
                    <dt className="text-xs font-semibold text-slate-400">{x.label}</dt>
                  </div>
                ))}
              </dl>
            </section>

            {/* Study modes */}
            <section className="mb-3 overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-slate-100" aria-labelledby="study-title">
              <h2 id="study-title" className="px-4 pt-4 text-base font-black text-slate-900">Start studying</h2>
              <ul className="mt-1 divide-y divide-slate-100">
                {studyModes.map((m) => (
                  <li key={m.label}>
                    <Link href={m.href} className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-slate-50">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${m.tone}`}>
                        <m.icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-black leading-5 text-slate-900">{m.label}</span>
                        <span className="mt-0.5 block text-xs leading-[18px] text-slate-500">{m.detail}</span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <nav aria-label="More from Qubit Learn" className="mb-5 grid grid-cols-5 gap-1.5">
              {shortcuts.map((x) => (
                <Link key={x.label} href={x.href} className="relative flex flex-col items-center gap-1.5 rounded-2xl bg-white px-1 py-3 shadow-sm ring-1 ring-slate-100 transition-colors active:bg-slate-50">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${x.tone}`}>
                    <x.icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <span className="text-[11px] font-bold leading-none tracking-tight text-slate-700">{x.label}</span>
                  {x.href === "/news" && newArticles > 0 && (
                    <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" aria-label="New articles" />
                  )}
                </Link>
              ))}
            </nav>
          </div>

          <div className="min-w-0">
            {/* Subject progress */}
            <section className="mb-5 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100" aria-labelledby="subjects-title">
              <div className="flex items-center justify-between">
                <h2 id="subjects-title" className="text-base font-black text-slate-900">Subjects</h2>
                <Link href="/knowledge-hub" className="inline-flex min-h-9 items-center text-xs font-black text-violet-700">Syllabus</Link>
              </div>
              <p className="text-xs text-slate-500">Your accuracy in each subject. The line marks {WEAK_BELOW}%.</p>
              {dataLoading ? (
                <div className="mt-4 space-y-4">{[1, 2, 3].map((n) => <div key={n} className="h-8 animate-pulse rounded-xl bg-slate-100" />)}</div>
              ) : (
                <ul className="mt-4 space-y-4">
                  {subjectProgressItems.map((x) => {
                    const weak = x.answered > 0 && x.progress < WEAK_BELOW;
                    return (
                      <li key={x.name}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-bold text-slate-800">{x.name}</span>
                          <span className={`shrink-0 text-sm font-black tabular-nums ${weak ? "text-rose-600" : x.answered > 0 ? "text-slate-900" : "text-slate-300"}`}>
                            {x.answered > 0 ? `${x.progress}%` : "–"}
                          </span>
                        </div>
                        <div className="relative h-2.5 rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${weak ? "bg-rose-500" : "bg-[#6557d9]"}`} style={{ width: `${x.progress}%` }} />
                          <span className="absolute -top-0.5 bottom-[-2px] w-px bg-slate-400/70" style={{ left: `${WEAK_BELOW}%` }} aria-hidden />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Sessions to revisit */}
            {(weakSessions.length > 0 || weakSubjects.length > 0) && (
              <section className="mb-5 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100" aria-labelledby="revisit-title">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id="revisit-title" className="text-base font-black text-slate-900">Revisit</h2>
                    <p className="text-xs text-slate-500">Sessions under {WEAK_BELOW}%. Fix these first.</p>
                  </div>
                  <Link href="/analytics" className="inline-flex min-h-9 items-center text-xs font-black text-violet-700">Analytics</Link>
                </div>

                {weakSessions.length > 0 && (
                  <ul className="mt-2 divide-y divide-slate-100">
                    {weakSessions.map((a) => {
                      const pct = Math.round((a.score / a.question_count) * 100);
                      const subjects = revisitSubjects.get(a.id);
                      const label = attemptLabel(a, subjects);
                      const weakestInSession = subjects && subjects.length > 1
                        ? [...subjects].filter((x) => x.answered > 0).sort((x, y) => x.correct / x.answered - y.correct / y.answered)[0]
                        : null;
                      return (
                        <li key={a.id} className="flex items-center gap-3 py-3">
                          <MiniRing pct={pct} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-slate-900">{label.title}</p>
                            <p className="text-xs leading-[18px] text-slate-500">
                              {whenLabel(a.submitted_at ?? a.started_at)} · {a.score}/{a.question_count} correct
                              {label.kind === "mock" ? ` · ≈ ${accuracyToJamb(a.score, a.question_count)}/400` : ""}
                            </p>
                            {weakestInSession && (
                              <p className={`text-xs font-bold leading-[18px] ${pct < 40 ? "text-rose-600" : "text-amber-700"}`}>
                                Weakest: {weakestInSession.name.replace(" Language", "")} {Math.round((weakestInSession.correct / weakestInSession.answered) * 100)}%
                              </p>
                            )}
                          </div>
                          <Link
                            href={`/review?attemptId=${a.id}`}
                            className="inline-flex min-h-10 shrink-0 touch-manipulation items-center gap-1 rounded-xl bg-rose-100 px-3 text-xs font-black text-rose-700 active:scale-[0.98]"
                          >
                            Review <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        </li>
                      );
                    })}
                    {moreWeak > 0 && (
                      <li>
                        <Link href="/analytics" className="block py-3 text-center text-xs font-black text-violet-700">
                          + {moreWeak} more session{moreWeak === 1 ? "" : "s"} to revisit
                        </Link>
                      </li>
                    )}
                  </ul>
                )}

                {weakSubjects.length > 0 && (
                  <div className={weakSessions.length > 0 ? "mt-3 border-t border-slate-100 pt-4" : "mt-3"}>
                    <p className="mb-2 text-xs font-bold text-slate-500">Weak subjects. Practise these.</p>
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

            {/* Learning suite — a swipeable strip so it doesn't push everything else off the screen */}
            <section className="mb-2" aria-labelledby="suite-title">
              <div className="mb-2.5 flex items-center justify-between">
                <h2 id="suite-title" className="text-base font-black text-slate-900">Learning suite</h2>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${productSource === "aloc" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                  {productSource === "aloc" ? "Live" : "Offline"}
                </span>
              </div>
              <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden">
                {products.map((product) => (
                  <Link key={product.slug} href={product.href}
                    className="w-44 shrink-0 snap-start rounded-2xl bg-[#10263c] p-3.5 text-white ring-1 ring-white/10 transition active:bg-[#17344f]">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black ${product.tone}`}>{product.name.slice(0, 1)}</span>
                    <p className="mt-2.5 text-sm font-black leading-5">{product.name}</p>
                    <p className="mt-0.5 text-xs leading-[18px] text-slate-400">{product.detail}</p>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
