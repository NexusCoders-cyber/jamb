"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ALOC_SUBJECTS } from "@/lib/aloc";
import AuthGate from "@/components/AuthGate";

// English is always required; the rest are optional
const OPTIONAL_SUBJECTS = ALOC_SUBJECTS.filter((s) => s.slug !== "english").map((s) => s.name);

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [course, setCourse] = useState("");
  const [targetScore, setTargetScore] = useState("300");
  const [subjects, setSubjects] = useState<string[]>(["English Language"]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmNotice, setShowConfirmNotice] = useState(false);

  function toggleSubject(name: string) {
    setSubjects((cur) => {
      if (name === "English Language") return cur; // always required
      return cur.includes(name)
        ? cur.filter((s) => s !== name)
        : cur.length < 4
          ? [...cur, name]
          : cur;
    });
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!fullName.trim()) { setError("Please enter your full name."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (subjects.length !== 4) {
      setError("Choose exactly three subjects in addition to English Language.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Unable to create your account right now.");

      localStorage.setItem(
        "jamb_user",
        JSON.stringify({
          email: data?.user?.email ?? email,
          fullName: fullName.trim(),
          course: course.trim(),
          targetScore: Number(targetScore),
          subjects,
        }),
      );

      // If Supabase email confirmation is enabled, the session will be null.
      // In that case show a success message instead of redirecting.
      if (!data?.session) {
        setError(""); // clear any error
        // Re-use error state to show success (green styling handled below)
        setIsSubmitting(false);
        // Show confirmation notice instead of redirecting
        setShowConfirmNotice(true);
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = subjects.length - 1; // excluding English

  return (
    <AuthGate>
    <main className="min-h-screen bg-[#eef6f1] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[32px] border border-emerald-100 bg-white shadow-[0_20px_70px_rgba(14,33,33,0.08)]">
        <div className="grid min-h-[780px] lg:grid-cols-[1.1fr_0.9fr]">

          {/* Left panel */}
          <section className="gradient-bg p-6 text-white sm:p-8 lg:p-10">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-lg font-black">O</div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-100/80">ORBIT</p>
                <h1 className="text-2xl font-bold tracking-tight">Orbit Prep</h1>
              </div>
            </div>
            <div className="space-y-5">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-emerald-100/80">Launch your prep</p>
                <h2 className="mt-3 text-4xl font-black tracking-tight">Create your candidate account</h2>
              </div>
              <p className="max-w-md text-base text-emerald-50/85">
                Join your study dashboard, track your revision, and unlock mock exams, focus drills, and smart progress insights.
              </p>
              <div className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Questions", value: "20,000+" },
                    { label: "Subjects", value: "17" },
                    { label: "Free", value: "100%" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl bg-[#0f2d26] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/70">{s.label}</p>
                      <p className="mt-2 text-2xl font-black">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Right panel — form */}
          <section className="bg-[#f8fafb] p-6 sm:p-8 lg:p-10">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700">New account</p>
                <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Sign up</h3>
              </div>
              <Link href="/" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                Back to login
              </Link>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              {/* Full name */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Full name</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="e.g. Chidi Okafor"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white" />
              </div>

              {/* Email */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white" />
              </div>

              {/* Password */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Min. 8 characters"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Confirm password</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Repeat password"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white" />
                </div>
              </div>

              {/* Course + Target */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Desired course</label>
                  <input type="text" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. Medicine and Surgery"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Target score / 400</label>
                  <input type="number" min={1} max={400} value={targetScore} onChange={(e) => setTargetScore(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white" />
                </div>
              </div>

              {/* Subject picker — all 17 ALOC subjects */}
              <fieldset>
                <legend className="mb-1.5 text-sm font-semibold text-slate-700">
                  Your four UTME subjects
                  <span className="ml-2 text-xs font-normal text-slate-500">({selectedCount}/3 optional selected)</span>
                </legend>
                <div className="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                  English Language is required and pre-selected.
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {/* English always checked & disabled */}
                  <label className="flex cursor-not-allowed items-center gap-2 rounded-xl border border-emerald-500 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
                    <input type="checkbox" checked disabled className="h-3.5 w-3.5 accent-emerald-700" />
                    English Language
                  </label>
                  {OPTIONAL_SUBJECTS.map((name) => {
                    const checked = subjects.includes(name);
                    const disabled = !checked && subjects.length >= 4;
                    return (
                      <label key={name}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition
                          ${checked ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : disabled ? "cursor-not-allowed border-slate-200 text-slate-400"
                            : "border-slate-200 text-slate-600 hover:border-emerald-300"}`}>
                        <input type="checkbox" checked={checked} disabled={disabled}
                          onChange={() => toggleSubject(name)} className="h-3.5 w-3.5 accent-emerald-700" />
                        {name}
                      </label>
                    );
                  })}
                </div>
                {subjects.length === 4 && (
                  <p className="mt-1.5 text-xs text-emerald-700 font-semibold">✓ All 4 subjects selected</p>
                )}
              </fieldset>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}

              {showConfirmNotice && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <p className="font-bold">Check your inbox! 📬</p>
                  <p className="mt-1">We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then sign in.</p>
                </div>
              )}

              <button type="submit" disabled={isSubmitting}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-600 text-base font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-70">
                {isSubmitting ? "Creating account…" : "Create account"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
    </AuthGate>
  );
}
