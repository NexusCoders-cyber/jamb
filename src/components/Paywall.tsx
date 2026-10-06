"use client";

/**
 * Paywall — full-screen gate shown to free users on locked features.
 *
 * Usage:
 *   import { PaywallGate } from "@/components/Paywall";
 *
 *   export default function PracticePage() {
 *     return (
 *       <PaywallGate feature="Practice">
 *         … your page content …
 *       </PaywallGate>
 *     );
 *   }
 *
 * When the user is Pro (or still loading) the children render normally.
 * When the user is free the full-screen upgrade wall is shown instead.
 */

import Link from "next/link";
import { usePro } from "@/lib/usePro";
import { Smartphone } from "lucide-react";
import { useUser } from "@/lib/useUser";

// ─── Feature metadata ─────────────────────────────────────────────────────────
const FEATURE_META: Record<string, { icon: string; title: string; description: string }> = {
  Practice: {
    icon: "✏️",
    title: "Practice is a Pro feature",
    description: "Practise past UTME questions across all subjects with detailed explanations.",
  },
  Exam: {
    icon: "📝",
    title: "Mock exams are a Pro feature",
    description: "Sit full timed CBT simulations — 180 questions exactly like exam day.",
  },
  Study: {
    icon: "📖",
    title: "Study mode is a Pro feature",
    description: "See the correct answer and explanation immediately after each question.",
  },
  Analytics: {
    icon: "📊",
    title: "Analytics are a Pro feature",
    description: "Track your accuracy per subject, score history and weak areas over time.",
  },
  Mistakes: {
    icon: "🎯",
    title: "Mistake bank is a Pro feature",
    description: "Review every question you got wrong and practise them again.",
  },
  Progress: {
    icon: "📈",
    title: "Progress tracking is a Pro feature",
    description: "See how far you are from your target JAMB score.",
  },
  default: {
    icon: "⭐",
    title: "This is a Pro feature",
    description: "Upgrade to Pro to unlock unlimited access to all study tools.",
  },
};

// ─── What Pro includes ────────────────────────────────────────────────────────
const PRO_PERKS = [
  "Unlimited practice sessions & past questions",
  "Full mock CBT exams (180 questions)",
  "Study mode — instant answer + explanation",
  "Detailed analytics & weak-subject tracking",
  "Mistake bank & personalised review",
  "⭐ Pro badge on your profile",
  "Community & Arena always free",
];

// ─── Paywall wall UI ──────────────────────────────────────────────────────────
function PaywallWall({ feature, deviceLocked = false, otherDevice = null }: { feature: string; deviceLocked?: boolean; otherDevice?: string | null }) {
  const meta = FEATURE_META[feature] ?? FEATURE_META.default;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {deviceLocked && (
          <div className="mb-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left" role="status">
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <div>
              <p className="text-sm font-black text-amber-900">Your Pro plan is active on another phone</p>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                {otherDevice ? `It is licensed to ${otherDevice}. ` : ""}Pro works on the phone that paid. To use Pro on this phone, upgrade here —
                this phone becomes your Pro phone and the other one returns to the free plan.
              </p>
            </div>
          </div>
        )}

        {/* Icon + heading */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-4xl ring-4 ring-amber-100">
            {meta.icon}
          </div>
          <h1 className="text-2xl font-black text-slate-900">{meta.title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{meta.description}</p>
        </div>

        {/* Perks list */}
        <div className="mb-6 rounded-[24px] bg-white p-5 ring-1 ring-slate-200 shadow-sm">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-amber-600">
            Pro includes
          </p>
          <ul className="space-y-2.5">
            {PRO_PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-2.5 text-sm text-slate-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-black text-emerald-700">
                  ✓
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>

        {/* Plans preview */}
        <div className="mb-5 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Weekly", price: "₦200", sub: "7 days" },
            { label: "Monthly", price: "₦800", sub: "30 days", highlight: true },
            { label: "6-Month", price: "₦1,700", sub: "180 days" },
          ].map((plan) => (
            <div
              key={plan.label}
              className={`rounded-2xl p-3 ring-1 ${
                plan.highlight
                  ? "bg-violet-600 text-white ring-violet-500"
                  : "bg-slate-50 text-slate-700 ring-slate-200"
              }`}
            >
              <p className={`text-[10px] font-bold uppercase tracking-wide ${plan.highlight ? "text-violet-200" : "text-slate-400"}`}>
                {plan.label}
              </p>
              <p className="mt-1 text-lg font-black">{plan.price}</p>
              <p className={`text-[10px] ${plan.highlight ? "text-violet-200" : "text-slate-400"}`}>{plan.sub}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/upgrade"
          className="flex h-13 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 py-3.5 text-base font-black text-white shadow-lg shadow-violet-400/30 transition hover:shadow-violet-400/50"
        >
          Upgrade to Pro ⭐
        </Link>
        <p className="mt-3 text-center text-xs text-slate-400">
          Chat and Arena work without Pro · Cancel anytime
        </p>
      </div>
    </div>
  );
}

// ─── PaywallGate wrapper ──────────────────────────────────────────────────────
type PaywallGateProps = {
  feature?: string;
  children: React.ReactNode;
};

export function PaywallGate({ feature = "default", children }: PaywallGateProps) {
  const { user, loading: authLoading } = useUser();
  const { isPro, loading: proLoading, deviceLocked, otherDevice } = usePro();

  // While auth or pro status is resolving, render nothing (avoids flash of wall)
  if (authLoading || proLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  // Not signed in — send to login
  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-[28px] bg-white p-8 text-center ring-1 ring-slate-200 shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-3xl">🔒</div>
          <h2 className="text-xl font-black text-slate-900">Sign in required</h2>
          <p className="mt-2 text-sm text-slate-500">Sign in first, then upgrade to Pro to access this feature.</p>
          <Link href="/" className="mt-6 flex h-11 items-center justify-center rounded-2xl bg-violet-600 text-sm font-bold text-white">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  // Free user — show the wall
  if (!isPro) {
    return <PaywallWall feature={feature} deviceLocked={deviceLocked} otherDevice={otherDevice} />;
  }

  // Pro user — render normally
  return <>{children}</>;
}

// Default export for convenience
export default PaywallGate;
