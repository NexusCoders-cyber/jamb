"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import ProBadge from "@/components/ProBadge";
import { useUser } from "@/lib/useUser";
import { usePro } from "@/lib/usePro";

// ─── Types ────────────────────────────────────────────────────────────────────
type PlanId = "weekly" | "monthly" | "biannual";

type Plan = {
  id: PlanId;
  label: string;
  price: string;
  naira: number;
  duration: string;
  badge?: string;
  highlight?: boolean;
};

type LivePrices = {
  weekly: number;
  monthly: number;
  biannual: number;
  freeTrialEnabled: boolean;
  freeTrialDays: number;
};

// ─── What Pro includes (no ads perk) ─────────────────────────────────────────
const PRO_PERKS = [
  { icon: "✏️", label: "Unlimited practice & past questions" },
  { icon: "📝", label: "Full 180-question mock CBT exams" },
  { icon: "📖", label: "Study mode — see answer after each question" },
  { icon: "📊", label: "Full analytics & weak-subject tracking" },
  { icon: "🎯", label: "Mistake bank & personalised review" },
  { icon: "⭐", label: "Pro badge on your profile" },
  { icon: "💬", label: "Community & Arena always free" },
];

// ─── Paystack inline popup type ───────────────────────────────────────────────
declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: {
        key: string;
        email: string;
        amount: number;
        ref: string;
        currency?: string;
        onClose: () => void;
        callback: (resp: { reference: string }) => void;
      }) => { openIframe: () => void };
    };
  }
}

