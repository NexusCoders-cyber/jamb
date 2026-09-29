"use client";

/**
 * Avatar — shows the user's uploaded image when available, otherwise initials.
 * Consistent across messages, community, profiles and the nav bar.
 */

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-11 w-11 text-base",
  xl: "h-20 w-20 text-2xl",
} as const;

const RING_SIZES = {
  xs: "h-2 w-2",
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-3.5 w-3.5",
  xl: "h-5 w-5",
} as const;

export type AvatarUser = {
  full_name?: string | null;
  avatar_url?: string | null;
};

export default function Avatar({
  user,
  size = "md",
  className = "",
}: {
  user: AvatarUser | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const name = user?.full_name?.trim() || "Student";
  const initial = name.slice(0, 1).toUpperCase();
  const url = user?.avatar_url?.trim() || null;

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className={`${SIZES[size]} shrink-0 rounded-full object-cover ring-1 ring-slate-200 ${className}`}
        // Hide broken images (stale URL after bucket cleanup) → initials remain
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-violet-100 font-black text-violet-700 ${SIZES[size]} ${className}`}
      aria-hidden
    >
      {initial}
    </span>
  );
}

export { RING_SIZES };
