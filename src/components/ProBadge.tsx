"use client";

/**
 * ProBadge — small gold chip shown next to a user's name when they are Pro.
 *
 * Usage:
 *   <ProBadge />                      — shows if current user is Pro (uses usePro hook)
 *   <ProBadge isPro={true} />         — controlled (e.g. from a server-fetched profile)
 *   <ProBadge size="sm" />            — smaller variant
 */

import { usePro } from "@/lib/usePro";

type Props = {
  /** Override — pass true/false directly instead of reading from the hook */
  isPro?: boolean;
  size?: "sm" | "md";
  className?: string;
};

export default function ProBadge({ isPro: isProProp, size = "md", className = "" }: Props) {
  const { isPro: hookPro, loading } = usePro();
  const show = isProProp !== undefined ? isProProp : hookPro;

  if (loading && isProProp === undefined) return null;
  if (!show) return null;

  const sizeClass = size === "sm"
    ? "px-1.5 py-0.5 text-[9px] gap-0.5"
    : "px-2 py-0.5 text-[10px] gap-1";

  return (
    <span
      className={`inline-flex items-center rounded-full bg-amber-100 font-black text-amber-700 ring-1 ring-amber-300 ${sizeClass} ${className}`}
      aria-label="Pro subscriber"
    >
      <span aria-hidden>⭐</span>
      PRO
    </span>
  );
}
