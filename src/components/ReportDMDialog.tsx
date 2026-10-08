"use client";

import { useState } from "react";
import { Flag, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { DM_REASONS, reportDM, type DmReason } from "@/lib/dmSafety";

/** Bottom-sheet dialog to report a message (messageId) or a whole person (messageId = null). */
export default function ReportDMDialog({
  userId, userName, messageId, preview, onClose, onBlock,
}: {
  userId: string;
  userName: string;
  messageId: string | null;
  preview?: string;
  onClose: () => void;
  /** Offered after a successful report: also block this person. */
  onBlock?: () => void;
}) {
  const [reason, setReason] = useState<DmReason>("harassment");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function send() {
    setError("");
    if (typeof navigator !== "undefined" && !navigator.onLine) { setError("You're offline. Connect to the internet to send a report."); return; }
    setState("sending");
    const err = await reportDM(createSupabaseBrowserClient(), { userId, messageId, reason, note });
    if (err) { setError(err); setState("idle"); return; }
    setState("done");
  }

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Report">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="rounded-[24px] bg-white p-5 shadow-2xl ring-1 ring-slate-200">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-rose-600" aria-hidden />
              <p className="text-base font-black text-slate-900">{messageId ? "Report this message" : `Report ${userName}`}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" aria-hidden /></button>
          </div>

          {state === "done" ? (
            <div className="space-y-3 text-center">
              <p className="text-sm font-bold text-slate-800">Thanks — our moderators will look at this.</p>
              <p className="text-xs text-slate-500">Your report is private. {userName} won&apos;t be told who reported them.</p>
              {onBlock && (
                <button type="button" onClick={onBlock} className="w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-700">
                  Also block {userName}
                </button>
              )}
              <button type="button" onClick={onClose} className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-200">Done</button>
            </div>
          ) : (
            <>
              {preview && <p className="mb-3 line-clamp-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">“{preview}”</p>}
              <fieldset className="space-y-1.5">
                <legend className="sr-only">Reason</legend>
                {DM_REASONS.map((r) => (
                  <label key={r.id} className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 ${reason === r.id ? "bg-rose-50 text-rose-800 ring-rose-300" : "bg-white text-slate-700 ring-slate-200"}`}>
                    <input type="radio" name="dm-reason" checked={reason === r.id} onChange={() => setReason(r.id)} className="accent-rose-600" />
                    {r.label}
                  </label>
                ))}
              </fieldset>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Anything else we should know? (optional)"
                className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-rose-400" />
              {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
              <button type="button" onClick={() => void send()} disabled={state === "sending"}
                className="mt-3 w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-50">
                {state === "sending" ? "Sending…" : "Send report"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
