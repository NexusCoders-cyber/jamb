"use client";

import { CloudUpload, WifiOff } from "lucide-react";
import { useSyncStatus } from "@/lib/useSync";

function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Cloud backup control. Qubit keeps results, bookmarks and unfinished exams on this device; this is the
 * one place (besides signing in and the button on a result) where they are sent to the student's account.
 */
export default function CloudBackupCard({ userId }: { userId: string }) {
  const { pending, lastSyncAt, online, syncing, result, persistent, sync } = useSyncStatus(userId);
  const parts = [
    pending.attempts > 0 && `${pending.attempts} result${pending.attempts === 1 ? "" : "s"}`,
    pending.bookmarks > 0 && `${pending.bookmarks} bookmark${pending.bookmarks === 1 ? "" : "s"}`,
    pending.deletions > 0 && `${pending.deletions} deletion${pending.deletions === 1 ? "" : "s"}`,
  ].filter(Boolean);

  return (
    <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
      <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
        <CloudUpload className="h-5 w-5 text-violet-600" aria-hidden /> Cloud backup
      </h2>
      <p className="mb-3 mt-1 text-xs leading-5 text-slate-500">
        Your results, bookmarks and unfinished exams are saved on this device and work with no internet. Back up to keep them if you change phone or clear your browser.
      </p>

      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="font-semibold text-slate-500">Waiting to back up</dt>
          <dd className="text-right font-black text-slate-900">{parts.length > 0 ? parts.join(", ") : "Nothing"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-semibold text-slate-500">Last backup</dt>
          <dd className="font-black text-slate-900">{ago(lastSyncAt)}</dd>
        </div>
      </dl>

      {!persistent && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
          This browser is not keeping data between visits (private mode?). Back up before you close the app.
        </p>
      )}
      {!online && (
        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <WifiOff className="h-4 w-4" aria-hidden /> You&apos;re offline — everything is safe on this device.
        </p>
      )}

      <button
        type="button"
        onClick={() => void sync()}
        disabled={syncing || !online}
        className="mt-4 flex h-11 w-full touch-manipulation items-center justify-center rounded-2xl bg-violet-600 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
      >
        {syncing ? "Backing up…" : "Back up now"}
      </button>

      {result && (
        <p role="status" className={`mt-3 text-xs font-semibold ${result.ok ? "text-emerald-700" : "text-amber-800"}`}>
          {result.ok
            ? result.attempts + result.bookmarksPushed + result.bookmarksPulled > 0
              ? `Done — ${result.attempts} result${result.attempts === 1 ? "" : "s"} backed up${result.bookmarksPulled > 0 ? `, ${result.bookmarksPulled} bookmark${result.bookmarksPulled === 1 ? "" : "s"} restored` : ""}.`
              : "Everything is already backed up."
            : result.message}
        </p>
      )}
    </div>
  );
}
