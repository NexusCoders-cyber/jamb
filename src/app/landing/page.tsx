import type { Metadata } from "next";
import Link from "next/link";

// ── SEO metadata ──────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "Orbit Prep — Smart JAMB & UTME Preparation App",
  description:
    "Pass JAMB with confidence. Orbit Prep gives you 10,000+ past questions, full mock CBT exams, study mode with instant explanations, live quiz duels and personal analytics — all in one app. Available now on Android and desktop. iOS coming soon.",
  alternates: { canonical: "/landing" },
  openGraph: {
    title: "Orbit Prep — Smart JAMB & UTME Preparation App",
    description:
      "10,000+ UTME past questions, mock CBT, study mode and live quiz duels. The smartest way to prepare for JAMB.",
  },
};

// ── JSON-LD schema ────────────────────────────────────────────────────────────
const schemaOrg = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": "https://orbitprep.app/#app",
      "name": "Orbit Prep",
      "url": "https://orbitprep.app",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Android, Web Browser",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "NGN",
        "description": "Free basic access. Pro subscription from ₦200/week.",
      },
      "description":
        "Smart JAMB/UTME preparation app with 10,000+ past questions, mock CBT exams, study mode, live quiz duels and analytics.",
      "screenshot": "https://orbitprep.app/og-image.png",
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "1200",
      },
    },
    {
      "@type": "Organization",
      "@id": "https://orbitprep.app/#org",
      "name": "Orbit Prep",
      "url": "https://orbitprep.app",
      "logo": "https://orbitprep.app/icons/icon-512.png",
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Is Orbit Prep free?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Community, Arena duels and basic features are free. Pro unlocks unlimited practice, mock exams and analytics from ₦200/week.",
          },
        },
        {
          "@type": "Question",
          "name": "Can I use Orbit Prep offline?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Install the app on Android or desktop and questions you've studied before are available offline via IndexedDB.",
          },
        },
        {
          "@type": "Question",
          "name": "Is there an iOS app?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "iOS is coming soon. For now, add the web app to your iPhone home screen from Safari — it works like a native app.",
          },
        },
      ],
    },
  ],
};

// ── Feature data ──────────────────────────────────────────────────────────────
const features = [
  {
    icon: "✏️",
    title: "Past Questions",
    desc: "10,000+ real UTME questions sorted by subject and year — from 1985 to 2024.",
  },
  {
    icon: "📝",
    title: "Mock CBT Exams",
    desc: "Full 180-question timed simulations that mirror the real JAMB CBT experience.",
  },
  {
    icon: "📖",
    title: "Study Mode",
    desc: "See the correct answer and a detailed explanation immediately after each question.",
  },
  {
    icon: "⚔️",
    title: "Arena Duels",
    desc: "Challenge friends or anyone online to a 10-question quiz battle. 10s per turn.",
  },
  {
    icon: "📊",
    title: "Analytics",
    desc: "Track accuracy per subject, score history and weak areas — know exactly where to focus.",
  },
  {
    icon: "📚",
    title: "Novel Questions",
    desc: "The Lekki Headmaster and other JAMB set texts — 120+ novel-specific past questions.",
  },
];

const stats = [
  { value: "10,000+", label: "Past questions" },
  { value: "17", label: "UTME subjects" },
  { value: "40", label: "Years covered" },
  { value: "10s", label: "Arena turn time" },
];

