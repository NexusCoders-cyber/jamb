import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BarChart3, BookOpen, Brain, Check, ChevronDown, ClipboardCheck, Flame, Library,
  Menu, Monitor, Smartphone, Swords, Target, Timer, Trophy, WifiOff, Users, CalendarCheck, Moon,
} from "lucide-react";
import Logo from "@/components/Logo";

const BRAND = "Qubit";

// ── SEO metadata ──────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: `${BRAND} — Smart JAMB & UTME Preparation App`,
  description:
    `Pass JAMB with confidence. ${BRAND} gives you 10,000+ past questions, full mock CBT exams, study mode with instant explanations, live quiz duels and personal analytics — all in one app. Available now on Android and desktop. iOS coming soon.`,
  alternates: { canonical: "/landing" },
  openGraph: {
    title: `${BRAND} — Smart JAMB & UTME Preparation App`,
    description: "10,000+ UTME past questions, mock CBT, study mode and live quiz duels. The smartest way to prepare for JAMB.",
  },
};

// ── Content ───────────────────────────────────────────────────────────────────
const faqs = [
  { q: `Is ${BRAND} free?`, a: "Community, Arena duels and browsing are free. Pro unlocks unlimited practice, mock exams and full analytics from ₦200/week." },
  { q: "Do I need to install anything?", a: "No. It works in any browser. You can optionally install it on Android or desktop for an offline-capable, app-like experience." },
  { q: "Can I use it without internet?", a: "Yes. Questions you've studied before are cached locally via IndexedDB and available offline. New questions still require a connection." },
  { q: "Is the Lekki Headmaster novel included?", a: "Yes — 124 questions covering the full novel are built into the app. You can practise them solo or duel a friend in the Arena." },
  { q: "Is there an iOS app?", a: `Coming soon to the App Store. For now, open ${BRAND} in Safari on your iPhone, tap Share, and choose 'Add to Home Screen' for a full-screen experience.` },
  { q: "Which subjects can I practise?", a: "All 17 UTME subjects — English, Mathematics, Physics, Chemistry, Biology, Government, Economics, Literature, Commerce, Accounting, Geography, CRK, IRK and more." },
  { q: "How does the mock exam work?", a: "Pick your four subjects and sit a timed CBT simulation with a question map, flagging and instant results. Afterwards, review every correction subject by subject." },
  { q: `Is ${BRAND} affiliated with JAMB?`, a: `No. ${BRAND} is an independent practice platform built to help candidates prepare for the UTME.` },
];

const schemaOrg = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": "https://orbitprep.app/#app",
      "name": BRAND,
      "url": "https://orbitprep.app",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Android, Web Browser",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "NGN", "description": "Free basic access. Pro subscription from ₦200/week." },
      "description": "Smart JAMB/UTME preparation app with 10,000+ past questions, mock CBT exams, study mode, live quiz duels and analytics.",
      "screenshot": "https://orbitprep.app/og-image.png",
      "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "ratingCount": "1200" },
    },
    { "@type": "Organization", "@id": "https://orbitprep.app/#org", "name": BRAND, "url": "https://orbitprep.app", "logo": "https://orbitprep.app/icons/icon-512.png" },
    {
      "@type": "FAQPage",
      "mainEntity": faqs.map(({ q, a }) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
    },
  ],
};

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#download", label: "Download" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const features = [
  { icon: Target, title: "Past Questions", desc: "10,000+ real UTME questions sorted by subject and year — from 1985 to 2024." },
  { icon: ClipboardCheck, title: "Mock CBT Exams", desc: "Full 180-question timed simulations that mirror the real JAMB CBT experience." },
  { icon: BookOpen, title: "Study Mode", desc: "See the correct answer and a detailed explanation immediately after each question." },
  { icon: Swords, title: "Arena Duels", desc: "Challenge friends or anyone online to a 10-question quiz battle. 10s per turn." },
  { icon: BarChart3, title: "Analytics", desc: "Track accuracy per subject, score history and weak areas — know exactly where to focus." },
  { icon: Library, title: "Novel Questions", desc: "The Lekki Headmaster and other JAMB set texts — 120+ novel-specific past questions." },
];

const extras = [
  { icon: Brain, label: "Smart Coach explanations" },
  { icon: CalendarCheck, label: "Personal study plan" },
  { icon: Flame, label: "Daily challenge & streaks" },
  { icon: Trophy, label: "Leaderboards & achievements" },
  { icon: Users, label: "Student community" },
  { icon: WifiOff, label: "Works offline" },
  { icon: Timer, label: "Speed training" },
  { icon: Moon, label: "Light & dark mode" },
];

