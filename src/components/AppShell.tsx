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
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getUnreadDMCount } from "@/lib/queries";
import { useNewArticles } from "@/lib/useNewArticles";
import type { LucideIcon } from "lucide-react";
import {
  Flame,
  Home,
  PenLine,
  BookOpen,
  FileText,
  ListChecks,
  Star,
  BarChart3,
  Library,
  Target,
  MessagesSquare,
  Mail,
  Bell,
  Newspaper,
  Trophy,
  Settings,
  UserRound,
  Swords,
  Zap,
  Crown,
  Users,
  Bookmark,
} from "lucide-react";

// ─── Navigation data ──────────────────────────────────────────────────────────

const NAV_GROUPS: { label: string; items: { label: string; href: string; icon: LucideIcon }[] }[] = [
  {
    label: "Learn",
    items: [
      { label: "Home",            href: "/dashboard",           icon: Home },
      { label: "Practice",        href: "/practice",            icon: PenLine },
      { label: "Topics",          href: "/topics",              icon: ListChecks },
      { label: "Study Mode",      href: "/practice/study",      icon: BookOpen },
      { label: "Mock Exam",       href: "/exam",                icon: FileText },
      { label: "Daily Challenge", href: "/daily-challenge",     icon: Star },
      { label: "Analytics",       href: "/analytics",           icon: BarChart3 },
      { label: "Syllabus",        href: "/knowledge-hub",       icon: Library },
      { label: "Novels",          href: "/novels",              icon: BookOpen },
      { label: "Blog",            href: "/news",                icon: Newspaper },
      { label: "Mistakes",        href: "/mistakes",            icon: Target },
      { label: "Bookmarks",       href: "/bookmarks",           icon: Bookmark },
    ],
  },
  {    label: "Social",

    items: [
      { label: "Arena",       href: "/arena",       icon: Swords },
      { label: "Leaderboard", href: "/leaderboard", icon: Zap },
      { label: "People",      href: "/people",      icon: Users },
      { label: "Community",   href: "/community",   icon: MessagesSquare },
      { label: "Messages",    href: "/messages",    icon: Mail },
    ],
  },
  {
    label: "Account",

    items: [
      { label: "Go Premium",   href: "/premium",   icon: Crown },
      { label: "Profile",       href: "/profile",       icon: UserRound },
      { label: "Notifications", href: "/notifications", icon: Bell },
      { label: "Achievements",  href: "/achievements",  icon: Trophy },
      { label: "Streaks",       href: "/streaks",       icon: Flame },
      { label: "Settings",      href: "/settings",      icon: Settings },
    ],
  },
];