// ─── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen({ premiumUntil, plan, isTrial }: { premiumUntil: string | null; plan: string; isTrial?: boolean }) {
  const planLabel: Record<string, string> = { weekly: "7-day", monthly: "30-day", biannual: "6-month" };
  const until = premiumUntil
    ? new Date(premiumUntil).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })
    : null;
  return (
    <AppShell title={isTrial ? "Free Trial Active!" : "You're Pro!"}>
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12 text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber-50 text-5xl ring-4 ring-amber-200">
          {isTrial ? "🎁" : "⭐"}
        </div>
        <h1 className="text-3xl font-black text-slate-900">
          {isTrial ? "Free trial activated!" : "You're Pro!"}
        </h1>
        <p className="mt-3 text-base text-slate-500">
          {isTrial
            ? `Your free trial is active.`
            : `Your ${planLabel[plan] ?? plan} subscription is active.`}
          {until && <> Access expires on <strong>{until}</strong>.</>}
        </p>
        <div className="mt-4">
          <ProBadge isPro size="md" />
        </div>
        <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
          <Link href="/practice"
            className="flex h-12 items-center justify-center rounded-2xl bg-violet-600 text-sm font-black text-white shadow-lg shadow-violet-400/30">
            Start practising ✏️
          </Link>
          <Link href="/exam"
            className="flex h-12 items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white">
            Take a mock exam 📝
          </Link>
          <Link href="/dashboard"
            className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700">
            Go to dashboard
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

// ─── Main upgrade page ────────────────────────────────────────────────────────
function UpgradePageContent() {
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useUser();
  const { isPro, loading: proLoading, premiumUntil, refresh } = usePro();

  // Live prices from admin_settings
  const [livePrices, setLivePrices] = useState<LivePrices | null>(null);
  const [pricesLoading, setPricesLoading] = useState(true);

  useEffect(() => {
    fetch("/api/payments/prices")
      .then((r) => r.json())
      .then((d: LivePrices) => { setLivePrices(d); })
      .catch(() => setLivePrices({ weekly: 200, monthly: 800, biannual: 1700, freeTrialEnabled: false, freeTrialDays: 1 }))
      .finally(() => setPricesLoading(false));
  }, []);

  // Build plans dynamically from live prices
  const plans: Plan[] = livePrices ? [
    { id: "weekly",   label: "Weekly",  price: `₦${livePrices.weekly.toLocaleString()}`,   naira: livePrices.weekly,   duration: "7 days" },
    { id: "monthly",  label: "Monthly", price: `₦${livePrices.monthly.toLocaleString()}`,  naira: livePrices.monthly,  duration: "30 days", badge: "Most popular", highlight: true },
    { id: "biannual", label: "6-Month", price: `₦${livePrices.biannual.toLocaleString()}`, naira: livePrices.biannual, duration: "180 days", badge: "Best value" },
  ] : [
    { id: "weekly",   label: "Weekly",  price: "₦200",   naira: 200,  duration: "7 days" },
    { id: "monthly",  label: "Monthly", price: "₦800",   naira: 800,  duration: "30 days", badge: "Most popular", highlight: true },
    { id: "biannual", label: "6-Month", price: "₦1,700", naira: 1700, duration: "180 days", badge: "Best value" },
  ];

  const [selectedPlan, setSelectedPlan] = useState<PlanId>("monthly");
  const [discountCode, setDiscountCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; finalNaira: number; discountNaira: number; message: string } | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [error, setError] = useState("");
  const [successPlan, setSuccessPlan] = useState<string | null>(null);
  const [successUntil, setSuccessUntil] = useState<string | null>(null);
  const [isTrial, setIsTrial] = useState(false);
  const paystackScriptRef = useRef(false);

  // Switching plans invalidates a previously applied discount preview
  useEffect(() => {
    setApplied(null);
    setCodeMsg(null);
  }, [selectedPlan]);

  // Load Paystack inline JS once
  useEffect(() => {
    if (paystackScriptRef.current) return;
    paystackScriptRef.current = true;
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, []);

  // Auto-verify if returning from Paystack redirect
  const verifyRef = useRef(false);
  const verifyPayment = useCallback(async (ref: string) => {
    if (verifyRef.current) return;
    verifyRef.current = true;
    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: ref }),
      });
      const data = (await res.json()) as { ok?: boolean; plan?: string; premiumUntil?: string; error?: string };
      if (res.ok && data.ok) {
        refresh();
        setSuccessPlan(data.plan ?? "monthly");
        setSuccessUntil(data.premiumUntil ?? null);
      } else {
        setError(data.error ?? "Payment verification failed. Contact support if money was deducted.");
      }
    } catch (_e) {
      setError("Could not verify payment. Contact support if money was deducted.");
    }
  }, [refresh]);

  useEffect(() => {
    const ref = searchParams.get("reference") ?? searchParams.get("trxref");
    if (ref) void verifyPayment(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Free trial claim
  async function claimFreeTrial() {
    if (!user) { setError("Sign in first to claim your free trial."); return; }
    setTrialLoading(true); setError("");
    try {
      const res = await fetch("/api/payments/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as { ok?: boolean; premiumUntil?: string; error?: string };
      if (res.ok && data.ok) {
        refresh();
        setIsTrial(true);
        setSuccessPlan("trial");
        setSuccessUntil(data.premiumUntil ?? null);
      } else {
        setError(data.error ?? "Could not activate free trial. Try again.");
      }
    } catch (_e) {
      setError("Something went wrong. Try again.");
    } finally {
      setTrialLoading(false);
    }
  }

  // Live discount-code validation — shows the new price before paying
  async function applyCode() {
    const code = discountCode.trim();
    if (!code || checkingCode) return;
    setCheckingCode(true);
    setCodeMsg(null);
    setApplied(null);
    try {
      const res = await fetch("/api/payments/discount-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, plan: selectedPlan, baseNaira: currentPlan?.naira ?? 0 }),
      });
      const d = (await res.json()) as {
        valid?: boolean;
        finalNaira?: number;
        discountNaira?: number;
        message?: string;
        error?: string;
      };
      if (res.ok && d.valid) {
        setApplied({
          code: code.toUpperCase(),
          finalNaira: d.finalNaira ?? 0,
          discountNaira: d.discountNaira ?? 0,
          message: d.message ?? "Discount applied",
        });
      } else {
        setCodeMsg(d.message ?? d.error ?? "That code could not be applied.");
      }
    } catch (_e) {
      setCodeMsg("Could not check the code. Try again.");
    } finally {
      setCheckingCode(false);
    }
  }

  async function handleCheckout() {
    if (!user) { setError("Sign in first to subscribe."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan, code: discountCode.trim() || undefined }),
      });
      const data = (await res.json()) as {
        authorizationUrl?: string;
        reference?: string;
        publicKey?: string;
        amountKobo?: number;
        error?: string;
      };
      if (!res.ok || !data.reference) {
        setError(data.error ?? "Could not start checkout. Try again.");
        setLoading(false);
        return;
      }

      // Inline popup → redirect fallback
      if (window.PaystackPop && data.publicKey) {
        const handler = window.PaystackPop.setup({
          key: data.publicKey,
          email: user.email ?? "",
          amount: data.amountKobo ?? 0,
          ref: data.reference,
          currency: "NGN",
          onClose: () => setLoading(false),
          callback: async (resp) => {
            setLoading(true);
            await verifyPayment(resp.reference);
            setLoading(false);
          },
        });
        handler.openIframe();
      } else if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        setError("Payment could not be opened. Try again.");
        setLoading(false);
      }
    } catch (_e) {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  // Show success screen
  if (successPlan) {
    return <SuccessScreen plan={successPlan} premiumUntil={successUntil} isTrial={isTrial} />;
  }

  const isReady = !authLoading && !proLoading && !pricesLoading;
  const currentPlan = plans.find((p) => p.id === selectedPlan) ?? plans[1];

  return (
    <AppShell title="Upgrade to Pro">
      <div className="mx-auto max-w-2xl px-4 py-6 lg:px-6">

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-3xl ring-4 ring-amber-100">
            ⭐
          </div>
          <h1 className="text-3xl font-black text-slate-900">Upgrade to Pro</h1>
          <p className="mt-2 text-sm text-slate-500">
            Unlock everything — unlimited practice, mock exams, analytics and more.
          </p>
          {isReady && isPro && premiumUntil && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 ring-1 ring-emerald-200">
              <ProBadge isPro />
              <span className="text-sm font-bold text-emerald-700">
                Active until{" "}
                {new Date(premiumUntil).toLocaleDateString("en-NG", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Free trial banner */}
        {isReady && !isPro && livePrices?.freeTrialEnabled && (
          <div className="mb-5 rounded-[20px] bg-emerald-50 p-4 ring-1 ring-emerald-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-emerald-800">
                  🎁 Free {livePrices.freeTrialDays}-day trial available!
                </p>
                <p className="mt-0.5 text-xs text-emerald-600">
                  Try Pro free for {livePrices.freeTrialDays} day{livePrices.freeTrialDays !== 1 ? "s" : ""} — no payment needed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void claimFreeTrial()}
                disabled={trialLoading || !user}
                className="shrink-0 rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {trialLoading ? "Activating…" : "Claim free trial"}
              </button>
            </div>
          </div>
        )}

        {/* Perks */}
        <div className="mb-6 rounded-[24px] bg-white p-5 ring-1 ring-slate-200 shadow-sm">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-violet-600">What you get</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {PRO_PERKS.map((p) => (
              <div key={p.label} className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-base ring-1 ring-slate-100">
                  {p.icon}
                </span>
                <span className="text-sm font-semibold text-slate-700">{p.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Plan selector */}
        <div className="mb-5">
          <p className="mb-3 text-sm font-black text-slate-800">Choose your plan</p>
          {pricesLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((n) => <div key={n} className="h-24 animate-pulse rounded-[20px] bg-slate-100" />)}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative rounded-[20px] border-2 p-4 text-center transition ${
                    selectedPlan === plan.id
                      ? "border-violet-500 bg-violet-50"
                      : "border-slate-200 bg-white hover:border-violet-200"
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-violet-600 px-2 py-0.5 text-[9px] font-black text-white">
                      {plan.badge}
                    </span>
                  )}
                  <p className="text-xs font-bold text-slate-500">{plan.label}</p>
                  <p className={`mt-1.5 text-2xl font-black ${selectedPlan === plan.id ? "text-violet-700" : "text-slate-900"}`}>
                    {plan.price}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{plan.duration}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Discount code */}
        <div className="mb-5">
          <span className="text-xs font-bold text-slate-500">Discount code (optional)</span>
          <div className="mt-1.5 flex gap-2">
            <input
              type="text"
              value={discountCode}
              onChange={(e) => {
                setDiscountCode(e.target.value.toUpperCase());
                setApplied(null);
                setCodeMsg(null);
              }}
              placeholder="e.g. JAMB2026"
              className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold uppercase text-slate-800 outline-none focus:border-violet-400 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => void applyCode()}
              disabled={checkingCode || !discountCode.trim()}
              className="h-11 shrink-0 rounded-xl bg-violet-600 px-5 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {checkingCode ? "Checking…" : "Apply"}
            </button>
          </div>
          {applied ? (
            <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
              ✅ {applied.code}: {applied.message} — pay ₦{applied.finalNaira.toLocaleString()}
              {applied.discountNaira > 0 && <> instead of ₦{currentPlan?.naira.toLocaleString()}</>}
            </p>
          ) : codeMsg ? (
            <p className="mt-2 text-xs font-semibold text-rose-600">{codeMsg}</p>
          ) : (
            <p className="mt-2 text-[11px] text-slate-400">Tap Apply to check the code — the price updates before you pay.</p>
          )}
        </div>

        {/* Payment method note */}
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
          <span className="text-lg">🏦</span>
          <p className="text-xs text-slate-600">
            <strong className="font-bold text-slate-800">Pay your way.</strong>{" "}
            Card, bank transfer, USSD — every channel active on our Paystack account is available at checkout. Pro activates once payment is confirmed.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* CTA */}
        {!user && isReady ? (
          <Link href="/?next=/upgrade"
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-violet-600 text-base font-black text-white shadow-lg shadow-violet-400/30">
            Sign in to subscribe
          </Link>
        ) : isPro && isReady ? (
          <button
            type="button"
            onClick={() => void handleCheckout()}
            disabled={loading}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-base font-black text-white shadow-lg shadow-amber-400/30 disabled:opacity-60"
          >
            {loading ? "Processing…" : `Extend Pro — ₦${(applied?.finalNaira ?? currentPlan?.naira ?? 0).toLocaleString()} for ${currentPlan?.duration ?? ""}`}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleCheckout()}
            disabled={loading || !isReady}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 text-base font-black text-white shadow-lg shadow-violet-400/30 disabled:opacity-60"
          >
            {loading ? "Opening payment…" : `Pay — ₦${(applied?.finalNaira ?? currentPlan?.naira ?? 0).toLocaleString()}${applied ? " ✅" : " (bank transfer)"} ⭐`}
          </button>
        )}

        <p className="mt-3 text-center text-xs text-slate-400">
          Secured by Paystack · No auto-renewal
        </p>

        {isReady && isPro && (
          <div className="mt-8 rounded-[20px] bg-emerald-50 p-4 text-center ring-1 ring-emerald-200">
            <p className="text-sm font-bold text-emerald-800">You&apos;re already Pro ⭐</p>
            <p className="mt-1 text-xs text-emerald-600">Use the button above to extend your subscription at any time.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
      </div>
    }>
      <UpgradePageContent />
    </Suspense>
  );
}
