"use client";

/** Admin — Reports. Questions students flagged as wrong. Hide a bad question (it stops being served) or dismiss the report. */

import { useCallback, useEffect, useState } from "react";
import { EyeOff, Loader2, RotateCcw, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Group = { bankKey: string; subject: string; prompt: string; options: string[]; status: string; latest: string; reasons: Record<string, number>; notes: string[]; count: number };
type Status = "open" | "hidden" | "dismissed";

const REASON_LABEL: Record<string, string> = {
  wrong_answer: "Wrong answer", typo: "Typo", bad_image: "Picture problem", unclear: "Unclear", other: "Other",
};

export default function AdminReportsPage() {
  const [status, setStatus] = useState<Status>("open");
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [ready, setReady] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
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

  useEffect(() => {
    let live = true;
    call("GET", `/api/admin/reports?status=${status}`)
      .then((j) => { if (live) { setGroups(j.groups ?? []); setReady(j.ready !== false); } })
      .catch((e) => { if (live) { setGroups([]); setNotice(e instanceof Error ? e.message : "Could not load"); } });
    return () => { live = false; };
  }, [call, status]);

  async function setTo(g: Group, to: Status) {
    setBusyKey(g.bankKey); setNotice(null);
    try {
      await call("POST", "/api/admin/reports", { bankKey: g.bankKey, status: to });
      setGroups((list) => (list ?? []).filter((x) => x.bankKey !== g.bankKey));
      setNotice(to === "hidden" ? "Hidden — students won't be served this question any more." : to === "dismissed" ? "Report dismissed." : "Reopened.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Failed");
    }
    setBusyKey(null);
  }

  const tab = (s: Status, label: string) => (
    <button key={s} type="button" onClick={() => { setGroups(null); setStatus(s); }} aria-pressed={status === s}
      className={`rounded-full px-4 py-2 text-xs font-bold ring-1 ${status === s ? "bg-violet-600 text-white ring-violet-500" : "bg-slate-900 text-slate-300 ring-slate-700 hover:text-white"}`}>{label}</button>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">Quality</p>
        <h1 className="mt-1 text-2xl font-black text-white">Question reports</h1>
        <p className="mt-1 text-sm text-slate-500">Students flag questions that look wrong. Hide a bad one and it is no longer served to anyone.</p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">{tab("open", "Open")}{tab("hidden", "Hidden")}{tab("dismissed", "Dismissed")}</div>
      {notice && <p className="mb-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-300 ring-1 ring-slate-800">{notice}</p>}

      {!ready ? (
        <p className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-300">Reporting isn&apos;t set up yet. Run <code className="font-mono">supabase/security_hardening.sql</code> once in the Supabase SQL Editor.</p>
      ) : groups === null ? (
        <div className="space-y-2">{[1, 2, 3].map((n) => <div key={n} className="h-24 animate-pulse rounded-2xl bg-slate-900" />)}</div>
      ) : groups.length === 0 ? (
        <div className="rounded-3xl bg-slate-900 p-8 text-center ring-1 ring-slate-800">
          <p className="font-black text-white">Nothing here</p>
          <p className="mt-1 text-sm text-slate-500">{status === "open" ? "No open reports. 🎉" : "No questions in this list."}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.bankKey} className="rounded-3xl bg-slate-900 p-5 ring-1 ring-slate-800">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] font-black capitalize text-violet-300">{g.subject}</span>
                <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-black text-rose-300">{g.count} report{g.count === 1 ? "" : "s"}</span>
                {Object.entries(g.reasons).map(([k, n]) => <span key={k} className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-300">{REASON_LABEL[k] ?? k} · {n}</span>)}
              </div>
              <p className="whitespace-pre-line text-sm font-semibold leading-6 text-white">{g.prompt}</p>
              {g.options.length > 0 && (
                <ol className="mt-2 grid gap-1 text-xs text-slate-400 sm:grid-cols-2">
                  {g.options.map((o, i) => <li key={i}><span className="font-black text-slate-500">{String.fromCharCode(65 + i)}.</span> {o}</li>)}
                </ol>
              )}
              {g.notes.length > 0 && <ul className="mt-3 space-y-1">{g.notes.map((n, i) => <li key={i} className="rounded-xl bg-slate-800/60 px-3 py-2 text-xs text-slate-300">“{n}”</li>)}</ul>}
              <div className="mt-4 flex flex-wrap gap-2">
                {busyKey === g.bankKey ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden /> : (
                  <>
                    {status !== "hidden" && <button type="button" onClick={() => void setTo(g, "hidden")} className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-500/20"><EyeOff className="h-3.5 w-3.5" aria-hidden /> Hide question</button>}
                    {status === "open" && <button type="button" onClick={() => void setTo(g, "dismissed")} className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700"><X className="h-3.5 w-3.5" aria-hidden /> Dismiss</button>}
                    {status !== "open" && <button type="button" onClick={() => void setTo(g, "open")} className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700"><RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reopen</button>}
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
