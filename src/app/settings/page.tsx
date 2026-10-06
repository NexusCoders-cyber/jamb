"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import AccountSecurity from "@/components/AccountSecurity";
import CloudBackupCard from "@/components/CloudBackupCard";
import OfflinePacksCard from "@/components/OfflinePacksCard";
import { getProfile, updateProfile } from "@/lib/queries";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePref } from "@/lib/theme";

// Mini previews drawn with inline styles on purpose: they must look the same in light AND dark mode
const THEME_OPTIONS: { value: ThemePref; label: string; icon: typeof Sun; swatch: string; bar: string; accent: string; card: string }[] = [
  { value: "light", label: "Light", icon: Sun, swatch: "#f5f4ff", card: "#ffffff", bar: "#e2e0f5", accent: "#6557d9" },
  { value: "dark", label: "Dark", icon: Moon, swatch: "#0d0c18", card: "#1b1a31", bar: "#2e2d4e", accent: "#8b5cf6" },
  { value: "system", label: "System", icon: Monitor, swatch: "linear-gradient(135deg,#f5f4ff 50%,#0d0c18 50%)", card: "linear-gradient(135deg,#ffffff 50%,#1b1a31 50%)", bar: "linear-gradient(135deg,#e2e0f5 50%,#2e2d4e 50%)", accent: "#8b5cf6" },
];

export default function SettingsPage() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [targetScore, setTargetScore] = useState(300);
  const { pref: themePref, resolved: themeResolved, setPref: setThemePref } = useTheme();
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
            const parsed = JSON.parse(pref) as { dailyGoal?: number };
            if (parsed.dailyGoal) setDailyGoal(parsed.dailyGoal);
          }
        } catch (_e) { /* ignore */ }
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

    // Keep interests in sync (subjects chosen at signup, editable here)
    try {
      const prefs = JSON.parse(localStorage.getItem("orbit_prefs") ?? "{}") as { subjects?: string[] };
      if (Array.isArray(prefs.subjects) && prefs.subjects.length === 4) {
        await supabase.from("profiles").update({ interests: prefs.subjects }).eq("id", user.id);
      }
    } catch { /* ignore */ }

    if (err) {
      setError(err.message);
    } else {
      // Persist local preferences (merged: the signup subjects live in the same key and must survive).
      // The theme is NOT saved here — it applies and saves the moment it is chosen.
      try {
        const existing = JSON.parse(localStorage.getItem("orbit_prefs") ?? "{}") as Record<string, unknown>;
        localStorage.setItem("orbit_prefs", JSON.stringify({ ...existing, dailyGoal }));
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
    <AppShell title="Settings">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-4xl lg:px-6">
        <h1 className="mb-4 text-2xl font-black text-slate-900">Profile &amp; Preferences</h1>

        <AuthGuard user={user} loading={authLoading}>
        {loading ? (
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

            {/* Offline-first: explicit cloud backup */}
            {user && <CloudBackupCard userId={user.id} />}

            {/* Appearance — applies instantly and is remembered on this device */}
            <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-900">Appearance</h2>
              <p className="mb-4 mt-1 text-xs leading-5 text-slate-500">Choose how Qubit looks. It changes straight away and is saved on this device.</p>
              <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2.5">
                {THEME_OPTIONS.map((o) => {
                  const active = themePref === o.value;
                  const Icon = o.icon;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setThemePref(o.value)}
                      className={`touch-manipulation rounded-2xl bg-white p-2 text-center transition ${active ? "ring-2 ring-violet-600" : "ring-1 ring-slate-200 hover:ring-violet-300"}`}
                    >
                      <span className="relative block h-14 overflow-hidden rounded-xl" style={{ background: o.swatch }} aria-hidden>
                        <span className="absolute inset-x-2 top-2 h-8 rounded-lg" style={{ background: o.card }} />
                        <span className="absolute left-3.5 top-4 h-1.5 w-8 rounded-full" style={{ background: o.bar }} />
                        <span className="absolute left-3.5 top-7 h-1.5 w-5 rounded-full" style={{ background: o.accent }} />
                      </span>
                      <span className={`mt-2 flex items-center justify-center gap-1 text-xs font-bold ${active ? "text-violet-700" : "text-slate-700"}`}>
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {o.label}
                        {active && <Check className="h-3 w-3" aria-hidden />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-slate-500" aria-live="polite">
                {themePref === "system"
                  ? `Following your device: showing ${themeResolved} mode.`
                  : `${themePref === "dark" ? "Dark" : "Light"} mode is on.`}
              </p>
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

            <OfflinePacksCard />

            {/* Account, privacy & legal */}
            {user && <AccountSecurity userId={user.id} />}

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
                  <span className="inline-flex items-center gap-2"><Check className="h-4 w-4" aria-hidden /> Settings saved</span>
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
        </AuthGuard>
      </div>
    </AppShell>
  );
}