const stats = [
  { value: "10,000+", label: "Past questions" },
  { value: "17", label: "UTME subjects" },
  { value: "40", label: "Years covered" },
  { value: "10s", label: "Arena turn time" },
];

const subjects = [
  "English Language", "Mathematics", "Physics", "Chemistry", "Biology", "Government", "Economics", "Geography", "Commerce",
  "Accounting", "Literature in English", "CRK", "IRK", "Civic Education", "Insurance", "History", "Current Affairs",
];

const steps = [
  { n: "1", title: "Create your free account", desc: "Sign up in under a minute — no card needed." },
  { n: "2", title: "Choose subjects & a mode", desc: "Practise by topic, study with explanations, or sit a full timed mock." },
  { n: "3", title: "Review, improve, repeat", desc: "Check corrections per subject, watch your analytics climb and keep your streak alive." },
];

const plans = [
  { label: "Weekly", price: "₦200", sub: "7 days", accent: "bg-slate-50 ring-slate-200" },
  { label: "Monthly", price: "₦800", sub: "30 days", accent: "bg-violet-600 text-white ring-violet-500", highlight: true },
  { label: "6-Month", price: "₦1,700", sub: "180 days · best value", accent: "bg-slate-50 ring-slate-200" },
];

const proPerks = [
  "Unlimited practice & past questions",
  "Full 180-question mock CBT exams",
  "Study mode with explanations",
  "Full analytics & weak-subject tracking",
  "Mistake bank & personalised review",
];

const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-7 py-3.5 text-base font-black text-white shadow-lg shadow-violet-400/30 transition hover:bg-violet-700";

