"use client";

/**
 * PwaInstall — registers the service worker and shows a slim "Install Qubit Learn" banner when the browser says the
 * app can be installed. The install prompt itself lives in lib/pwaInstall so the landing page can use it too.
 * On iOS Safari (no install prompt API) the banner never shows — the landing page's Download section explains it.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { getInstallState, getServerInstallState, initInstallCapture, promptInstall, subscribeInstall } from "@/lib/pwaInstall";

const DISMISS_KEY = "qubit_install_dismissed";
const WEEK = 7 * 24 * 60 * 60 * 1000;

export default function PwaInstall() {
  const { canPrompt, installed } = useSyncExternalStore(subscribeInstall, getInstallState, getServerInstallState);
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    initInstallCapture();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // SW registration failure is non-fatal
      });
    }
  }, []);

  // Don't pop up immediately (it would clash with page load) and respect a recent "dismiss" for a week
  useEffect(() => {
    if (!canPrompt) return;
    let dismissedAt = 0;
    try {
      dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    } catch { /* storage blocked */ }
    if (Date.now() - dismissedAt <= WEEK) return;
    const t = window.setTimeout(() => setReady(true), 5000);
    return () => window.clearTimeout(t);
  }, [canPrompt]);

  if (!canPrompt || !ready || installed || hidden) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Qubit Learn"
      className="fixed bottom-20 left-1/2 z-[200] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-[20px] bg-white p-4 shadow-2xl ring-1 ring-violet-200 lg:bottom-6"
    >
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-96.png" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900">Install Qubit Learn</p>
          <p className="text-xs text-slate-500">Works offline · No app store needed</p>
        </div>
        <button
          type="button"
          onClick={() => {
            void promptInstall().then(() => setHidden(true));
          }}
          className="shrink-0 rounded-full bg-violet-600 px-4 py-2 text-xs font-black text-white hover:bg-violet-700"
        >
          Install
        </button>
        <button
          type="button"
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem(DISMISS_KEY, String(Date.now()));
            } catch { /* storage blocked */ }
          }}
          aria-label="Dismiss"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
