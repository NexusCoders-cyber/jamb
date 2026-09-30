"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import { getProfile, getUserAttempts, type Profile } from "@/lib/queries";
import {
  BadgeCheck,
  CalendarDays,
  Flame,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Pencil,
  Star,
  Target,
  Trophy,
  Upload,
} from "lucide-react";

// ─── Badge rules (shared definition) ─────────────────────────────────────────

type Badge = { title: string; description: string; unlocked: boolean };

const BADGE_RULES: Array<{
  title: string;
  description: string;
  check: (streak: number, exams: number, questions: number) => boolean;
}> = [
  { title: "First Step", description: "Complete your first exam", check: (_s, exams) => exams >= 1 },
  { title: "3-Day Starter", description: "Reach a 3-day streak", check: (streak) => streak >= 3 },
  { title: "One Week Warrior", description: "Reach a 7-day streak", check: (streak) => streak >= 7 },
  { title: "Two-Week Champion", description: "Reach a 14-day streak", check: (streak) => streak >= 14 },
  { title: "30-Day Scholar", description: "Reach a 30-day streak", check: (streak) => streak >= 30 },
  { title: "100-Day Scholar", description: "Reach a 100-day streak", check: (streak) => streak >= 100 },
  { title: "Century Club", description: "Answer 100 questions", check: (_s, _e, q) => q >= 100 },
  { title: "Question Master", description: "Answer 500 questions", check: (_s, _e, q) => q >= 500 },
  { title: "Prolific", description: "Complete 5 exams", check: (_s, exams) => exams >= 5 },
  { title: "Exam Ready", description: "Complete 10 exams", check: (_s, exams) => exams >= 10 },
];

// ─── Shared UI pieces ─────────────────────────────────────────────────────────

function longestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const unique = [...new Set(dates.map((d) => d.slice(0, 10)))].sort();
  let best = 1, cur = 1;
  for (let i = 1; i < unique.length; i++) {
    const diff = (new Date(unique[i]).getTime() - new Date(unique[i - 1]).getTime()) / 86400000;
    cur = diff === 1 ? cur + 1 : 1;
    if (cur > best) best = cur;
  }
  return best;
}

function ActivityGrid({ dates }: { dates: string[] }) {
  const active = new Set(dates.map((d) => d.slice(0, 10)));
  const days: { date: string; on: boolean }[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    days.push({ date: d, on: active.has(d) });
  }
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
      {days.map((d) => (
        <span key={d.date} title={d.date} className={`aspect-square rounded-md ${d.on ? "bg-violet-500" : "bg-slate-200"}`} />
      ))}
    </div>
  );
}