// ── Phone mock (pure CSS — mirrors the in-app CBT screen) ────────────────────
function PhoneMock() {
  const opts = ["Nitrogen", "Neon", "Chlorine", "Oxygen"];
  return (
    <div className="relative mx-auto w-[272px]" aria-hidden>
      <div className="absolute -left-10 top-16 z-10 hidden items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-800 shadow-xl ring-1 ring-slate-100 sm:flex">
        <Flame className="h-4 w-4 text-amber-500" /> 7-day streak
      </div>
      <div className="absolute -right-8 bottom-24 z-10 hidden items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-800 shadow-xl ring-1 ring-slate-100 sm:flex">
        <Trophy className="h-4 w-4 text-violet-600" /> Score 312/400
      </div>
      <div className="rounded-[40px] bg-slate-900 p-2.5 shadow-2xl shadow-violet-500/30">
        <div className="overflow-hidden rounded-[32px] bg-white">
          <div className="bg-gradient-to-br from-[#41348f] to-[#6557d9] px-4 pb-4 pt-5 text-white">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-violet-200">
              <span>Mock exam · Chemistry</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-white">01:42:18</span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-white/20"><div className="h-full w-[30%] rounded-full bg-amber-300" /></div>
          </div>
          <div className="space-y-2.5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Question 12 of 40</p>
            <p className="text-sm font-bold leading-5 text-slate-900">Which of the following is a noble gas?</p>
            {opts.map((o, i) => (
              <div key={o} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-semibold ${i === 1 ? "border-violet-500 bg-violet-50 text-violet-800" : "border-slate-200 text-slate-700"}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${i === 1 ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500"}`}>{"ABCD"[i]}</span>
                {o}
              </div>
            ))}
            <div className="grid grid-cols-8 gap-1 pt-1">
              {Array.from({ length: 16 }, (_, i) => (
                <span key={i} className={`flex h-5 items-center justify-center rounded text-[8px] font-bold ${i < 11 ? "bg-violet-600 text-white" : i === 11 ? "ring-2 ring-violet-500 text-violet-700" : "bg-slate-100 text-slate-400"}`}>{i + 1}</span>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <span className="flex-1 rounded-xl bg-slate-100 py-2 text-center text-xs font-black text-slate-500">Previous</span>
              <span className="flex-1 rounded-xl bg-violet-600 py-2 text-center text-xs font-black text-white">Next</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }} />

      <main className="min-h-screen bg-[#f5f4ff] text-slate-900">

        {/* ── Nav ──────────────────────────────────────────────────────── */}
        <nav className="sticky top-0 z-50 border-b border-white/60 bg-white/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2.5">
              <Logo size={36} />
              <span className="text-base font-black text-slate-900">{BRAND}</span>
            </Link>
            <div className="hidden items-center gap-6 md:flex">
              {navLinks.map((l) => (
                <a key={l.href} href={l.href} className="text-sm font-semibold text-slate-600 hover:text-violet-700">{l.label}</a>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Link href="/" className="hidden text-sm font-semibold text-slate-600 hover:text-violet-700 sm:block">Sign in</Link>
              <Link href="/signup" className="rounded-full bg-violet-600 px-4 py-2 text-sm font-black text-white shadow hover:bg-violet-700">Get started free</Link>
              <details className="group relative md:hidden">
                <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl text-slate-700 hover:bg-violet-50" aria-label="Menu">
                  <Menu className="h-5 w-5" />
                </summary>
                <div className="absolute right-0 top-11 w-48 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-slate-200">
                  {navLinks.map((l) => (
                    <a key={l.href} href={l.href} className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-violet-50">{l.label}</a>
                  ))}
                  <Link href="/" className="block rounded-xl px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50">Sign in</Link>
                </div>
              </details>
            </div>
          </div>
        </nav>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:px-6 lg:px-8 lg:pb-24 lg:pt-20">
          <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-violet-300/40 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-sky-300/40 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
            <div className="text-center lg:text-left">
              <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-4 py-1.5 text-xs font-bold text-violet-700">
                🎓 Built for JAMB UTME candidates
              </span>
              <h1 className="mt-2 text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                The smarter way to
                <span className="block text-violet-600">pass JAMB</span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg lg:mx-0">
                10,000+ past questions, full mock CBT exams, instant explanations,
                live quiz duels and personal analytics — all in one app.
                Free to start. Works offline.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Link href="/signup" className={btnPrimary}>Start free <ArrowRight className="h-4 w-4" /></Link>
                <Link href="/" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-7 py-3.5 text-base font-semibold text-slate-700 transition hover:border-violet-300">Sign in</Link>
              </div>
              <ul className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500 lg:justify-start">
                {["No card required", "17 UTME subjects", "Real CBT feel"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" />{t}</li>
                ))}
              </ul>
            </div>
            <PhoneMock />
          </div>
        </section>

        {/* ── Stats ────────────────────────────────────────────────────── */}
        <section className="border-y border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-black text-violet-600">{s.value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────────── */}
        <section id="features" className="scroll-mt-16 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-black text-slate-900">Everything you need to pass</h2>
            <p className="mx-auto mb-10 mt-3 max-w-xl text-center text-sm text-slate-500">One app for practice, mock exams, revision and healthy competition.</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-violet-300">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><f.icon className="h-6 w-6" /></div>
                  <h3 className="mb-2 text-base font-black text-slate-900">{f.title}</h3>
                  <p className="text-sm leading-6 text-slate-500">{f.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {extras.map((e) => (
                <span key={e.label} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">
                  <e.icon className="h-4 w-4 text-violet-600" />{e.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Subjects ─────────────────────────────────────────────────── */}
        <section className="border-y border-slate-200 bg-white px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-2xl font-black text-slate-900 sm:text-3xl">All 17 UTME subjects, covered</h2>
            <div className="mt-7 flex flex-wrap justify-center gap-2.5">
              {subjects.map((s) => (
                <span key={s} className="rounded-full bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700 ring-1 ring-violet-100">{s}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section id="how" className="scroll-mt-16 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-10 text-center text-3xl font-black text-slate-900">Start in three steps</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {steps.map((s) => (
                <div key={s.n} className="rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-base font-black text-white">{s.n}</span>
                  <h3 className="mt-4 text-base font-black text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Download section ─────────────────────────────────────────── */}
        <section className="scroll-mt-16 px-4 pb-16 sm:px-6 lg:px-8" id="download">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-3 text-center text-3xl font-black text-slate-900">Get the app</h2>
            <p className="mb-10 text-center text-sm text-slate-500">Works in any browser. Install it for an offline-capable, full-screen experience.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[24px] bg-gradient-to-br from-emerald-600 to-emerald-500 p-6 text-white shadow-lg shadow-emerald-400/20">
                <Smartphone className="mb-3 h-8 w-8" />
                <h3 className="text-lg font-black">Android</h3>
                <p className="mt-1 text-xs text-emerald-100">Open in Chrome → tap the menu → &quot;Add to Home Screen&quot;</p>
                <a href="/signup" className="mt-4 flex h-10 items-center justify-center rounded-full bg-white text-sm font-black text-emerald-700">Install now →</a>
              </div>
              <div className="rounded-[24px] bg-gradient-to-br from-violet-600 to-violet-500 p-6 text-white shadow-lg shadow-violet-400/20">
                <Monitor className="mb-3 h-8 w-8" />
                <h3 className="text-lg font-black">Desktop</h3>
                <p className="mt-1 text-xs text-violet-100">Chrome / Edge → click the install icon in the address bar</p>
                <a href="/signup" className="mt-4 flex h-10 items-center justify-center rounded-full bg-white text-sm font-black text-violet-700">Install now →</a>
              </div>
              <div className="rounded-[24px] bg-slate-100 p-6 ring-1 ring-slate-200">
                <div className="mb-3 text-3xl">🍎</div>
                <h3 className="text-lg font-black text-slate-800">iOS</h3>
                <p className="mt-1 text-xs text-slate-500">Coming soon to the App Store. For now, open in Safari → Share → &quot;Add to Home Screen&quot;</p>
                <span className="mt-4 flex h-10 items-center justify-center rounded-full bg-slate-200 text-sm font-black text-slate-500">Coming soon</span>
              </div>
            </div>
            <p className="mt-6 text-center text-xs text-slate-400">No app store required for Android and desktop. The web app installs directly.</p>
          </div>
        </section>

        {/* ── Pro pricing ───────────────────────────────────────────────── */}
        <section id="pricing" className="scroll-mt-16 bg-white px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-black text-slate-900">Simple, honest pricing</h2>
            <p className="mt-3 text-sm text-slate-500">Arena duels and community are always free. Pro unlocks everything else.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {plans.map((p) => (
                <div key={p.label} className={`rounded-[24px] p-6 text-center shadow-sm ring-1 ${p.accent}`}>
                  {p.highlight && (
                    <span className="mb-2 inline-block rounded-full bg-white/20 px-3 py-0.5 text-[10px] font-black uppercase tracking-wide">Most popular</span>
                  )}
                  <p className={`text-xs font-bold uppercase tracking-wide ${p.highlight ? "text-violet-200" : "text-slate-400"}`}>{p.label}</p>
                  <p className={`mt-2 text-4xl font-black ${p.highlight ? "text-white" : "text-slate-900"}`}>{p.price}</p>
                  <p className={`mt-1 text-xs ${p.highlight ? "text-violet-200" : "text-slate-400"}`}>{p.sub}</p>
                  <Link href="/signup" className={`mt-5 flex h-10 items-center justify-center rounded-full text-sm font-black transition ${p.highlight ? "bg-white text-violet-700 hover:bg-violet-50" : "bg-violet-600 text-white hover:bg-violet-700"}`}>Get started</Link>
                </div>
              ))}
            </div>
            <ul className="mx-auto mt-8 grid max-w-xl gap-2.5 text-left sm:grid-cols-2">
              {proPerks.map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm font-semibold text-slate-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{t}</li>
              ))}
            </ul>
            <p className="mt-6 text-xs text-slate-400">Bank transfer via Paystack · No auto-renewal · Cancel anytime</p>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-16 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-8 text-center text-3xl font-black text-slate-900">FAQ</h2>
            <div className="space-y-4">
              {faqs.map(({ q, a }) => (
                <details key={q} className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-black text-slate-900">
                    {q}
                    <ChevronDown className="ml-3 h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-500">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <section className="bg-gradient-to-br from-[#41348f] to-[#6557d9] px-4 py-16 text-center text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-xl">
            <h2 className="text-3xl font-black">Ready to pass JAMB?</h2>
            <p className="mt-3 text-sm text-violet-200">Join thousands of students already preparing smarter with {BRAND}.</p>
            <Link href="/signup" className="mt-6 inline-flex h-14 items-center rounded-2xl bg-white px-8 text-base font-black text-violet-700 shadow-lg hover:bg-violet-50">
              Start free — no card needed →
            </Link>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="border-t border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-400 sm:px-6">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-4">
            <Link href="/" className="font-black text-slate-700">{BRAND}</Link>
            <Link href="/landing#download" className="hover:text-violet-600">Download</Link>
            <Link href="/signup" className="hover:text-violet-600">Sign up</Link>
            <Link href="/" className="hover:text-violet-600">Sign in</Link>
            <Link href="/upgrade" className="hover:text-violet-600">Pricing</Link>
            <Link href="/community" className="hover:text-violet-600">Community</Link>
            <Link href="/arena" className="hover:text-violet-600">Arena</Link>
            <Link href="/blog" className="hover:text-violet-600">Blog</Link>
            <Link href="/novels" className="hover:text-violet-600">Novels</Link>
          </div>
          <p className="mt-4">© {new Date().getFullYear()} {BRAND}. All rights reserved. Independent practice platform, not affiliated with JAMB.</p>
        </footer>
      </main>
    </>
  );
}