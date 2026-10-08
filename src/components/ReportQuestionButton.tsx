"use client";

import { useState } from "react";
import { Flag, X } from "lucide-react";
import { useUser } from "@/lib/useUser";

const REASONS: { id: string; label: string }[] = [
  { id: "wrong_answer", label: "The marked answer looks wrong" },
  { id: "typo", label: "Typo or unreadable text" },
  { id: "bad_image", label: "Picture missing or wrong" },
  { id: "unclear", label: "Question is unclear" },
  { id: "other", label: "Something else" },
];

/** "Report" a question that looks wrong. Admins see it under Admin → Reports and can hide it. */
export default function ReportQuestionButton({
  subject,
  questionId,
  prompt,
  options,
  className = "",
}: {
  subject: string;
  questionId: string;
  prompt: string;
  options: string[];
  className?: string;
}) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("wrong_answer");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  if (!user) return null;

  async function send() {
    setError("");
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError("Connect to the internet to send a report.");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/questions/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, questionId, prompt, options, reason, note }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Could not send the report.");
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the report.");
      setState("idle");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setState("idle"); setError(""); }}
        aria-label="Report this question"
        className={`inline-flex touch-manipulation items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ${className}`}
      >
        <Flag className="h-3.5 w-3.5" aria-hidden /> Report
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Report this question"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Report this question</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full bg-slate-100 p-2 text-slate-600"><X className="h-4 w-4" aria-hidden /></button>
            </div>
            {state === "done" ? (
              <div className="py-4 text-center">
                <p className="text-3xl">🙏</p>
                <p className="mt-2 text-sm font-bold text-slate-900">Thank you — we&apos;ll check it.</p>
                <button type="button" onClick={() => setOpen(false)} className="mt-4 h-11 w-full rounded-2xl bg-violet-600 text-sm font-black text-white">Done</button>
              </div>
            ) : (
              <>
                <fieldset className="space-y-2">
                  <legend className="sr-only">What is wrong?</legend>
                  {REASONS.map((r) => (
                    <label key={r.id} className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold ${reason === r.id ? "border-violet-400 bg-violet-50 text-violet-800" : "border-slate-200 text-slate-700"}`}>
                      <input type="radio" name="report-reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="accent-violet-600" />
                      {r.label}
                    </label>
                  ))}
                </fieldset>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Add a note (optional)"
                  className="mt-3 w-full rounded-2xl border border-slate-200 p-3 text-base text-slate-800 outline-none focus:border-violet-400" />
                {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
                <button type="button" onClick={() => void send()} disabled={state === "sending"}
                  className="mt-3 h-12 w-full touch-manipulation rounded-2xl bg-violet-600 text-sm font-black text-white disabled:opacity-60">
                  {state === "sending" ? "Sending…" : "Send report"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
