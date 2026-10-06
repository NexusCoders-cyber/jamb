"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { clearUserLocalData } from "@/lib/localDb";

/** Settings → Account: change password, privacy policy / terms, and permanent account deletion. */
export default function AccountSecurity({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<"password" | "delete" | null>(null);

  // change password
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // delete account
  const [typed, setTyped] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState("");

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (password.length < 8) return setPwMsg({ ok: false, text: "Use at least 8 characters." });
    if (password !== confirmPw) return setPwMsg({ ok: false, text: "The two passwords don't match." });
    setPwBusy(true);
    try {
      const { error } = await createSupabaseBrowserClient().auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirmPw("");
      setPwMsg({ ok: true, text: "Password updated." });
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : "Could not update the password." });
    } finally {
      setPwBusy(false);
    }
  }

  async function deleteAccount() {
    setDelError("");
    setDelBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Could not delete the account.");
      }
      await clearUserLocalData(userId);
      await supabase.auth.signOut();
      try {
        localStorage.removeItem("jamb_user");
        localStorage.removeItem(`qubit_pro:${userId}`);
      } catch { /* storage blocked */ }
      router.replace("/");
    } catch (err) {
      setDelError(err instanceof Error ? err.message : "Could not delete the account.");
      setDelBusy(false);
    }
  }

  const row = "flex min-h-12 w-full touch-manipulation items-center gap-3 rounded-2xl bg-white p-3 text-left text-sm font-semibold text-slate-700 ring-1 ring-slate-200";
  const input = "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-400";

  return (
    <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
      <h2 className="mb-4 text-xl font-black text-slate-900">Account &amp; privacy</h2>
      <div className="space-y-2">
        <button type="button" onClick={() => setOpen(open === "password" ? null : "password")} className={row} aria-expanded={open === "password"}>
          <KeyRound className="h-4 w-4 text-violet-600" aria-hidden /> Change password
          <ChevronRight className={`ml-auto h-4 w-4 text-slate-400 transition ${open === "password" ? "rotate-90" : ""}`} aria-hidden />
        </button>
        {open === "password" && (
          <form onSubmit={changePassword} className="space-y-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
            <input type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
            <input type="password" autoComplete="new-password" placeholder="Repeat new password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className={input} />
            {pwMsg && <p className={`text-xs font-semibold ${pwMsg.ok ? "text-emerald-600" : "text-rose-600"}`}>{pwMsg.text}</p>}
            <button type="submit" disabled={pwBusy} className="h-11 w-full rounded-2xl bg-violet-600 text-sm font-bold text-white disabled:opacity-60">
              {pwBusy ? "Saving…" : "Update password"}
            </button>
          </form>
        )}

        <Link href="/privacy" className={row}>
          <ShieldCheck className="h-4 w-4 text-violet-600" aria-hidden /> Privacy policy
          <ChevronRight className="ml-auto h-4 w-4 text-slate-400" aria-hidden />
        </Link>
        <Link href="/terms" className={row}>
          <ShieldCheck className="h-4 w-4 text-violet-600" aria-hidden /> Terms of use
          <ChevronRight className="ml-auto h-4 w-4 text-slate-400" aria-hidden />
        </Link>

        <button type="button" onClick={() => setOpen(open === "delete" ? null : "delete")} className={`${row} text-rose-700`} aria-expanded={open === "delete"}>
          <Trash2 className="h-4 w-4" aria-hidden /> Delete my account
          <ChevronRight className={`ml-auto h-4 w-4 text-slate-400 transition ${open === "delete" ? "rotate-90" : ""}`} aria-hidden />
        </button>
        {open === "delete" && (
          <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs leading-5 text-rose-800">
              This permanently deletes your profile, results, bookmarks and streak from our servers and removes the copy on this
              device. It can&apos;t be undone. Any active Pro time is lost.
            </p>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type DELETE to confirm" autoCapitalize="characters" className={input} />
            {delError && <p className="text-xs font-semibold text-rose-700">{delError}</p>}
            <button
              type="button"
              onClick={() => void deleteAccount()}
              disabled={typed !== "DELETE" || delBusy}
              className="h-11 w-full rounded-2xl bg-rose-600 text-sm font-bold text-white disabled:opacity-50"
            >
              {delBusy ? "Deleting…" : "Delete everything"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
