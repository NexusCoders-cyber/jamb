"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/**
 * A slim notice shown only while the phone has no connection. Practice and mock exams keep working from the
 * device; this just tells the student why chat, duels and backups are paused — instead of failing silently.
 */
export default function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-[300] flex justify-center px-3"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <p className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-slate-900/90 px-3.5 py-2 text-xs font-bold text-white shadow-lg backdrop-blur">
        <WifiOff className="h-3.5 w-3.5" aria-hidden /> You&apos;re offline — saved questions and your progress still work
      </p>
    </div>
  );
}
