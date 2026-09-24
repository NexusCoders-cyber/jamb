"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AuthGate from "@/components/AuthGate";

type View = "login" | "forgot" | "forgot-sent";

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<View>("login");

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

      const safeName =
        data?.user?.user_metadata?.full_name ||
        data?.user?.email?.split("@")[0]?.replace(/[._-]/g, " ") ||
        "Candidate";
      localStorage.setItem("jamb_user", JSON.stringify({ email: data?.user?.email ?? email, fullName: safeName }));
      router.push("/dashboard");
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
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[32px] border border-slate-200 bg-white/85 p-4 shadow-[0_20px_70px_rgba(14,33,33,0.08)] backdrop-blur-sm sm:p-6 lg:p-8">
        <div className="grid min-h-[820px] gap-6 lg:grid-cols-[0.98fr_1.42fr]">

          {/* Left panel */}
          <aside className="gradient-bg relative overflow-hidden rounded-[28px] p-6 text-white sm:p-8">
            <div className="absolute -left-12 top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -right-10 bottom-4 h-40 w-40 rounded-full bg-[#d9b75f]/15 blur-3xl" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <div className="mb-10 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12 text-lg font-black shadow-inner shadow-white/10">O</div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-100/80">ORBIT</p>
                    <h1 className="text-2xl font-bold tracking-tight">Orbit Prep</h1>
                  </div>
                </div>
                <div className="mb-8 rounded-[24px] border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                  <div className="mb-3 flex items-center justify-between text-sm text-emerald-50">
                    <span>Student profile</span>
                    <span className="rounded-full bg-emerald-300/20 px-2 py-1 text-[10px] font-semibold text-emerald-50">Ready</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-200 to-emerald-500 text-xl font-black text-emerald-950">S</div>
                    <div>
                      <h2 className="text-xl font-bold">Student</h2>
                      <p className="text-sm text-emerald-50/85">Your next milestone is waiting</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-[22px] border border-white/10 bg-[#11392c]/40 p-4">
                  <p className="text-sm text-emerald-50/80">Target score</p>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-4xl font-black tracking-tight">—</p>
                      <p className="text-sm text-emerald-50/80">Set after sign up</p>
                    </div>
                    <div className="rounded-full bg-[#d9b75f]/18 px-3 py-1 text-sm font-semibold text-[#f7e8b3]">New goal</div>
                  </div>
                </div>
                <div className="rounded-[22px] bg-[#f4fefe] p-4 text-slate-900">
                  <p className="text-sm font-medium text-slate-500">Daily streak</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-3xl font-black tracking-tight">0 days</span>
                    <span className="text-2xl">🔥</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Right panel */}
          <section className="rounded-[28px] bg-[#f8fafb] p-4 sm:p-6 lg:p-8">

            {/* ── LOGIN VIEW ── */}
            {view === "login" && (
              <>
                <div className="mb-8 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700">Welcome back</p>
                    <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Sign in</h2>
                  </div>
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">Secure login</div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
                  <form onSubmit={handleSubmit} className="space-y-5 rounded-[24px] border border-slate-200 bg-white p-5 soft-shadow sm:p-6">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Email address</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Your password"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white" />
                    </div>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <label className="inline-flex items-center gap-2 text-slate-600">
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-emerald-600" />
                        Remember me
                      </label>
                      <button type="button" onClick={() => { setResetEmail(email); setView("forgot"); setError(""); }}
                        className="font-semibold text-emerald-700 hover:text-emerald-800">
                        Forgot password?
                      </button>
                    </div>
                    {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
                    <div className="space-y-3 pt-2">
                      <button type="submit" disabled={isSubmitting}
                        className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-600 text-base font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-70">
                        {isSubmitting ? "Signing in…" : "Sign in"}
                      </button>
                      <Link href="/signup" className="flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-base font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50">
                        Create account
                      </Link>
                      <button type="button" onClick={() => router.push("/dashboard")}
                        className="flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-base font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50">
                        Continue as guest
                      </button>
                    </div>
                  </form>

                  <div className="space-y-5">
                    <div className="rounded-[24px] bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-5 ring-1 ring-emerald-100">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-emerald-700">Quick stats</span>
                        <span className="text-xs font-medium text-slate-500">Your progress</span>
                      </div>
                      <div className="space-y-4">
                        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                          <p className="text-sm text-slate-500">Study time</p>
                          <p className="mt-1 text-2xl font-black text-slate-900">—</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"><p className="text-sm text-slate-500">Questions</p><p className="mt-1 text-xl font-black text-slate-900">0</p></div>
                          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"><p className="text-sm text-slate-500">Accuracy</p><p className="mt-1 text-xl font-black text-slate-900">—</p></div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[24px] bg-[#10263c] p-5 text-white">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300">Today</p>
                      <h3 className="mt-3 text-2xl font-black tracking-tight">Your next study plan</h3>
                      <p className="mt-2 text-sm text-slate-300">Start your first practice session to unlock a personalised study recommendation.</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── FORGOT PASSWORD VIEW ── */}
            {view === "forgot" && (
              <div className="flex h-full flex-col justify-center">
                <div className="mb-8">
                  <button onClick={() => setView("login")} className="mb-6 flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline">
                    ← Back to sign in
                  </button>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700">Account recovery</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Forgot password?</h2>
                  <p className="mt-2 text-sm text-slate-500">Enter your email and we'll send you a reset link.</p>
                </div>
                <form onSubmit={handleForgotPassword} className="space-y-5 rounded-[24px] border border-slate-200 bg-white p-6 soft-shadow">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Email address</label>
                    <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required placeholder="you@example.com"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white" />
                  </div>
                  {resetError && <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{resetError}</div>}
                  <button type="submit" disabled={resetLoading}
                    className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-600 text-base font-bold text-white disabled:opacity-70">
                    {resetLoading ? "Sending…" : "Send reset link"}
                  </button>
                </form>
              </div>
            )}

            {/* ── FORGOT SENT VIEW ── */}
            {view === "forgot-sent" && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">📬</div>
                <h2 className="text-3xl font-black text-slate-900">Check your inbox</h2>
                <p className="mt-3 max-w-sm text-sm text-slate-500">
                  We sent a password reset link to <strong>{resetEmail}</strong>. Click the link in the email to set a new password.
                </p>
                <p className="mt-2 text-xs text-slate-400">Didn't receive it? Check your spam folder.</p>
                <button onClick={() => setView("login")} className="mt-8 rounded-2xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white">
                  Back to sign in
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
    </AuthGate>
  );
}