function BadgeStrip({ badges }: { badges: Badge[] }) {
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  return (
    <section className="mb-5 rounded-[24px] bg-white p-5 ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-black text-slate-900">
          <Trophy className="h-4 w-4 text-amber-500" aria-hidden /> Achievements
        </p>
        <span className="text-xs font-bold text-slate-400">{unlockedCount}/{badges.length} unlocked</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {badges.map((b) => (
          <span key={b.title} title={b.description}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
              b.unlocked ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
            }`}>
            {b.unlocked ? <Trophy className="h-3.5 w-3.5" aria-hidden /> : <Star className="h-3.5 w-3.5" aria-hidden />}
            {b.title}
          </span>
        ))}
      </div>
    </section>
  );
}

function StatCard({ label, value, Icon }: { label: string; value: string | number; Icon: typeof Target }) {
  return (
    <div className="rounded-[24px] bg-white p-4 text-center ring-1 ring-slate-200">
      <Icon className="mx-auto h-5 w-5 text-violet-500" aria-hidden />
      <p className="mt-1.5 text-xl font-black text-slate-900">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/** Renders a user profile. Pass `userId` to view someone else read-only;
 *  omit it for the signed-in user's own editable profile. */
export default function ProfileView({ userId: routeUserId }: { userId?: string }) {
  const { user, loading: authLoading } = useUser();

  const viewingOther = Boolean(routeUserId);
  const targetUserId = routeUserId ?? user?.id ?? null;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [otherStats, setOtherStats] = useState<{ exams: number; questions: number; accuracy: number; streak: number } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  // Own-profile editing state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Derived stats (own profile)
  const [streak, setStreak] = useState(0);
  const [longest, setLongest] = useState(0);
  const [exams, setExams] = useState(0);
  const [questions, setQuestions] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [recentDates, setRecentDates] = useState<string[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !targetUserId) { setLoading(false); return; }

    const supabase = createSupabaseBrowserClient();

    async function load() {
      if (!targetUserId) return;
      const p = await getProfile(supabase, targetUserId);
      if (!p) { setNotFound(true); setLoading(false); return; }
      setProfile(p);
      setBioDraft(p.bio ?? "");

      if (!viewingOther) {
        const attempts = await getUserAttempts(supabase, user!.id, 200);
        const dates = attempts.map((a) => a.submitted_at ?? a.started_at).filter(Boolean) as string[];
        setRecentDates(dates);
        setLongest(dates.length > 0 ? longestStreak(dates) : 0);
        setExams(attempts.length);
        const totalQ = attempts.reduce((s, a) => s + a.question_count, 0);
        const totalC = attempts.reduce((s, a) => s + a.score, 0);
        setQuestions(totalQ);
        setAccuracy(totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0);
        setStreak(p.streak_days ?? 0);
      } else {
        const { data } = await supabase.rpc("public_profile_stats", { uid: targetUserId });
        const s = Array.isArray(data) ? data[0] : data;
        if (s) {
          setOtherStats({ exams: s.exams, questions: s.questions, accuracy: s.accuracy, streak: s.streak });
          setStreak(s.streak ?? 0);
          setExams(s.exams ?? 0);
          setQuestions(s.questions ?? 0);
          setAccuracy(s.accuracy ?? 0);
        }
      }
      setLoading(false);
    }

    void load();
  }, [user, authLoading, targetUserId, viewingOther]);

  async function handleAvatarChange(file: File | undefined) {
    if (!file || !user || !profile) return;
    setUploading(true);
    setUploadError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "0" });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: data.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (dbErr) throw dbErr;
      setProfile({ ...profile, avatar_url: data.publicUrl });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not upload image.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSignOut() {
    if (signingOut) return;
    if (!window.confirm("Sign out of Qubit?")) return;
    setSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    try { localStorage.removeItem("jamb_user"); } catch { /* ignore */ }
    window.location.href = "/";
  }

  async function saveBio() {
    if (!user) return;
    setSavingBio(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("profiles")
      .update({ bio: bioDraft.slice(0, 280), updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (!error && profile) setProfile({ ...profile, bio: bioDraft.slice(0, 280) });
    setSavingBio(false);
    setEditingBio(false);
  }

  const statsSource = viewingOther && otherStats ? otherStats : { exams, questions, accuracy, streak };
  const badges: Badge[] = profile
    ? BADGE_RULES.map((r) => ({
        title: r.title,
        description: r.description,
        unlocked: r.check(statsSource.streak, statsSource.exams, statsSource.questions),
      }))
    : [];

  const name = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Student";
  const initials = name.slice(0, 1).toUpperCase();
  const today = new Date().toISOString().slice(0, 10);
  const challengeDoneToday = !viewingOther && recentDates.some((d) => d.slice(0, 10) === today);

  return (
    <AppShell title={viewingOther ? name : "Profile"}>
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-4xl lg:px-6">
        {!viewingOther && <h1 className="mb-4 text-2xl font-black text-slate-900">My Profile</h1>}

        <AuthGuard user={user} loading={authLoading}>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((n) => <div key={n} className="h-40 animate-pulse rounded-[24px] bg-slate-100" />)}
            </div>
          ) : notFound || !profile ? (
            <div className="rounded-[24px] bg-white p-8 text-center ring-1 ring-slate-200">
              <p className="text-lg font-black text-slate-900">Profile not found</p>
              <p className="mt-2 text-sm text-slate-500">This student may have left Qubit.</p>
              <Link href="/messages" className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">Back to messages</Link>
            </div>
          ) : (
            <>
              {/* ── Identity card ── */}
              <section className="mb-5 overflow-hidden rounded-[28px] bg-gradient-to-br from-violet-600 to-violet-500 p-6 text-white shadow-xl shadow-violet-300/25">
                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0 rounded-full ring-4 ring-white/30">
                    {profile.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatar_url} alt="Profile" className="h-20 w-20 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 text-3xl font-black">{initials}</span>
                    )}
                    {!viewingOther && (
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        aria-label="Change profile photo"
                        className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition hover:opacity-100"
                      >
                        {uploading ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : <Upload className="h-6 w-6" aria-hidden />}
                      </button>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleAvatarChange(e.target.files?.[0])} />

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-2xl font-black">{name}</h2>
                    {!viewingOther && <p className="truncate text-sm text-violet-100">{user?.email}</p>}
                    {profile.course && (
                      <span className="mt-1 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold">{profile.course}</span>
                    )}
                    {profile.interests && profile.interests.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {profile.interests.slice(0, 4).map((i) => (
                          <span key={i} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-violet-100">
                            {i.replace(" Language", "")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="flex items-center justify-end gap-1 text-3xl font-black">
                      <Flame className="h-7 w-7 text-amber-300" aria-hidden /> {statsSource.streak}
                    </p>
                    <p className="text-xs font-semibold text-violet-200">day streak</p>
                  </div>
                </div>

                {uploadError && <p className="mt-3 text-xs font-semibold text-rose-200">{uploadError}</p>}

                {/* Bio — editable only on your own profile */}
                <div className="mt-4">
                  {!viewingOther && editingBio ? (
                    <div>
                      <textarea
                        value={bioDraft}
                        onChange={(e) => setBioDraft(e.target.value)}
                        rows={2}
                        maxLength={280}
                        placeholder="Tell other students about your prep journey…"
                        className="w-full rounded-xl bg-white/10 p-3 text-sm text-white placeholder-violet-200 outline-none ring-1 ring-white/20 focus:ring-white/40"
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-violet-200">{bioDraft.length}/280</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { setEditingBio(false); setBioDraft(profile?.bio ?? ""); }}
                            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold">Cancel</button>
                          <button type="button" onClick={() => void saveBio()} disabled={savingBio}
                            className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-violet-700 disabled:opacity-60">
                            {savingBio ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { if (!viewingOther) setEditingBio(true); }}
                      className="flex w-full items-start gap-2 rounded-xl bg-white/5 p-3 text-left ring-1 ring-white/10"
                    >
                      {!viewingOther && <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-200" aria-hidden />}
                      <span className="text-sm text-violet-50">{profile.bio || (viewingOther ? "No bio yet." : "Add a short bio…")}</span>
                    </button>
                  )}
                </div>
              </section>

              {/* ── Message button when viewing someone else ── */}
              {viewingOther && (
                <Link href={`/messages/${profile.id}`}
                  className="mb-5 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3.5 text-sm font-black text-white shadow-lg shadow-violet-300/25 hover:bg-violet-700">
                  <Mail className="h-4 w-4" aria-hidden /> Message {name.split(" ")[0]}
                </Link>
              )}

              {/* ── Stats ── */}
              <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Exams" value={statsSource.exams} Icon={Target} />
                <StatCard label="Questions" value={statsSource.questions > 999 ? `${(statsSource.questions / 1000).toFixed(1)}k` : statsSource.questions} Icon={BadgeCheck} />
                <StatCard label="Accuracy" value={`${statsSource.accuracy}%`} Icon={Star} />
                <StatCard label="Longest streak" value={viewingOther ? `${statsSource.streak}d` : `${longest}d`} Icon={Flame} />
              </section>

              {/* ── Daily challenge (own profile only) ── */}
              {!viewingOther && (
                <section className="mb-5 flex items-center justify-between rounded-[24px] bg-amber-50 p-5 ring-1 ring-amber-100">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Today&apos;s challenge</p>
                    <p className="mt-1 text-lg font-black text-slate-900">{challengeDoneToday ? "Completed today" : "Daily challenge pending"}</p>
                  </div>
                  <Link href={challengeDoneToday ? "/streaks" : "/daily-challenge"}
                    className={`rounded-xl px-4 py-2.5 text-sm font-bold ${challengeDoneToday ? "bg-amber-100 text-amber-800" : "bg-amber-500 text-white hover:bg-amber-600"}`}>
                    {challengeDoneToday ? "View streak" : "Start now"}
                  </Link>
                </section>
              )}

              {/* ── Activity grid (own profile — needs own attempt dates) ── */}
              {!viewingOther && (
                <section className="mb-5 rounded-[24px] bg-white p-5 ring-1 ring-slate-200">
                  <p className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                    <CalendarDays className="h-4 w-4 text-violet-500" aria-hidden /> Last 4 weeks
                  </p>
                  <ActivityGrid dates={recentDates} />
                  <p className="mt-2 text-xs text-slate-400">
                    {new Set(recentDates.map((d) => d.slice(0, 10))).size} active days in the last 28
                  </p>
                </section>
              )}

              {/* ── Achievements ── */}
              <BadgeStrip badges={badges} />

              {!viewingOther && (
                <Link href="/achievements" className="mt-1 inline-block text-xs font-bold text-violet-600 hover:underline">
                  See all achievements
                </Link>
              )}

              {/* ── Sign out (own profile only) ── */}
              {!viewingOther && (
                <section className="mt-6 mb-5 rounded-[24px] bg-white p-5 ring-1 ring-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">Sign out</p>
                      <p className="mt-0.5 text-xs text-slate-400">You can sign back in anytime.</p>
                    </div>
                    <button type="button" onClick={() => void handleSignOut()} disabled={signingOut}
                      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-rose-50 px-4 text-sm font-black text-rose-600 ring-1 ring-rose-100 transition hover:bg-rose-100 disabled:opacity-60">
                      {signingOut ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />}
                      {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </AuthGuard>
      </div>
    </AppShell>
  );
}
