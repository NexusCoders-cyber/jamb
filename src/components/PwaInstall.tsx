"use client";

/**
 * PwaInstall — registers the service worker and shows a slim
 * "Add to home screen" banner when the browser fires beforeinstallprompt.
 *
 * On iOS Safari (which doesn't support the install prompt API) the banner
 * is never shown — the landing page's "Download" section guides those users.
 */

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // SW registration failure is non-fatal
      });
    }

    // Capture install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Don't show immediately — wait 5s so it doesn't clash with page load. Respect a recent "dismiss" for a week.
      let dismissedAt = 0;
      try {
        dismissedAt = Number(localStorage.getItem("qubit_install_dismissed") ?? 0);
      } catch { /* storage blocked */ }
      if (Date.now() - dismissedAt > 7 * 24 * 60 * 60 * 1000) setTimeout(() => setShow(true), 5000);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Hide if already installed as PWA
    const mq = window.matchMedia("(display-mode: standalone)");
    if (mq.matches) setInstalled(true);
    const mqHandler = (e: MediaQueryListEvent) => { if (e.matches) setInstalled(true); };
    mq.addEventListener("change", mqHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      mq.removeEventListener("change", mqHandler);
    };
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setShow(false);
    setDeferredPrompt(null);
  }

  if (!show || installed) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Qubit"
      className="fixed bottom-20 left-1/2 z-[200] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-[20px] bg-white p-4 shadow-2xl ring-1 ring-violet-200 lg:bottom-6"
    >
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-96.png" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900">Install Qubit</p>
          <p className="text-xs text-slate-500">Works offline · No app store needed</p>
        </div>
        <button
          type="button"
          onClick={() => void install()}
          className="shrink-0 rounded-full bg-violet-600 px-4 py-2 text-xs font-black text-white hover:bg-violet-700"
        >
          Install
        </button>
        <button
          type="button"
          onClick={() => {
            setShow(false);
            try {
              localStorage.setItem("qubit_install_dismissed", String(Date.now()));
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
