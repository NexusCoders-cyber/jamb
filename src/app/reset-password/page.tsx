"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Stage = "loading" | "form" | "success" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Supabase redirects here with tokens in the URL hash.
  // The SSR client automatically exchanges them for a session.
  useEffect(() => {
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try { supabase = createSupabaseBrowserClient(); } catch { setStage("invalid"); return; }

    // Listen for the PASSWORD_RECOVERY event Supabase fires on this page
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStage("form");
      } else if (event === "SIGNED_IN" && stage === "loading") {
        // Came here while already signed in — also allow password change
        setStage("form");
      }
    });

    // Safety timeout — if no event fires within 3 s the link is invalid/expired
    const timeout = window.setTimeout(() => {
      setStage((s) => (s === "loading" ? "invalid" : s));
    }, 3000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: sbErr } = await supabase.auth.updateUser({ password });
      if (sbErr) throw sbErr;
      setStage("success");
      setTimeout(() => router.push("/dashboard"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#eef2ff] px-4">
      <div className="w-full max-w-md rounded-[32px] bg-white p-8 shadow-[0_20px_70px_rgba(93,74,228,0.12)] ring-1 ring-slate-200">

        {/* Loading */}
        {stage === "loading" && (
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
            <p className="text-sm font-semibold text-slate-500">Verifying your reset link…</p>
          </div>
        )}

        {/* Invalid / expired link */}
        {stage === "invalid" && (
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-3xl">🔗</div>
            <h1 className="text-2xl font-black text-slate-900">Link expired</h1>
            <p className="mt-2 text-sm text-slate-500">
              This password reset link is invalid or has expired. Request a new one from the login page.
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-violet-600 text-sm font-bold text-white"
            >
              Back to login
            </button>
          </div>
        )}

        {/* Password form */}
        {stage === "form" && (
          <>
            <div className="mb-7 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-2xl">🔐</div>
              <h1 className="text-2xl font-black text-slate-900">Set new password</h1>
              <p className="mt-2 text-sm text-slate-500">Choose a strong password for your account.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-violet-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="Repeat new password"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-violet-500 focus:bg-white"
                />
              </div>

              {/* Strength hint */}
              {password.length > 0 && (
                <div className="flex gap-1">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-all ${
                        password.length >= 12 ? "bg-emerald-500"
                          : password.length >= 10 ? (i < 3 ? "bg-amber-400" : "bg-slate-200")
                          : password.length >= 8 ? (i < 2 ? "bg-amber-400" : "bg-slate-200")
                          : (i < 1 ? "bg-rose-400" : "bg-slate-200")
                      }`}
                    />
                  ))}
                  <span className="ml-2 text-xs text-slate-400">
                    {password.length >= 12 ? "Strong" : password.length >= 8 ? "Fair" : "Weak"}
                  </span>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-violet-600 text-base font-bold text-white disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save new password"}
              </button>
            </form>
          </>
        )}

        {/* Success */}
        {stage === "success" && (
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">✅</div>
            <h1 className="text-2xl font-black text-slate-900">Password updated!</h1>
            <p className="mt-2 text-sm text-slate-500">Your password has been changed. Redirecting you to the dashboard…</p>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full animate-[progress_2.5s_linear] rounded-full bg-emerald-500" />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
