"use client";

/**
 * AdminShell — layout for /admin/* pages.
 *
 * - Full-width admin chrome (no student sidebar/bottom nav).
 * - Section nav: Dashboard, Users, Exams, Community, Blog.
 * - Non-admins see a lock card (role is verified against Supabase; RLS is the
 *   real gate — this UI is convenience, not security).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { useAdminRole } from "@/lib/useAdminRole";
import Avatar from "@/components/Avatar";
import Logo from "@/components/Logo";

const SECTIONS = [
  { label: "Dashboard",     href: "/admin",                icon: "▦" },
  { label: "Users",         href: "/admin/users",          icon: "◉" },
  { label: "Messages",      href: "/admin/messages",       icon: "✉" },
  { label: "Exams",         href: "/admin/exams",          icon: "▤" },
  { label: "Reports",       href: "/admin/reports",        icon: "⚑" },
  { label: "Message reports", href: "/admin/dm-reports",   icon: "⚐" },
  { label: "Syllabus",      href: "/admin/syllabus",       icon: "✦" },
  { label: "Announcements", href: "/admin/announcements",  icon: "❢" },
  { label: "Promos",        href: "/admin/promos",         icon: "★" },
  { label: "Community",     href: "/admin/community",      icon: "◈" },
  { label: "Arena & QPoints", href: "/admin/quiz",        icon: "⚔" },
  { label: "Achievements",  href: "/admin/achievements",   icon: "🏆" },
  { label: "Payments",      href: "/admin/payments",       icon: "₦" },
  { label: "Blog",          href: "/admin/blog",           icon: "✎" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isAdmin, loading } = useAdminRole();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-violet-500" />
      </div>
);
  }

  if (!user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm rounded-[28px] bg-slate-900 p-8 text-center ring-1 ring-slate-800">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/15">
            <Lock className="h-8 w-8 text-violet-400" aria-hidden />
          </div>
          <h2 className="text-xl font-black text-white">Admin portal</h2>
          <p className="mt-2 text-sm text-slate-400">Sign in to continue.</p>
          <Link
            href={`/?next=${encodeURIComponent(pathname)}`}
            className="mt-6 flex h-11 items-center justify-center rounded-2xl bg-violet-600 text-sm font-bold text-white hover:bg-violet-500"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm rounded-[28px] bg-slate-900 p-8 text-center ring-1 ring-slate-800">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15">
            <Lock className="h-8 w-8 text-rose-400" aria-hidden />
          </div>
          <h2 className="text-xl font-black text-white">Admins only</h2>
          <p className="mt-2 text-sm text-slate-400">
            Your account doesn&apos;t have admin access. Ask an existing admin to promote you
            (<code className="rounded bg-slate-800 px-1 text-xs">profiles.role = &apos;admin&apos;</code>).
          </p>
          <Link href="/dashboard" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-violet-400 hover:text-violet-300">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to app
          </Link>
        </div>
      </main>
    );
  }

  const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "Admin";
  const email = user.email ?? "";

  return (
    <div className="min-h-dvh bg-slate-950 lg:pl-60">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-slate-800 bg-slate-900/60 backdrop-blur lg:flex">
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-800 px-5">
          <Logo size={36} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-violet-400">Qubit Learn</p>
            <p className="text-sm font-black text-white">Admin Portal</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {SECTIONS.map((s) => {
            const active =
              s.href === "/admin" ? pathname === "/admin" : pathname.startsWith(s.href);
            return (
              <Link
                key={s.href}
                href={s.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                  active
                    ? "bg-violet-600/20 text-violet-300 ring-1 ring-violet-500/30"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <span aria-hidden className="w-4 text-center">{s.icon}</span>
                {s.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <Avatar user={{ full_name: name, avatar_url: null }} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{name}</p>
              <p className="truncate text-xs text-slate-500">{email}</p>
            </div>
          </div>
          <Link href="/dashboard" className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to app
          </Link>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-800 bg-slate-950/90 px-4 backdrop-blur lg:hidden">
        <Logo size={32} />
        <h1 className="flex-1 text-base font-black text-white">Admin Portal</h1>
        <Link href="/dashboard" className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300">
          Exit
</Link>
      </header>

      {/* Mobile section tabs */}
      <div className="sticky top-14 z-30 flex gap-1 overflow-x-auto border-b border-slate-800 bg-slate-950/90 px-4 py-2 backdrop-blur lg:hidden">
        {SECTIONS.map((s) => {
          const active = s.href === "/admin" ? pathname === "/admin" : pathname.startsWith(s.href);
          return (
            <Link
              key={s.href}
              href={s.href}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                active ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
