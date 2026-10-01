"use client";

/**
 * Admin — Quiz & QPoints. Watch matches, adjust a student's QPoints
 * (ledger is append-only, admin_adjust reason), set the weekly leaderboard
 * reset day and force a reset now.
 */

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Loader2, RotateCcw, Swords, Zap } from "lucide-react";

type MatchRow = {
  id: string;
  subject: string;
  status: string;
  host_score: number;
  guest_score: number;
  created_at: string;
  host?: { full_name: string } | null;
  guest?: { full_name: string | null } | null;
};

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export default function AdminQuizPage() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [resetDay, setResetDay] = useState("sunday");
  const [adjustEmail, setAdjustEmail] = useState("");
  const [adjustDelta, setAdjustDelta] = useState("0");
  const [adjustNote, setAdjustNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const [matchesRes, settingsRes] = await Promise.all([
      supabase
        .from("quiz_matches")
        .select("id, subject, status, host_score, guest_score, created_at, host:profiles!quiz_matches_host_id_fkey(full_name), guest:profiles!quiz_matches_guest_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("admin_settings").select("key, value"),
    ]);
    setMatches(((matchesRes.data ?? []) as unknown) as MatchRow[]);
    const settings = ((settingsRes.data ?? []) as Array<{ key: string; value: string }>);
    const day = settings.find((s) => s.key === "leaderboard_reset_day");
    if (day) setResetDay(day.value);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveResetDay(day: string) {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("admin_settings")
      .upsert({ key: "leaderboard_reset_day", value: day, updated_at: new Date().toISOString() });
    setNotice(error ? error.message : `Leaderboard now resets every ${day}.`);
    setBusy(false);
  }

  async function resetNow() {
    if (!window.confirm("Reset the weekly leaderboard NOW? The current period restarts from this moment.")) return;
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("admin_settings")
      .upsert({
        key: "leaderboard_period_start",
        value: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    setNotice(error ? error.message : "Leaderboard period restarted — the board is now counting from zero.");
    setBusy(false);
  }

  async function adjustPoints() {
    const delta = parseInt(adjustDelta, 10);
    if (!adjustEmail.trim() || Number.isNaN(delta) || delta === 0) {
      setNotice("Enter a student email and a non-zero point delta.");
      return;
    }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("email", adjustEmail.trim().toLowerCase())
      .maybeSingle();
    const p = profile as { id: string; full_name: string } | null;
    if (!p) {
      setNotice(`No student found with email ${adjustEmail}.`);
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("qpoints_ledger").insert({
      user_id: p.id,
      delta,
      reason: "admin_adjust",
      note: adjustNote.trim() || "Admin adjustment",
    });
    setNotice(error ? error.message : `${delta > 0 ? "+" : ""}${delta} QPoints for ${p.full_name}.`);
    setAdjustDelta("0");
    setAdjustNote("");
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-violet-400">
          <Swords className="h-4 w-4" aria-hidden /> Quiz &amp; QPoints
        </p>
        <h1 className="mt-1 text-2xl font-black text-white">Arena control</h1>
      </header>

      {notice && (
        <div className="mb-4 rounded-2xl bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-300 ring-1 ring-violet-500/30">
          {notice}
        </div>
      )}

      {/* Leaderboard controls */}
      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-slate-900 p-5 ring-1 ring-slate-800">
          <p className="text-sm font-black text-white">Weekly reset day</p>
          <p className="mt-1 text-xs text-slate-400">The leaderboard restarts every week on this day.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <button key={d} type="button" onClick={() => setResetDay(d)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${resetDay === d ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300 hover:text-white"}`}>
                {d.slice(0, 3)}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void saveResetDay(resetDay)} disabled={busy}
            className="mt-3 rounded-full bg-violet-600 px-4 py-2 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-50">
            Save reset day
          </button>
        </div>

        <div className="rounded-3xl bg-slate-900 p-5 ring-1 ring-slate-800">
          <p className="text-sm font-black text-white">Adjust QPoints</p>
          <p className="mt-1 text-xs text-slate-400">Grant or remove points for a student (recorded in the ledger).</p>
          <div className="mt-3 space-y-2">
            <input value={adjustEmail} onChange={(e) => setAdjustEmail(e.target.value)} placeholder="student@email.com"
              className="w-full rounded-xl bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none ring-1 ring-slate-700 focus:ring-violet-500" />
            <div className="flex gap-2">
              <input value={adjustDelta} onChange={(e) => setAdjustDelta(e.target.value)} placeholder="+50"
                className="w-24 rounded-xl bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none ring-1 ring-slate-700 focus:ring-violet-500" />
              <input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="Reason (optional)"
                className="min-w-0 flex-1 rounded-xl bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none ring-1 ring-slate-700 focus:ring-violet-500" />
            </div>
          </div>
          <button type="button" onClick={() => void adjustPoints()} disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-50">
            <Zap className="h-3.5 w-3.5" aria-hidden /> Apply adjustment
          </button>
        </div>
      </section>

      <button type="button" onClick={() => void resetNow()} disabled={busy}
        className="mb-6 inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-4 py-2 text-xs font-black text-rose-400 ring-1 ring-rose-500/30 hover:bg-rose-500/20 disabled:opacity-50">
        <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset leaderboard now
      </button>

      {/* Recent matches */}
      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-400">Recent matches</h2>
        {matches.length === 0 ? (
          <div className="rounded-3xl bg-slate-900 p-8 text-center ring-1 ring-slate-800">
            <p className="font-black text-white">No matches played yet.</p>
            <p className="mt-1 text-xs text-slate-400">Matches appear here as students duel in the Arena.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-white">
                    {m.host?.full_name ?? "Host"} vs {m.guest?.full_name ?? "solo"} · {m.subject}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {m.host_score}–{m.guest_score} · {m.status} · {new Date(m.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${m.status === "completed" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
