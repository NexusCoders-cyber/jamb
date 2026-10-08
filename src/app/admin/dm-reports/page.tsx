"use client";

/** Admin — Message reports. Students report abusive direct messages; stop the sender from messaging, or dismiss. */

import { useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle2, Loader2, RotateCcw, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Person = { id: string; name: string };
type Report = {
  id: string; reason: string; note: string | null; status: string; createdAt: string; messageBody: string | null;
  context: { from_reporter: boolean; body: string; at: string }[];
  reporter: Person;
  reported: Person & { email: string | null; banned: boolean; totalReports: number };
};
type Status = "open" | "actioned" | "dismissed";

const REASON: Record<string, string> = { harassment: "Harassment", inappropriate: "Inappropriate", scam: "Scam", spam: "Spam", other: "Other" };

export default function AdminDmReportsPage() {
  const [status, setStatus] = useState<Status>("open");
  const [reports, setReports] = useState<Report[] | null>(null);
  const [ready, setReady] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const call = useCallback(async (method: "GET" | "POST", url: string, body?: Record<string, unknown>) => {
    const { data: { session } } = await createSupabaseBrowserClient().auth.getSession();
    if (!session) throw new Error("Session expired — sign in again.");
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error ?? "Request failed");
    return json;
  }, []);

  const load = useCallback(() => {
    return call("GET", `/api/admin/dm-reports?status=${status}`)
      .then((j) => { setReports(j.reports ?? []); setReady(j.ready !== false); })
      .catch((e) => { setReports([]); setNotice(e instanceof Error ? e.message : "Could not load"); });
  }, [call, status]);

  useEffect(() => { void load(); }, [load]);

  async function run(key: string, fn: () => Promise<unknown>, done: string) {
    setBusy(key); setNotice(null);
    try { await fn(); setNotice(done); await load(); } catch (e) { setNotice(e instanceof Error ? e.message : "Failed"); }
    setBusy(null);
  }

  const setTo = (r: Report, to: Status) => run(r.id, () => call("POST", "/api/admin/dm-reports", { id: r.id, status: to }), to === "open" ? "Reopened." : "Done.");
  const ban = (r: Report, action: "ban" | "unban") =>
    run(r.id, async () => {
      await call("POST", "/api/admin/dm-reports", { userId: r.reported.id, action, reason: REASON[r.reason] });
      if (action === "ban" && r.status === "open") await call("POST", "/api/admin/dm-reports", { id: r.id, status: "actioned" });
    }, action === "ban" ? `${r.reported.name} can no longer send messages.` : `${r.reported.name} can send messages again.`);

  const tab = (s: Status, label: string) => (
    <button key={s} type="button" onClick={() => { setReports(null); setStatus(s); }} aria-pressed={status === s}
      className={`rounded-full px-4 py-2 text-xs font-bold ring-1 ${status === s ? "bg-violet-600 text-white ring-violet-500" : "bg-slate-900 text-slate-300 ring-slate-700 hover:text-white"}`}>{label}</button>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">Safety</p>
        <h1 className="mt-1 text-2xl font-black text-white">Message reports</h1>
        <p className="mt-1 text-sm text-slate-500">Students report abusive direct messages. Stop the sender from messaging, or dismiss the report. The reporter is never shown to the person reported.</p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">{tab("open", "Open")}{tab("actioned", "Actioned")}{tab("dismissed", "Dismissed")}</div>
      {notice && <p className="mb-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-300 ring-1 ring-slate-800">{notice}</p>}

      {!ready ? (
        <p className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-300">Message reporting isn&apos;t set up yet. Run <code className="font-mono">supabase/dm_safety.sql</code> once in the Supabase SQL Editor.</p>
      ) : reports === null ? (
        <div className="space-y-2">{[1, 2, 3].map((n) => <div key={n} className="h-28 animate-pulse rounded-2xl bg-slate-900" />)}</div>
      ) : reports.length === 0 ? (
        <div className="rounded-3xl bg-slate-900 p-8 text-center ring-1 ring-slate-800">
          <p className="font-black text-white">Nothing here</p>
          <p className="mt-1 text-sm text-slate-500">{status === "open" ? "No open reports." : "No reports in this list."}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-3xl bg-slate-900 p-5 ring-1 ring-slate-800">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-black">
                <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-rose-300">{REASON[r.reason] ?? r.reason}</span>
                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-300">{new Date(r.createdAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                {r.reported.totalReports > 1 && <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-300">{r.reported.totalReports} reports on this person</span>}
                {r.reported.banned && <span className="rounded-full bg-slate-700 px-2.5 py-1 text-slate-200">Can&apos;t send messages</span>}
              </div>
              <p className="text-sm text-slate-300">
                <span className="font-bold text-white">{r.reporter.name}</span> reported <span className="font-bold text-white">{r.reported.name}</span>
                {r.reported.email && <span className="text-slate-500"> ({r.reported.email})</span>}
              </p>
              {r.messageBody && <p className="mt-3 whitespace-pre-line rounded-xl bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-100 ring-1 ring-rose-500/20">“{r.messageBody}”</p>}
              {r.note && <p className="mt-2 text-xs text-slate-400">Note: “{r.note}”</p>}
              {r.context.length > 1 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-bold text-slate-400">Conversation before it</summary>
                  <ul className="mt-2 space-y-1">
                    {r.context.map((c, i) => (
                      <li key={i} className={`rounded-lg px-3 py-1.5 text-xs ${c.from_reporter ? "bg-violet-500/10 text-violet-200" : "bg-slate-800 text-slate-300"}`}>
                        <span className="font-black">{c.from_reporter ? r.reporter.name : r.reported.name}:</span> {c.body}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden /> : (
                  <>
                    {r.reported.banned ? (
                      <button type="button" onClick={() => void ban(r, "unban")} className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Allow messaging again</button>
                    ) : (
                      <button type="button" onClick={() => { if (window.confirm(`Stop ${r.reported.name} from sending direct messages?`)) void ban(r, "ban"); }} className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-500/20"><Ban className="h-3.5 w-3.5" aria-hidden /> Stop them messaging</button>
                    )}
                    {status === "open" && <button type="button" onClick={() => void setTo(r, "actioned")} className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Mark handled</button>}
                    {status === "open" && <button type="button" onClick={() => void setTo(r, "dismissed")} className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700"><X className="h-3.5 w-3.5" aria-hidden /> Dismiss</button>}
                    {status !== "open" && <button type="button" onClick={() => void setTo(r, "open")} className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700"><RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reopen</button>}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
