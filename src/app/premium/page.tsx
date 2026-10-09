"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { deviceLabel, getDeviceId } from "@/lib/device";
import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import { Crown, Loader2, Tag, Zap } from "lucide-react";

type Plan = "lifetime" | "monthly";

export default function PremiumPage() {
  const { user, loading: authLoading } = useUser();
  const [lifetimeNaira, setLifetimeNaira] = useState<number | null>(null);
  const [monthlyNaira, setMonthlyNaira] = useState<number | null>(null);
  const [plan, setPlan] = useState<Plan>("lifetime");
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [applied, setApplied] = useState<{ finalNaira: number; message: string } | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const [codeMsg, setCodeMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createSupabaseBrowserClient();
    fetch("/api/premium/config").then((r) => r.json()).then((c: { lifetimeNaira?: number; monthlyNaira?: number }) => {
      setLifetimeNaira(c.lifetimeNaira ?? 1000);
      setMonthlyNaira(c.monthlyNaira ?? 500);
    });
    supabase.from("profiles").select("premium_lifetime, premium_until").eq("id", user.id).single()
      .then(({ data }) => {
        const p = (data as { premium_lifetime?: boolean; premium_until?: string | null } | null);
        setIsPremium(Boolean(p?.premium_lifetime || (p?.premium_until && new Date(p.premium_until) > new Date())));
      });
  }, [user]);

  const base = plan === "lifetime" ? lifetimeNaira : monthlyNaira;

  // Switching plans invalidates a previously applied discount preview
  useEffect(() => {
    setApplied(null);
    setCodeMsg(null);
  }, [plan]);

  // Live discount-code validation against the DB — shows the new price before paying
  async function applyCode() {
    if (!code.trim() || checkingCode) return;
    setCheckingCode(true);
    setCodeMsg(null);
    setApplied(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/payments/discount-check", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ code: code.trim(), plan, baseNaira: base ?? 0 }),
      });
      const d = (await res.json()) as { valid?: boolean; finalNaira?: number; message?: string; error?: string };
      if (res.ok && d.valid) {
        setApplied({ finalNaira: d.finalNaira ?? 0, message: d.message ?? "Discount applied" });
      } else {
        setCodeMsg(d.message ?? d.error ?? "That code could not be applied.");
      }
    } catch (_e) {
      setCodeMsg("Could not check the code. Try again.");
    } finally {
      setCheckingCode(false);
    }
  }

  async function checkout() {
    if (!user || checking) return;
    setChecking(true);
    setMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/premium/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ plan, discountCode: code.trim() || undefined, deviceId: await getDeviceId(), label: deviceLabel() }),
      });
      const json = (await res.json()) as { authorizationUrl?: string; amountNaira?: number; discountNaira?: number; error?: string };
      if (!res.ok || !json.authorizationUrl) throw new Error(json.error ?? "Could not start payment");
      window.location.href = json.authorizationUrl;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not start payment");
      setChecking(false);
    }
  }

  return (
    <AppShell title="Go Premium">
      <AuthGuard user={user} loading={authLoading}>
        <div className="mx-auto max-w-2xl px-4 py-4 lg:px-6">
          <div className="mb-5 overflow-hidden rounded-[28px] bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white shadow-xl shadow-amber-200/40">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-amber-100">
              <Crown className="h-4 w-4" aria-hidden /> Qubit Premium
            </p>
            <h1 className="mt-2 text-3xl font-black">
              {isPremium ? "You're Premium 👑" : "Support Qubit, stand out"}
            </h1>
            <p className="mt-2 max-w-md text-sm text-amber-50">
              {isPremium
                ? "Your premium badge is active. Thanks for backing Qubit!"
                : "Get the premium badge on your profile and leaderboard, and back the platform that keeps your prep running."}
            </p>
          </div>

          {isPremium ? (
            <div className="rounded-[24px] bg-white p-6 text-center ring-1 ring-slate-200">
              <Crown className="mx-auto h-10 w-10 text-amber-500" aria-hidden />
              <p className="mt-2 text-lg font-black text-slate-900">Premium active</p>
              <p className="mt-1 text-sm text-slate-500">Your badge shows on your profile and next to your name.</p>
            </div>
          ) : (
            <>
              {/* Plan cards */}
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                {([
                  { id: "lifetime" as Plan, title: "Lifetime", desc: "Pay once, premium forever", price: lifetimeNaira, badge: "Best value" },
                  { id: "monthly" as Plan, title: "Monthly", desc: "30 days of premium, renew anytime", price: monthlyNaira, badge: null },
                ]).map((p) => (
                  <button key={p.id} type="button" onClick={() => setPlan(p.id)}
                    className={`rounded-[24px] p-5 text-left ring-2 transition ${plan === p.id ? "bg-amber-50 ring-amber-500" : "bg-white ring-slate-200 hover:ring-amber-300"}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-base font-black text-slate-900">{p.title}</p>
                      {p.badge && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">{p.badge}</span>}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{p.desc}</p>
                    <p className="mt-3 text-3xl font-black text-slate-900">
                      {p.price === null ? "…" : `₦${p.price.toLocaleString()}`}
                    </p>
                  </button>
                ))}
              </div>

              {/* Discount code */}
              <div className="mb-4 rounded-[24px] bg-white p-4 ring-1 ring-slate-200">
                <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  <Tag className="h-3.5 w-3.5" aria-hidden /> Discount code
                </p>
                <div className="flex gap-2">
                  <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setApplied(null); setCodeMsg(null); }} placeholder="e.g. JAMB2026"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold uppercase tracking-wider outline-none focus:border-violet-400" />
                  <button type="button" onClick={() => void applyCode()} disabled={checkingCode || !code.trim()}
                    className="shrink-0 rounded-xl bg-violet-600 px-4 text-xs font-black text-white transition hover:bg-violet-700 disabled:opacity-50">
                    {checkingCode ? "Checking…" : "Apply"}
                  </button>
                  <span className="flex shrink-0 items-center rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-700">
                    ₦{(applied?.finalNaira ?? base ?? 0).toLocaleString()}
                  </span>
                </div>
                {applied && (
                  <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                    ✅ {applied.message} — pay ₦{applied.finalNaira.toLocaleString()}
                  </p>
                )}
                {codeMsg && <p className="mt-2 text-xs font-semibold text-rose-600">{codeMsg}</p>}
                {!applied && !codeMsg && <p className="mt-2 text-[11px] text-slate-400">Tap Apply to check the code — validated securely before you pay.</p>}
              </div>

              {message && <p className="mb-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">{message}</p>}

              <button type="button" onClick={() => void checkout()} disabled={checking || base === null}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-base font-black text-white shadow-lg shadow-amber-200/50 transition hover:bg-amber-600 disabled:opacity-50">
                {checking ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Zap className="h-5 w-5" aria-hidden />}
                {checking ? "Opening Paystack…" : `Pay ₦${(applied?.finalNaira ?? base ?? 0).toLocaleString()} with Paystack`}
              </button>
              <p className="mt-3 text-center text-xs text-slate-400">Secure checkout via Paystack · card, bank transfer & USSD</p>
            </>
          )}
        </div>
      </AuthGuard>
    </AppShell>
  );
}
