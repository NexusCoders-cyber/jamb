"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Flame, Inbox, Trophy, Target, ChartLine, Users } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AuthGate from "@/components/AuthGate";

type View = "intro" | "login" | "forgot" | "forgot-sent";

/** Auto-advancing intro slides — shown once per device for ~6 seconds. */
const SLIDES = [
  {
    icon: Target,
    title: "Practise real past questions",
    text: "20,000+ JAMB/UTME questions across 17 subjects — with the exact exam-year feel.",
  },
  {
    icon: ChartLine,
    title: "See where you're weak",
    text: "Per-subject accuracy, score trends and a correction room for every mistake.",
  },
  {
    icon: Flame,
    title: "Build an unbreakable streak",
    text: "Daily challenges and streak tracking keep you studying, even on bad days.",
  },
  {
    icon: Trophy,
    title: "Compete with friends",
    text: "Mock exams, leaderboards and a community of candidates chasing the same score.",
  },
];

const INTRO_MS = 1600; // per slide — 4 slides ≈ 6.4s total

function IntroCarousel({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((v) => Math.min(v + 1, SLIDES.length - 1));
    }, INTRO_MS);
    return () => window.clearInterval(timer);
  }, []);

  // Hand control back to the login view after the last slide — scheduled in
  // an effect (never inside a state updater, which React forbids).
  useEffect(() => {
    if (index >= SLIDES.length - 1 && !doneRef.current) {
      doneRef.current = true;
      const t = window.setTimeout(onDone, INTRO_MS);
      return () => window.clearTimeout(t);
    }
  }, [index, onDone]);

  const slide = SLIDES[index];
  const Icon = slide.icon;

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-[#41348f] via-[#6557d9] to-[#779fe4] px-6 py-10 text-white">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-lg font-black shadow-inner shadow-white/10">O</div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-100/80">ORBIT</p>
          <h1 className="text-xl font-bold tracking-tight">Orbit Prep</h1>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div key={index} className="animate-fade-up">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] bg-white/12 shadow-2xl shadow-black/20 ring-1 ring-white/20 backdrop-blur">
            <Icon className="h-12 w-12 text-amber-300" aria-hidden />
          </div>
          <h2 className="mt-8 text-3xl font-black tracking-tight sm:text-4xl">{slide.title}</h2>
          <p className="mx-auto mt-3 max-w-sm text-base leading-7 text-emerald-50/90">{slide.text}</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 pb-8">
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-white" : "w-2 bg-white/40"}`}
            aria-hidden
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onDone}
        className="mx-auto block rounded-full px-6 py-2 text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        Skip
      </button>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<View>("intro");

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot password state
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Unable to sign in right now.");

      // Redirect to ?next= destination if present, otherwise dashboard
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      router.push(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResetError("");
    if (!resetEmail.trim()) { setResetError("Please enter your email address."); return; }
    setResetLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: sbErr } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (sbErr) throw sbErr;
      setView("forgot-sent");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <AuthGate>
      {view === "intro" && <IntroCarousel onDone={() => setView("login")} />}

      {view !== "intro" && (
        <main className="flex min-h-dvh items-center justify-center bg-[#f5f4ff] px-4 py-8">
          <div className="w-full max-w-sm">
            {/* Logo header */}
            <div className="mb-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-[#41348f] to-[#6557d9] text-2xl font-black text-white shadow-xl shadow-violet-300/40">O</div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900">Orbit Prep</h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">Smart preparation for UTME &amp; JAMB</p>
            </div>

            <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-violet-200/40 ring-1 ring-slate-100">
              {/* ── LOGIN VIEW ── */}
              {view === "login" && (
                <>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-slate-700">Email address</label>
                      <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white" />
                    </div>
                    <div>
                      <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-slate-700">Password</label>
                      <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Your password"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white" />
                    </div>
                    {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
                    <button type="submit" disabled={isSubmitting}
                      className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 text-base font-bold text-white shadow-lg shadow-violet-300/30 transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-70">
                      {isSubmitting ? "Signing in…" : "Sign in"}
                    </button>
                    <button type="button" onClick={() => { setResetEmail(email); setView("forgot"); setError(""); }}
                      className="block w-full text-center text-sm font-semibold text-violet-600 hover:text-violet-800">
                      Forgot password?
                    </button>
                  </form>

                  <div className="my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs font-semibold text-slate-400">New here?</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  <Link href="/signup" className="flex h-12 w-full items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 text-base font-bold text-violet-700 transition hover:bg-violet-100">
                    Create account
                  </Link>
                </>
              )}

              {/* ── FORGOT PASSWORD VIEW ── */}
              {view === "forgot" && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <button type="button" onClick={() => setView("login")} className="text-sm font-semibold text-violet-600 hover:underline">
                    ← Back to sign in
                  </button>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">Reset password</h2>
                  <p className="text-sm text-slate-500">Enter your email and we&apos;ll send you a reset link.</p>
                  <div>
                    <label htmlFor="reset-email" className="mb-1.5 block text-sm font-semibold text-slate-700">Email address</label>
                    <input id="reset-email" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required placeholder="you@example.com"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white" />
                  </div>
                  {resetError && <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{resetError}</div>}
                  <button type="submit" disabled={resetLoading}
                    className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 text-base font-bold text-white disabled:opacity-70">
                    {resetLoading ? "Sending…" : "Send reset link"}
                  </button>
                </form>
              )}

              {/* ── FORGOT SENT VIEW ── */}
              {view === "forgot-sent" && (
                <div className="py-4 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-100">
                    <Inbox className="h-8 w-8 text-violet-700" aria-hidden />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">Check your inbox</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    We sent a password reset link to <strong>{resetEmail}</strong>.
                  </p>
                  <button onClick={() => setView("login")} className="mt-6 w-full rounded-2xl bg-violet-600 py-3 text-sm font-bold text-white">
                    Back to sign in
                  </button>
                </div>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">
              Free forever · No card required
            </p>
          </div>
        </main>
      )}
    </AuthGate>
  );
}
