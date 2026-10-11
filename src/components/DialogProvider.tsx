"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BookOpen, Trash2 } from "lucide-react";
import type { ConfirmCopy, DialogTone, ReportReason } from "@/lib/dialogCopy";

/**
 * In-app replacements for window.confirm / window.prompt / window.alert.
 *
 * The browser's own popups always start with "The page at <site> says:", which cannot be removed.
 * These look and behave like the rest of the app instead: a bottom sheet on phones, a centred card on
 * larger screens, light and dark mode, Escape / backdrop to cancel, focus moved in and restored.
 *
 *   const { confirm, choose, notify } = useDialogs();
 *   if (!(await confirm(deleteMessageCopy))) return;
 */

export type ChooseOptions = {
  title: string;
  message?: string;
  reasons: readonly ReportReason[];
  confirmLabel?: string;
  noteLabel?: string;
};

type Api = {
  /** Resolves true when the student confirms, false on cancel / Escape / backdrop. */
  confirm: (copy: ConfirmCopy) => Promise<boolean>;
  /** Pick one reason and optionally add a note. Resolves null on cancel. */
  choose: (opts: ChooseOptions) => Promise<{ id: string; note: string } | null>;
  /** Short message at the top of the screen (replaces window.alert). */
  notify: (message: string) => void;
};

// Without a provider (tests, an unexpected tree) fall back to the browser so nothing breaks.
const fallback: Api = {
  confirm: async (copy) => (typeof window === "undefined" ? false : window.confirm(`${copy.title}\n${copy.message}`)),
  choose: async (opts) => {
    if (typeof window === "undefined") return null;
    const text = window.prompt(opts.title);
    return text?.trim() ? { id: "other", note: text.trim() } : null;
  },
  notify: (message) => { if (typeof window !== "undefined") window.alert(message); },
};

const DialogContext = createContext<Api>(fallback);
export const useDialogs = () => useContext(DialogContext);

type Request =
  | { kind: "confirm"; copy: ConfirmCopy; resolve: (v: boolean) => void }
  | { kind: "choose"; opts: ChooseOptions; resolve: (v: { id: string; note: string } | null) => void };

const TONE: Record<DialogTone, { circle: string; icon: string; Icon: typeof AlertTriangle }> = {
  info: { circle: "bg-violet-100", icon: "text-violet-700", Icon: BookOpen },
  warning: { circle: "bg-amber-100", icon: "text-amber-700", Icon: AlertTriangle },
  danger: { circle: "bg-rose-100", icon: "text-rose-600", Icon: Trash2 },
};

const FOCUSABLE = 'button:not([disabled]), textarea, input, [href], [tabindex]:not([tabindex="-1"])';

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<Request | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const queue = useRef<Request[]>([]);
  const activeRef = useRef<Request | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((req: Request) => {
    if (activeRef.current) { queue.current.push(req); return; }
    activeRef.current = req;
    setActive(req);
  }, []);

  const finish = useCallback(() => {
    const next = queue.current.shift() ?? null;
    activeRef.current = next;
    setActive(next);
  }, []);

  const api = useMemo<Api>(() => ({
    confirm: (copy) => new Promise<boolean>((resolve) => show({ kind: "confirm", copy, resolve })),
    choose: (opts) => new Promise((resolve) => show({ kind: "choose", opts, resolve })),
    notify: (text) => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ id: Date.now(), text });
      toastTimer.current = setTimeout(() => setToast(null), 3800);
    },
  }), [show]);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {active && <Sheet key={active.kind + (active.kind === "confirm" ? active.copy.title : active.opts.title)} req={active} onDone={finish} />}
      {toast && (
        <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-3 top-3 z-[110] mx-auto max-w-md" style={{ marginTop: "env(safe-area-inset-top)" }}>
          <p className="animate-fade-up rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-bold text-white shadow-xl">{toast.text}</p>
        </div>
      )}
    </DialogContext.Provider>
  );
}

