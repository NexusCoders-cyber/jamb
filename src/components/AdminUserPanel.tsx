"use client";

/** Admin: one student's Pro status and phones (licences). Talks to /api/admin/devices with the admin's token. */

import { useCallback, useEffect, useState } from "react";
import { Crown, Loader2, Smartphone, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Device = { device_id: string; label: string | null; licensed: boolean; licensed_at: string | null; first_seen: string; last_seen: string };
type Info = { devices: Device[]; premiumUntil: string | null; maxDevices: number; setup?: boolean };

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function AdminUserPanel({
  user, onClose, onProChange,
}: {
  user: { id: string; full_name: string; email: string | null };
  onClose: () => void;
  onProChange: (premiumUntil: string | null) => void;
}) {
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [days, setDays] = useState("30");
  const [now] = useState(() => Date.now());

  const call = useCallback(async (method: "GET" | "POST", body?: Record<string, unknown>) => {
    const { data: { session } } = await createSupabaseBrowserClient().auth.getSession();
    if (!session) throw new Error("Session expired — sign in again.");
    const res = await fetch(method === "GET" ? `/api/admin/devices?userId=${user.id}` : "/api/admin/devices", {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: body ? JSON.stringify({ userId: user.id, ...body }) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error ?? "Request failed");
    return json;
  }, [user.id]);

  const load = useCallback(async () => {
    try { setInfo(await call("GET")); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not load" }); }
  }, [call]);

  useEffect(() => {
    let live = true;
    call("GET")
      .then((r) => { if (live) setInfo(r); })
      .catch((e) => { if (live) setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not load" }); });
    return () => { live = false; };
  }, [call]);

  async function act(body: Record<string, unknown>, done: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setMsg(null);
    try {
      const res = await call("POST", body);
      if ("premiumUntil" in res) onProChange(res.premiumUntil);
      setMsg({ ok: true, text: done });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed" });
    }
    setBusy(false);
  }

  const proActive = !!info?.premiumUntil && new Date(info.premiumUntil).getTime() > now;
  const btn = "rounded-full px-3 py-1.5 text-[11px] font-bold ring-1 disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Manage ${user.full_name}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-slate-900 p-5 ring-1 ring-slate-800 sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black text-white">{user.full_name || "(no name)"}</h2>
            <p className="truncate text-xs text-slate-500">{user.email ?? user.id}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-slate-800 p-2 text-slate-300 hover:text-white"><X className="h-4 w-4" aria-hidden /></button>
        </div>

        {msg && <p className={`mb-3 rounded-xl px-3 py-2 text-xs font-semibold ${msg.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>{msg.text}</p>}
        {!info && !msg && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-500" aria-hidden /></div>}

        {info && (
          <>
            <section className="mb-5 rounded-2xl bg-slate-800/50 p-4">
              <p className="flex items-center gap-2 text-sm font-black text-white">
                <Crown className={`h-4 w-4 ${proActive ? "text-amber-400" : "text-slate-600"}`} aria-hidden />
                {proActive ? "Pro active" : "Free plan"}
              </p>
              <p className="mt-1 text-xs text-slate-400">{info.premiumUntil ? `${proActive ? "Expires" : "Expired"} ${fmt(info.premiumUntil)}` : "Never subscribed"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input type="number" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} aria-label="Days of Pro"
                  className="w-20 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white outline-none focus:border-violet-500" />
                <button type="button" disabled={busy} onClick={() => void act({ action: "grant_pro", days: Number(days) }, `Added ${days} days of Pro.`)}
                  className={`${btn} bg-amber-500/15 text-amber-300 ring-amber-500/30 hover:bg-amber-500/25`}>Give Pro days</button>
                {proActive && (
                  <button type="button" disabled={busy} onClick={() => void act({ action: "remove_pro" }, "Pro ended.", `End Pro for ${user.full_name || user.email} now?`)}
                    className={`${btn} bg-rose-500/10 text-rose-400 ring-rose-500/30 hover:bg-rose-500/20`}>End Pro now</button>
                )}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-black text-white">Phones <span className="text-xs font-bold text-slate-500">· {info.maxDevices} allowed per paid account</span></p>
                {info.devices.some((d) => d.licensed) && (
                  <button type="button" disabled={busy}
                    onClick={() => void act({ action: "reset" }, "Licence reset — their next phone can take the slot without paying again.", "Free every licence slot for this student? Use this when a student changed phone and already paid.")}
                    className={`${btn} bg-violet-600/20 text-violet-300 ring-violet-500/30 hover:bg-violet-600/30`}>Reset licence</button>
                )}
              </div>
              {info.setup && <p className="mb-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-300">Device tracking isn&apos;t set up yet — run supabase/user_devices.sql once.</p>}
              {info.devices.length === 0 ? (
                <p className="rounded-xl bg-slate-800/50 p-3 text-xs text-slate-500">No phone recorded yet. A phone appears here after this student opens the app while signed in.</p>
              ) : (
                <ul className="space-y-2">
                  {info.devices.map((d) => (
                    <li key={d.device_id} className="rounded-xl bg-slate-800/50 p-3">
                      <div className="flex items-start gap-2">
                        <Smartphone className={`mt-0.5 h-4 w-4 shrink-0 ${d.licensed ? "text-emerald-400" : "text-slate-600"}`} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white">{d.label || "Unknown phone"}
                            {d.licensed && <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-400">PRO LICENCE</span>}
                          </p>
                          <p className="text-[11px] text-slate-500">First seen {fmt(d.first_seen)} · last {fmt(d.last_seen)}</p>
                          <p className="font-mono text-[10px] text-slate-600">{d.device_id.slice(0, 8)}…</p>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        {d.licensed && <button type="button" disabled={busy} onClick={() => void act({ action: "revoke", deviceId: d.device_id }, "Licence removed from that phone.")} className={`${btn} bg-slate-800 text-slate-300 ring-slate-700 hover:bg-slate-700`}>Remove licence</button>}
                        <button type="button" disabled={busy} onClick={() => void act({ action: "forget", deviceId: d.device_id }, "Phone forgotten.", "Forget this phone record?")} className={`${btn} bg-rose-500/10 text-rose-400 ring-rose-500/30 hover:bg-rose-500/20`}>Forget</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
