"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Download, Share, SquarePlus } from "lucide-react";
import {
  detectPlatform,
  getInstallState,
  getServerInstallState,
  initInstallCapture,
  promptInstall,
  subscribeInstall,
  type Platform,
} from "@/lib/pwaInstall";

/**
 * "Install" button for the landing page's Download section. One tap installs when the browser allows it;
 * otherwise it shows the exact steps for this phone/computer (iPhone, Android menu, desktop address bar).
 */
export default function InstallButton({ tone }: { tone: "light" | "dark" }) {
  const { canPrompt, installed } = useSyncExternalStore(subscribeInstall, getInstallState, getServerInstallState);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [help, setHelp] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    initInstallCapture();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(detectPlatform());
  }, []);

  const base = "mt-4 flex h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-full text-sm font-black";
  const style = tone === "light" ? `${base} bg-white text-slate-900` : `${base} bg-slate-900 text-white`;

  if (installed) {
    return (
      <Link href="/dashboard" className={style}>
        <CheckCircle2 className="h-4 w-4" aria-hidden /> Installed — open Qubit
      </Link>
    );
  }

  async function onClick() {
    setNote("");
    if (canPrompt) {
      const result = await promptInstall();
      if (result === "dismissed") setNote("No problem — you can install any time from here.");
      if (result === "unavailable") setHelp(true);
      return;
    }
    setHelp((v) => !v);
  }

  const text = tone === "light" ? "text-white" : "text-slate-700";

  return (
    <div>
      <button type="button" onClick={() => void onClick()} className={style}>
        <Download className="h-4 w-4" aria-hidden /> {canPrompt ? "Install app" : "How to install"}
      </button>
      {note && <p className={`mt-2 text-xs ${text}`}>{note}</p>}
      {help && (
        <ol className={`mt-3 space-y-1.5 rounded-2xl bg-black/10 p-3 text-xs leading-5 ${text}`}>
          {platform === "ios" ? (
            <>
              <li>1. Open this page in <strong>Safari</strong>.</li>
              <li className="flex flex-wrap items-center gap-1">2. Tap the Share button <Share className="inline h-3.5 w-3.5" aria-hidden /></li>
              <li className="flex flex-wrap items-center gap-1">3. Choose <strong>Add to Home Screen</strong> <SquarePlus className="inline h-3.5 w-3.5" aria-hidden /></li>
            </>
          ) : platform === "android" ? (
            <>
              <li>1. Open this page in <strong>Chrome</strong>.</li>
              <li>2. Tap the <strong>⋮</strong> menu (top right).</li>
              <li>3. Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>), then <strong>Install</strong>.</li>
            </>
          ) : (
            <>
              <li>1. Use <strong>Chrome</strong> or <strong>Edge</strong>.</li>
              <li>2. Click the install icon at the right end of the address bar.</li>
              <li>3. Click <strong>Install</strong>.</li>
            </>
          )}
        </ol>
      )}
    </div>
  );
}