function Sheet({ req, onDone }: { req: Request; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const settled = useRef(false);

  const close = useCallback((result: boolean | { id: string; note: string } | null) => {
    if (settled.current) return;
    settled.current = true;
    if (req.kind === "confirm") req.resolve(result === true);
    else req.resolve(typeof result === "object" ? result : null);
    onDone();
  }, [req, onDone]);
  const cancel = useCallback(() => close(req.kind === "confirm" ? false : null), [close, req.kind]);

  // Move focus in, lock page scroll, put focus back where it was afterwards.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const target = ref.current?.querySelector<HTMLElement>("[data-autofocus]") ?? ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
    return () => {
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.stopPropagation(); cancel(); return; }
    if (e.key !== "Tab" || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  const titleId = "dialog-title";
  const isConfirm = req.kind === "confirm";
  const title = isConfirm ? req.copy.title : req.opts.title;
  const message = isConfirm ? req.copy.message : req.opts.message;

  return (
    <div className="fixed inset-0 z-[100]" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]" onClick={cancel} aria-hidden />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center sm:items-center sm:p-4">
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}
          className="animate-sheet-up pointer-events-auto flex max-h-[92dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-[24px] bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl ring-1 ring-slate-200 sm:rounded-[24px] sm:pb-6">
          <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-slate-300 sm:hidden" aria-hidden />
          {isConfirm && <ToneIcon tone={req.copy.tone} />}
          <h2 id={titleId} className="text-xl font-extrabold leading-tight text-slate-900">{title}</h2>
          {message && <p className="text-[15px] leading-relaxed text-slate-600">{message}</p>}

          {req.kind === "confirm" ? <ConfirmButtons copy={req.copy} onConfirm={() => close(true)} onCancel={cancel} /> : (
            <>
              <fieldset className="mt-1 space-y-2">
                <legend className="sr-only">Reason</legend>
                {req.opts.reasons.map((r) => (
                  <label key={r.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-4 text-[15px] font-semibold ring-1 ${reason === r.id ? "bg-violet-50 text-violet-900 ring-2 ring-violet-600" : "bg-white text-slate-800 ring-slate-200"}`}>
                    <input type="radio" name="dialog-reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="h-4 w-4 accent-violet-600" />
                    {r.label}
                  </label>
                ))}
              </fieldset>
              <label htmlFor="dialog-note" className="mt-1 text-[13px] font-bold text-slate-600">{req.opts.noteLabel ?? "Add a note (optional)"}</label>
              <textarea id="dialog-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} rows={2} placeholder="Tell us more"
                className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-3.5 py-3 text-[15px] text-slate-900 outline-none focus:border-violet-500" />
              <div className="mt-1 flex gap-2.5">
                <button type="button" onClick={cancel} className="h-13 flex-1 rounded-2xl border border-slate-200 bg-white text-base font-bold text-slate-800 hover:bg-slate-50">Cancel</button>
                <button type="button" disabled={!reason} onClick={() => close({ id: reason, note: note.trim() })}
                  className="h-13 flex-1 rounded-2xl bg-violet-600 text-base font-bold text-white hover:bg-violet-700 disabled:opacity-50">{req.opts.confirmLabel ?? "Send report"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ToneIcon({ tone }: { tone: DialogTone }) {
  const t = TONE[tone];
  return (
    <div className={`flex h-12 w-12 items-center justify-center rounded-full ${t.circle}`} aria-hidden>
      <t.Icon className={`h-6 w-6 ${t.icon}`} />
    </div>
  );
}

function ConfirmButtons({ copy, onConfirm, onCancel }: { copy: ConfirmCopy; onConfirm: () => void; onCancel: () => void }) {
  const solidDanger = "bg-rose-600 text-white hover:bg-rose-700";
  const solidBrand = "bg-violet-600 text-white hover:bg-violet-700";
  const outline = "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50";
  const outlineDanger = "border border-slate-200 bg-white text-rose-700 hover:bg-rose-50";
  const danger = copy.tone === "danger" || copy.tone === "warning";
  const base = "h-13 w-full rounded-2xl text-base font-bold";

  const confirmBtn = (
    <button type="button" onClick={onConfirm} data-autofocus={copy.primary === "confirm" ? "" : undefined}
      className={`${base} ${copy.primary === "confirm" ? (copy.tone === "danger" ? solidDanger : solidBrand) : danger ? outlineDanger : outline}`}>{copy.confirmLabel}</button>
  );
  const cancelBtn = (
    <button type="button" onClick={onCancel} data-autofocus={copy.primary === "cancel" ? "" : undefined}
      className={`${base} ${copy.primary === "cancel" ? solidBrand : outline}`}>{copy.cancelLabel}</button>
  );
  // The big button always sits on top, the quieter one underneath.
  return (
    <div className="mt-2 flex flex-col gap-2.5">
      {copy.primary === "confirm" ? <>{confirmBtn}{cancelBtn}</> : <>{cancelBtn}{confirmBtn}</>}
    </div>
  );
}