// 5-item bottom tab bar for mobile
const TABS: { label: string; href: string; icon: LucideIcon; match: string }[] = [
  { label: "Home",  href: "/dashboard", icon: Home,           match: "/dashboard" },
  { label: "Learn", href: "/practice",  icon: PenLine,        match: "/practice" },
  { label: "Arena", href: "/arena",     icon: Swords,         match: "/arena" },
  { label: "Chat",  href: "/messages",  icon: Mail,           match: "/messages" },
  { label: "Me",    href: "/profile",   icon: Settings,       match: "/profile" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function isActive(href: string, pathname: string): boolean {
  const base = href.split("?")[0];
  if (base === "/dashboard") return pathname === "/dashboard";
  return pathname === base || pathname.startsWith(base + "/");
}

/** Live unread-DM count for the Chat tab badge. */
function useUnreadDMCount(): number {
  const { user } = useUser();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) { setUnread(0); return; }
    let mounted = true;
    const supabase = createSupabaseBrowserClient();

    const load = () => {
      getUnreadDMCount(supabase, user.id).then((n) => {
        if (mounted) setUnread(n);
      }).catch(() => undefined);
    };
    load();

    // Refresh on realtime DM inserts + when the tab regains focus.
    // Unique name per mount — a fixed name can return an already-subscribed
    // channel on StrictMode/Fast Refresh remounts (removeChannel is async),
    // which throws "cannot add postgres_changes callbacks after subscribe()".
    const channelName = `dm-unread-badge-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, () => load())
      .subscribe();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);

    return () => {
      mounted = false;
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [user]);

  return unread;
}

/** Live count of pending duel invites — powers the red Arena badge. */
function usePendingInviteCount(): number {
  const { user } = useUser();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) { setCount(0); return; }
    let mounted = true;
    const supabase = createSupabaseBrowserClient();

    const load = async () => {
      try {
        const { count: n } = await supabase
          .from("quiz_invites")
          .select("id", { count: "exact", head: true })
          .eq("to_id", user.id)
          .eq("status", "pending");
        if (mounted) setCount(n ?? 0);
      } catch { /* offline — badge updates on the next tick */ }
    };
    load();

    // Realtime insert fires once quiz_invites joins the supabase_realtime
    // publication (see supabase/duel_upgrades.sql); until then a 20s poll
    // keeps the badge fresh.
    const channel = supabase
      .channel(`arena-invite-badge-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_invites" }, () => load())
      .subscribe();
    const t = setInterval(load, 20_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);

    return () => {
      mounted = false;
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [user]);

  return count;
}

// ─── Sidebar (desktop) ────────────────────────────────────────────────────────

function Sidebar({ pathname, inviteCount, newArticles }: { pathname: string; inviteCount: number; newArticles: number }) {
  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-slate-200/80 lg:bg-white lg:shadow-[2px_0_20px_rgba(101,87,217,0.06)]">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-slate-100 px-5">
        <Logo size={36} />
        <p className="text-base font-black leading-tight text-slate-900">Qubit</p>
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
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-violet-50 text-violet-700 shadow-sm ring-1 ring-violet-100"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    }`}>
                    <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} aria-hidden />
                    {item.label}
                    {item.href === "/arena" && inviteCount > 0 ? (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
                        {inviteCount > 9 ? "9+" : inviteCount}
                      </span>
                    ) : item.href === "/news" && newArticles > 0 ? (
                      <span className="ml-auto rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">NEW</span>
                    ) : (
                      active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-500" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom hint */}
      <div className="border-t border-slate-100 p-4">
        <ThemeToggle variant="switch" className="mb-3" />
        <Link href="/practice"
          className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-3 text-white shadow-lg shadow-violet-400/30 transition hover:shadow-violet-400/50">
          <PenLine className="h-5 w-5 shrink-0" aria-hidden />
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

function BottomNav({ pathname, unread, inviteCount }: { pathname: string; unread: number; inviteCount: number }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around border-t border-slate-200/80 bg-white/95 backdrop-blur-md lg:hidden"
      // 4rem of tappable tabs PLUS the home-indicator / gesture bar, so icons are never squeezed
      style={{ height: "calc(4rem + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Bottom navigation"
    >
      {TABS.map((tab) => {
        const active = isActive(tab.href, pathname);
        const Icon = tab.icon;
        return (
          <Link key={tab.href} href={tab.href}
            aria-current={active ? "page" : undefined}
            className="relative flex min-h-12 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 py-2 transition-colors active:bg-violet-50">
            {active && (
              <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-violet-600" />
            )}
            <span className="relative">
              <Icon
                className={`h-5 w-5 leading-none ${active ? "text-violet-700" : "text-slate-400"}`}
                strokeWidth={active ? 2.5 : 2}
                aria-hidden
              />
              {tab.href === "/messages" && unread > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
              {tab.href === "/arena" && inviteCount > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                  {inviteCount > 9 ? "9+" : inviteCount}
                </span>
              )}
            </span>
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

function TopBar({ title, back, unread }: { title?: string; back?: string; unread: number }) {
  return (
    <header
      className="sticky top-0 z-40 flex items-center gap-3 border-b border-slate-200/60 bg-white/90 px-4 backdrop-blur-md lg:hidden"
      style={{ height: "calc(3.5rem + env(safe-area-inset-top))", paddingTop: "env(safe-area-inset-top)" }}
    >
      {back && (
        <Link href={back} className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:bg-slate-200" aria-label="Go back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
      )}
      {!back && (
        <div className="flex h-8 items-center">
          <Logo size={32} />
        </div>
      )}
      <h1 className="flex-1 truncate text-base font-black text-slate-900">{title ?? "Qubit"}</h1>
      <ThemeToggle />
      {unread > 0 && (
        <Link href="/messages" aria-label={`${unread} unread messages`}
          className="flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-black text-white">
          {unread > 9 ? "9+" : unread}
        </Link>
      )}
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
  /**
   * Hide the mobile bottom tab bar (use while an exam / test is in progress so
   * the student can't tap away and the full screen height is usable).
   */
  hideBottomNav?: boolean;
  /**
   * Full focus mode: no sidebar, no top bar, no tab bar — used while a live
   * quiz duel is running so players can concentrate on the game.
   */
  focus?: boolean;
}

export default function AppShell({ children, title, back, hideTopBar = false, hideBottomNav = false, focus = false }: AppShellProps) {
  const pathname = usePathname();
  // Single subscription instance — mounting the realtime channel from more
  // than one component throws "cannot add callbacks after subscribe()".
  const unread = useUnreadDMCount();
  const inviteCount = usePendingInviteCount();
  const newArticles = useNewArticles();

  // Focus mode: the game IS the screen — no navigation anywhere.
  if (focus) {
    return <div className="min-h-dvh bg-[#f5f4ff]">{children}</div>;
  }

  return (
    // dvh (not vh) so the layout matches the *visible* height on iPhone Safari and
    // Android Chrome, where the browser bars make 100vh taller than the screen.
    // pt-safe keeps content clear of the notch / status bar when installed as a PWA.
    // (OnlineProvider lives in the root layout — survives client navigations.)
    <div className={`bg-[#f5f4ff] lg:pl-64 min-h-dvh ${hideTopBar ? "pt-safe" : ""}`}>
      {/* Desktop sidebar */}
      <Sidebar pathname={pathname} inviteCount={inviteCount} newArticles={newArticles} />

      {/* Mobile top bar */}
      {!hideTopBar && <TopBar title={title} back={back} unread={unread} />}

      {/* Page content — add bottom padding on mobile so content clears the tab bar */}
      <main className={`mx-auto w-full lg:max-w-[1600px] ${hideBottomNav ? "pb-0" : "pb-[calc(5rem+env(safe-area-inset-bottom))]"} lg:pb-0`}>
        {children}
      </main>

      {/* Mobile bottom tabs */}
      {!hideBottomNav && <BottomNav pathname={pathname} unread={unread} inviteCount={inviteCount} />}
    </div>
  );
}
