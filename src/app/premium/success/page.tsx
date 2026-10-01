"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

function SuccessInner() {
  const params = useSearchParams();
  const reference = params.get("reference") ?? "";
  const { user, loading: authLoading } = useUser();
  const [state, setState] = useState<"confirming" | "done" | "failed">("confirming");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user || !reference) return;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/premium/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
          body: JSON.stringify({ reference }),
        });
        const json = (await res.json()) as { ok?: boolean; plan?: string; error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error ?? "Confirmation failed");
        setState("done");
        setMessage(json.plan === "monthly" ? "Monthly premium is active for 30 days." : "Lifetime premium unlocked. Thanks for backing Qubit!");
      } catch (err) {
        setState("failed");
        setMessage(err instanceof Error ? err.message : "Confirmation failed");
      }
    })();
  }, [user, reference]);

  return (
    <div className="mx-auto max-w-lg px-4 py-10 text-center">
      {state === "confirming" && (
        <div className="rounded-[28px] bg-white p-10 ring-1 ring-slate-200">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-violet-600" aria-hidden />
          <p className="mt-4 text-lg font-black text-slate-900">Confirming your payment…</p>
          <p className="mt-1 text-sm text-slate-500">Hang tight while we verify with Paystack.</p>
        </div>
      )}
      {state === "done" && (
        <div className="rounded-[28px] bg-emerald-50 p-10 ring-1 ring-emerald-200">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
          <p className="mt-4 text-2xl font-black text-emerald-800">Payment confirmed 👑</p>
          <p className="mt-2 text-sm text-emerald-700">{message}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/profile" className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
              See my badge
            </Link>
            <Link href="/dashboard" className="rounded-full border border-emerald-300 px-5 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100">
              Dashboard
            </Link>
          </div>
        </div>
      )}
      {state === "failed" && (
        <div className="rounded-[28px] bg-rose-50 p-10 ring-1 ring-rose-200">
          <XCircle className="mx-auto h-12 w-12 text-rose-500" aria-hidden />
          <p className="mt-4 text-2xl font-black text-rose-800">Payment issue</p>
          <p className="mt-2 text-sm text-rose-700">{message}</p>
          <Link href="/premium" className="mt-6 inline-block rounded-full bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-700">
            Back to Premium
          </Link>
        </div>
      )}
    </div>
  );
}

export default function PremiumSuccessPage() {
  const { user, loading: authLoading } = useUser();
  return (
    <AppShell title="Payment">
      <AuthGuard user={user} loading={authLoading}>
        <Suspense fallback={<div className="py-16 text-center text-sm text-slate-400">Loading…</div>}>
          <SuccessInner />
        </Suspense>
      </AuthGuard>
    </AppShell>
  );
}
