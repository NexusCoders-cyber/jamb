"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getProfile, updateProfile } from "@/lib/queries";

type Theme = "light" | "dark" | "system";

export default function SettingsPage() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [targetScore, setTargetScore] = useState(300);
  const [theme, setTheme] = useState<Theme>("system");
  const [dailyGoal, setDailyGoal] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    const supabase = createSupabaseBrowserClient();
    getProfile(supabase, user.id)
      .then((profile) => {
        if (profile) {
          setFullName(profile.full_name);
          setEmail(profile.email ?? user.email ?? "");
          setTargetScore(profile.target_score);
        } else {
          setEmail(user.email ?? "");
        }
        // Restore local preferences
        try {
          const pref = localStorage.getItem("orbit_prefs");
          if (pref) {
            const parsed = JSON.parse(pref) as { theme?: Theme; dailyGoal?: number };
            if (parsed.theme) setTheme(parsed.theme);
            if (parsed.dailyGoal) setDailyGoal(parsed.dailyGoal);
          }
        } catch { /* ignore */ }
      })
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");

    const supabase = createSupabaseBrowserClient();
    const err = await updateProfile(supabase, user.id, {
      full_name: fullName.trim(),
      target_score: Number(targetScore),
    });

    if (err) {
      setError(err.message);
    } else {
      // Persist local preferences
      try {
        localStorage.setItem("orbit_prefs", JSON.stringify({ theme, dailyGoal }));
        localStorage.setItem(
          "jamb_user",
          JSON.stringify({ fullName: fullName.trim(), email, targetScore: Number(targetScore) }),
        );
      } catch { /* ignore */ }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    localStorage.removeItem("jamb_user");
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-[#eef2ff] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[30px] bg-white p-6 ring-1 ring-slate-200 shadow-[0_18px_60px_rgba(93,74,228,0.1)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500">Settings</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Profile &amp; Preferences</h1>
          </div>
          <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Dashboard
          </Link>
        </div>

        {!user && !authLoading ? (
          <div className="rounded-[24px] bg-slate-50 p-8 text-center ring-1 ring-slate-200">
            <p className="font-bold text-slate-700">Sign in to manage your settings</p>
            <Link href="/" className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">Sign in</Link>
          </div>
        ) : loading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="animate-pulse rounded-[24px] bg-slate-100 p-5 h-28" />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSave} className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {/* Account */}
            <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
              <h2 className="mb-4 text-xl font-black text-slate-900">Account</h2>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Full name</span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-violet-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Email</span>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500 outline-none cursor-not-allowed"
                  />
                </label>
              </div>
            </div>

            {/* Appearance */}
            <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
              <h2 className="mb-4 text-xl font-black text-slate-900">Appearance</h2>
              <div className="space-y-2">
                {(["light", "dark", "system"] as Theme[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={`flex w-full items-center justify-between rounded-2xl p-3 text-sm font-semibold ring-1 transition ${theme === t ? "bg-violet-50 ring-violet-300 text-violet-900" : "bg-white ring-slate-200 text-slate-700 hover:ring-violet-200"}`}
                  >
                    <span className="capitalize">{t} mode</span>
                    {theme === t && <span className="text-xs text-violet-600">Active</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Study */}
            <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
              <h2 className="mb-4 text-xl font-black text-slate-900">Study</h2>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Daily question goal</span>
                  <select
                    value={dailyGoal}
                    onChange={(e) => setDailyGoal(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-violet-500"
                  >
                    {[10, 20, 30, 40, 60].map((n) => (
                      <option key={n} value={n}>{n} questions/day</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Target score (/ 400)</span>
                  <input
                    type="number"
                    min={1}
                    max={400}
                    value={targetScore}
                    onChange={(e) => setTargetScore(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-violet-500"
                  />
                </label>
              </div>
            </div>

            {/* Notifications — display only for now */}
            <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
              <h2 className="mb-4 text-xl font-black text-slate-900">Notifications</h2>
              <div className="space-y-2">
                {["Push notifications", "Announcements", "Streak reminders"].map((item) => (
                  <div key={item} className="rounded-2xl bg-white p-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">{item}</div>
                ))}
              </div>
            </div>

            {/* Privacy */}
            <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
              <h2 className="mb-4 text-xl font-black text-slate-900">Privacy</h2>
              <div className="space-y-2">
                {["Profile visibility", "Community preferences"].map((item) => (
                  <div key={item} className="rounded-2xl bg-white p-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">{item}</div>
                ))}
              </div>
            </div>

            {/* Help */}
            <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
              <h2 className="mb-4 text-xl font-black text-slate-900">Help</h2>
              <div className="space-y-2">
                {["FAQ", "Contact support", "Report issue"].map((item) => (
                  <div key={item} className="rounded-2xl bg-white p-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">{item}</div>
                ))}
              </div>
            </div>

            {/* Save + Sign out row — full width */}
            <div className="col-span-full space-y-3">
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              )}
              {saved && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  Settings saved ✓
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="h-12 rounded-2xl bg-violet-600 px-8 text-sm font-bold text-white shadow-lg shadow-violet-300/20 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="h-12 rounded-2xl border border-rose-200 bg-rose-50 px-8 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
