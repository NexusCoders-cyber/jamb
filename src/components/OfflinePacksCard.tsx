"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { downloadPack, getPackInfo, type PackInfo, type PackProgress } from "@/lib/offlinePack";
import { getStorageStatus, isIosBrowserTab, requestPersistentStorage, type StorageStatus } from "@/lib/storagePersist";

type Row = { name: string; info: PackInfo | null; busy: boolean; progress: PackProgress | null; error: string };

/** Settings → Offline packs: download a subject's questions and pictures to practise without data. */
export default function OfflinePacksCard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [iosTab, setIosTab] = useState(false);
  const cancel = useRef({ cancelled: false });

  useEffect(() => {
    let alive = true;
    const flag = cancel.current;
    void requestPersistentStorage()
      .then(() => getStorageStatus())
      .then((st) => { if (alive) { setStorage(st); setIosTab(isIosBrowserTab()); } });
    void (async () => {
      try {
        const res = (await fetch("/api/aloc?endpoint=subjects").then((r) => r.json())) as { data?: { name: string }[] };
        const names = (res.data ?? []).map((s) => s.name);
        if (names.length === 0) throw new Error("none");
        const infos = await Promise.all(names.map((n) => getPackInfo(n)));
        if (alive) setRows(names.map((name, i) => ({ name, info: infos[i], busy: false, progress: null, error: "" })));
      } catch {
        if (alive) setLoadError(true);
      }
    })();
    return () => {
      alive = false;
      flag.cancelled = true; // stop a download if the student leaves the page
    };
  }, []);

  function patch(name: string, change: Partial<Row>) {
    setRows((list) => list.map((r) => (r.name === name ? { ...r, ...change } : r)));
  }

  async function start(name: string) {
    cancel.current.cancelled = false;
    patch(name, { busy: true, error: "", progress: null });
    try {
      const info = await downloadPack(name, (p) => patch(name, { progress: p }), cancel.current);
      patch(name, { info, busy: false, progress: null });
    } catch (err) {
      patch(name, { busy: false, progress: null, error: err instanceof Error ? err.message : "Download failed." });
    }
  }

  const anyBusy = rows.some((r) => r.busy);

  return (
    <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
      <h2 className="text-xl font-black text-slate-900">Offline packs</h2>
      <p className="mb-4 mt-1 text-sm text-slate-500">
        Download a subject while you have data or Wi-Fi, then practise with no connection. Keep this page open while it downloads.
      </p>
      {storage && (
        <p className={`mb-4 rounded-xl px-3 py-2 text-xs font-semibold ${storage.persisted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
          {storage.persisted
            ? `Saved on this device${storage.usedMB != null ? ` (${storage.usedMB} MB used)` : ""} and protected from automatic clean-up.`
            : iosTab
              ? "iPhone may clear saved questions after a week of not opening the app. Tap Share → Add to Home Screen to keep them safe."
              : `Saved on this device${storage.usedMB != null ? ` (${storage.usedMB} MB used)` : ""}. Installing the app helps your phone keep it.`}
        </p>
      )}
      {loadError ? (
        <p className="text-sm font-semibold text-slate-500">Connect to the internet to see the subjects you can download.</p>
      ) : rows.length === 0 ? (
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const pct = r.progress && r.progress.total > 0 ? Math.round((r.progress.done / r.progress.total) * 100) : 0;
            return (
              <li key={r.name} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-500">
                      {r.busy
                        ? r.progress?.phase === "images"
                          ? `Saving pictures… ${pct}%`
                          : "Downloading questions…"
                        : r.info
                          ? `${r.info.questions} questions · ${r.info.images} pictures · ${new Date(r.info.at).toLocaleDateString()}`
                          : "Not downloaded"}
                    </p>
                  </div>
                  {r.info && !r.busy && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-label="Downloaded" />}
                  <button
                    type="button"
                    onClick={() => void start(r.name)}
                    disabled={anyBusy}
                    className="inline-flex h-10 shrink-0 touch-manipulation items-center gap-1.5 rounded-full bg-violet-100 px-3.5 text-xs font-bold text-violet-700 disabled:opacity-50"
                  >
                    {r.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
                    {r.info ? "Update" : "Download"}
                  </button>
                </div>
                {r.busy && r.progress?.phase === "images" && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}
                {r.error && <p className="mt-2 text-xs font-semibold text-rose-600">{r.error}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
