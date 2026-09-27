"use client";

/**
 * AppShell — shared layout for all authenticated app pages.
 *
 * Mobile  : fixed bottom tab bar (5 primary tabs)
 * Desktop : fixed left sidebar (full grouped nav)
 *
 * Usage: wrap any page's JSX in <AppShell title="Page title">…</AppShell>
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

// ─── Navigation data ──────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: "Learn",
    items: [
      { label: "Home",            href: "/dashboard",           icon: "🏠" },
      { label: "Practice",        href: "/practice",            icon: "✏️" },
      { label: "Study Mode",      href: "/practice?mode=study", icon: "📖" },
      { label: "Mock Exam",       href: "/exam",                icon: "📝" },
      { label: "Daily Challenge", href: "/daily-challenge",     icon: "⭐" },
      { label: "Analytics",       href: "/analytics",           icon: "📊" },
      { label: "Syllabus",        href: "/knowledge-hub",       icon: "📚" },
      { label: "Mistakes",        href: "/mistakes",            icon: "🎯" },
    ],
  },
  {
    label: "Social",
    items: [
      { label: "Community", href: "/community", icon: "💬" },
      { label: "Messages",  href: "/messages",  icon: "✉️"  },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Notifications", href: "/notifications", icon: "🔔" },
      { label: "Achievements",  href: "/achievements",  icon: "🏅" },
      { label: "Settings",      href: "/settings",      icon: "⚙️"  },
    ],
  },
];

// 5-item bottom tab bar for mobile
const TABS = [
  { label: "Home",      href: "/dashboard",  icon: "🏠", match: "/dashboard" },
  { label: "Learn",     href: "/practice",   icon: "✏️",  match: "/practice" },
  { label: "Exam",      href: "/exam",        icon: "📝", match: "/exam" },
  { label: "Chat",      href: "/community",  icon: "💬", match: "/community" },
  { label: "Me",        href: "/settings",   icon: "⚙️",  match: "/settings" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActive(href: string, pathname: string): boolean {
  const base = href.split("?")[0];
  if (base === "/dashboard") return pathname === "/dashboard";
  return pathname === base || pathname.startsWith(base + "/");
}

// ─── Sidebar (desktop) ────────────────────────────────────────────────────────

function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-slate-200/80 lg:bg-white lg:shadow-[2px_0_20px_rgba(101,87,217,0.06)]">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-100 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6557d9] text-base font-black text-white shadow-md shadow-violet-400/25">O</div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#6557d9]">ORBIT</p>
          <p className="text-base font-black leading-tight text-slate-900">Orbit Prep</p>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Sidebar navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1 px-3 text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href, pathname);
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                      active
                        ? "bg-violet-50 text-violet-700 shadow-sm ring-1 ring-violet-100"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    }`}>
                    <span className="w-5 text-center text-base leading-none">{item.icon}</span>
                    {item.label}
                    {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-500" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom hint */}
      <div className="border-t border-slate-100 p-4">
        <Link href="/practice"
          className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-3 text-white shadow-lg shadow-violet-400/30 transition hover:shadow-violet-400/50">
          <span className="text-lg">✏️</span>
          <div>
            <p className="text-xs font-black">Start practicing</p>
            <p className="text-[10px] text-violet-200">Keep your streak alive</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}

// ─── Bottom tab bar (mobile) ──────────────────────────────────────────────────

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-slate-200/80 bg-white/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Bottom navigation"
    >
      {TABS.map((tab) => {
        const active = isActive(tab.href, pathname);
        return (
          <Link key={tab.href} href={tab.href}
            className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-transform active:scale-95">
            {active && (
              <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-violet-600" />
            )}
            <span className={`text-xl leading-none ${active ? "opacity-100" : "opacity-50"}`}>{tab.icon}</span>
            <span className={`text-[10px] font-bold tracking-wide ${active ? "text-violet-700" : "text-slate-400"}`}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

// ─── Top bar (mobile, inside the shell header slot) ──────────────────────────

function TopBar({ title, back }: { title?: string; back?: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-200/60 bg-white/90 px-4 backdrop-blur-md lg:hidden">
      {back && (
        <Link href={back} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
      )}
      {!back && (
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#6557d9] text-xs font-black text-white">O</div>
      )}
      <h1 className="flex-1 truncate text-base font-black text-slate-900">{title ?? "Orbit Prep"}</h1>
    </header>
  );
}

// ─── Shell wrapper ────────────────────────────────────────────────────────────

interface AppShellProps {
  children: React.ReactNode;
  /** Page title shown in the mobile top bar */
  title?: string;
  /** If provided, shows a ← back button linking to this href (mobile only) */
  back?: string;
  /** Hide the top bar on mobile (use for pages with their own immersive header) */
  hideTopBar?: boolean;
}

export default function AppShell({ children, title, back, hideTopBar = false }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f5f4ff] lg:pl-64">
      {/* Desktop sidebar */}
      <Sidebar pathname={pathname} />

      {/* Mobile top bar */}
      {!hideTopBar && <TopBar title={title} back={back} />}

      {/* Page content — add bottom padding on mobile so content clears the tab bar */}
      <main className="min-h-screen pb-20 lg:pb-0">
        {children}
      </main>

      {/* Mobile bottom tabs */}
      <BottomNav pathname={pathname} />
    </div>
  );
}