export default function LandingPage() {
  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
      />

      <main className="min-h-screen bg-[#f5f4ff] text-slate-900">

        {/* ── Nav ──────────────────────────────────────────────────────── */}
        <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-white/60 bg-white/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-sm font-black text-white shadow">O</span>
            <span className="text-base font-black text-slate-900">Orbit Prep</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="hidden text-sm font-semibold text-slate-600 hover:text-violet-700 sm:block">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-violet-600 px-4 py-2 text-sm font-black text-white shadow hover:bg-violet-700"
            >
              Get started free
            </Link>
          </div>
        </nav>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="px-4 pb-16 pt-16 text-center sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-4 py-1.5 text-xs font-bold text-violet-700">
              🎓 Built for JAMB 2025 candidates
            </span>
            <h1 className="mt-2 text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              The smarter way to
              <span className="block text-violet-600">pass JAMB</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              10,000+ past questions, full mock CBT exams, instant explanations,
              live quiz duels and personal analytics — all in one app.
              Free to start. Works offline.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex h-13 items-center gap-2 rounded-2xl bg-violet-600 px-7 py-3.5 text-base font-black text-white shadow-lg shadow-violet-400/30 transition hover:bg-violet-700"
              >
                Start free →
              </Link>
              <Link
                href="/"
                className="inline-flex h-13 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-7 py-3.5 text-base font-semibold text-slate-700 transition hover:border-violet-300"
              >
                Sign in
              </Link>
            </div>
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
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-10 text-center text-3xl font-black text-slate-900">
              Everything you need to pass
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-[24px] bg-white p-6 ring-1 ring-slate-200 shadow-sm transition hover:ring-violet-300"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-2xl">
                    {f.icon}
                  </div>
                  <h3 className="mb-2 text-base font-black text-slate-900">{f.title}</h3>
                  <p className="text-sm leading-6 text-slate-500">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Download section ─────────────────────────────────────────── */}
        <section className="px-4 py-16 sm:px-6 lg:px-8" id="download">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-3 text-center text-3xl font-black text-slate-900">
              Get the app
            </h2>
            <p className="mb-10 text-center text-sm text-slate-500">
              Works in any browser. Install it for an offline-capable, full-screen experience.
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              {/* Android */}
              <div className="rounded-[24px] bg-gradient-to-br from-emerald-600 to-emerald-500 p-6 text-white shadow-lg shadow-emerald-400/20">
                <div className="mb-3 text-3xl">🤖</div>
                <h3 className="text-lg font-black">Android</h3>
                <p className="mt-1 text-xs text-emerald-100">
                  Open in Chrome → tap the menu → "Add to Home Screen"
                </p>
                <a
                  href="/signup"
                  className="mt-4 flex h-10 items-center justify-center rounded-full bg-white text-sm font-black text-emerald-700"
                >
                  Install now →
                </a>
              </div>

              {/* Desktop */}
              <div className="rounded-[24px] bg-gradient-to-br from-violet-600 to-violet-500 p-6 text-white shadow-lg shadow-violet-400/20">
                <div className="mb-3 text-3xl">💻</div>
                <h3 className="text-lg font-black">Desktop</h3>
                <p className="mt-1 text-xs text-violet-100">
                  Chrome / Edge → click the install icon in the address bar
                </p>
                <a
                  href="/signup"
                  className="mt-4 flex h-10 items-center justify-center rounded-full bg-white text-sm font-black text-violet-700"
                >
                  Install now →
                </a>
              </div>

              {/* iOS */}
              <div className="rounded-[24px] bg-slate-100 p-6 ring-1 ring-slate-200">
                <div className="mb-3 text-3xl">🍎</div>
                <h3 className="text-lg font-black text-slate-800">iOS</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Coming soon to the App Store. For now, open in Safari → Share → "Add to Home Screen"
                </p>
                <span className="mt-4 flex h-10 items-center justify-center rounded-full bg-slate-200 text-sm font-black text-slate-500">
                  Coming soon
                </span>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">
              No app store required for Android and desktop. The web app installs directly.
            </p>
          </div>
        </section>

        {/* ── Pro pricing ───────────────────────────────────────────────── */}
        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-black text-slate-900">Simple, honest pricing</h2>
            <p className="mt-3 text-sm text-slate-500">
              Arena duels and community are always free. Pro unlocks everything else.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Weekly", price: "₦200", sub: "7 days", accent: "bg-slate-50 ring-slate-200" },
                { label: "Monthly", price: "₦800", sub: "30 days", accent: "bg-violet-600 text-white ring-violet-500", highlight: true },
                { label: "6-Month", price: "₦1,700", sub: "180 days · best value", accent: "bg-slate-50 ring-slate-200" },
              ].map((p) => (
                <div
                  key={p.label}
                  className={`rounded-[24px] p-6 text-center ring-1 shadow-sm ${p.accent}`}
                >
                  {p.highlight && (
                    <span className="mb-2 inline-block rounded-full bg-white/20 px-3 py-0.5 text-[10px] font-black uppercase tracking-wide">
                      Most popular
                    </span>
                  )}
                  <p className={`text-xs font-bold uppercase tracking-wide ${p.highlight ? "text-violet-200" : "text-slate-400"}`}>
                    {p.label}
                  </p>
                  <p className={`mt-2 text-4xl font-black ${p.highlight ? "text-white" : "text-slate-900"}`}>{p.price}</p>
                  <p className={`mt-1 text-xs ${p.highlight ? "text-violet-200" : "text-slate-400"}`}>{p.sub}</p>
                  <Link
                    href="/signup"
                    className={`mt-5 flex h-10 items-center justify-center rounded-full text-sm font-black transition ${p.highlight ? "bg-white text-violet-700 hover:bg-violet-50" : "bg-violet-600 text-white hover:bg-violet-700"}`}
                  >
                    Get started
                  </Link>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs text-slate-400">
              Bank transfer via Paystack · No auto-renewal · Cancel anytime
            </p>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-8 text-center text-3xl font-black text-slate-900">FAQ</h2>
            <div className="space-y-4">
              {[
                {
                  q: "Is Orbit Prep free?",
                  a: "Community, Arena duels and browsing are free. Pro unlocks unlimited practice, mock exams and full analytics from ₦200/week.",
                },
                {
                  q: "Do I need to install anything?",
                  a: "No. It works in any browser. You can optionally install it on Android or desktop for an offline-capable, app-like experience.",
                },
                {
                  q: "Can I use it without internet?",
                  a: "Yes. Questions you've studied before are cached locally via IndexedDB and available offline. New questions still require a connection.",
                },
                {
                  q: "Is the Lekki Headmaster novel included?",
                  a: "Yes — 124 questions covering the full novel are built into the app. You can practise them solo or duel a friend in the Arena.",
                },
                {
                  q: "Is there an iOS app?",
                  a: "Coming soon to the App Store. For now, open Orbit Prep in Safari on your iPhone, tap Share, and choose 'Add to Home Screen' for a full-screen experience.",
                },
              ].map(({ q, a }) => (
                <details key={q} className="group rounded-2xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
                  <summary className="flex cursor-pointer items-center justify-between text-sm font-black text-slate-900">
                    {q}
                    <span className="ml-3 shrink-0 text-slate-400 transition group-open:rotate-180">▾</span>
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
            <p className="mt-3 text-sm text-violet-200">
              Join thousands of students already preparing smarter with Orbit Prep.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex h-14 items-center rounded-2xl bg-white px-8 text-base font-black text-violet-700 shadow-lg hover:bg-violet-50"
            >
              Start free — no card needed →
            </Link>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="border-t border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-400 sm:px-6">
          <div className="mx-auto max-w-4xl flex flex-wrap items-center justify-center gap-4">
            <Link href="/" className="font-black text-slate-700">Orbit Prep</Link>
            <Link href="/landing#download" className="hover:text-violet-600">Download</Link>
            <Link href="/signup" className="hover:text-violet-600">Sign up</Link>
            <Link href="/" className="hover:text-violet-600">Sign in</Link>
            <Link href="/upgrade" className="hover:text-violet-600">Pricing</Link>
            <Link href="/community" className="hover:text-violet-600">Community</Link>
            <Link href="/arena" className="hover:text-violet-600">Arena</Link>
          </div>
          <p className="mt-4">© {new Date().getFullYear()} Orbit Prep. All rights reserved.</p>
        </footer>
      </main>
    </>
  );
}
