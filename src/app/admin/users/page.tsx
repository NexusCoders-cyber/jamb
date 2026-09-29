"use client";

/**
 * Admin — Users. Search all profiles, view stats, promote/demote admins,
 * and delete problem accounts (via /api/admin/delete-user, service role).
 */

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import Avatar from "@/components/Avatar";
import { Search, ShieldCheck, ShieldOff, Trash2, Loader2 } from "lucide-react";

type UserRow = {
  id: string;
  full_name: string;
  email: string | null;
  role: "student" | "admin";
  target_score: number;
  streak_days: number;
  created_at: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    let q = supabase
      .from("profiles")
      .select("id, full_name, email, role, target_score, streak_days, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (query.trim()) q = q.ilike("full_name", `%${query.trim()}%`);
    const { data } = await q;
    setUsers((data ?? []) as UserRow[]);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    const t = setTimeout(() => void load(), query ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  async function setRole(user: UserRow, role: "student" | "admin") {
    setBusyId(user.id);
    setNotice(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("profiles").update({ role, updated_at: new Date().toISOString() }).eq("id", user.id);
    if (error) {
      setNotice({ text: error.message, ok: false });
    } else {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)));
      setNotice({ text: `${user.full_name} is now ${role === "admin" ? "an admin" : "a student"}.`, ok: true });
    }
    setBusyId(null);
  }

  async function deleteUser(user: UserRow) {
    if (!window.confirm(`Delete ${user.full_name || user.email} permanently? Their exams, posts and messages will be removed.`)) return;
    setBusyId(user.id);
    setNotice(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expired — sign in again.");

      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: user.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Delete failed");

      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setNotice({ text: `${user.full_name || user.email} deleted.`, ok: true });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "Delete failed", ok: false });
    }
    setBusyId(null);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">People</p>
        <h1 className="mt-1 text-2xl font-black text-white">Users</h1>
      </header>

      {notice && (
        <div className={`mb-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
          notice.ok ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30" : "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/30"
        }`}>
          {notice.text}
        </div>
      )}

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" aria-hidden />
        <input
          type="search"
          placeholder="Search students by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-2xl border border-slate-800 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-500"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((n) => <div key={n} className="h-16 animate-pulse rounded-2xl bg-slate-900" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-3xl bg-slate-900 p-8 text-center ring-1 ring-slate-800">
          <p className="font-black text-white">No users found</p>
          <p className="mt-1 text-sm text-slate-500">Try a different search.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
              <Avatar user={{ full_name: u.full_name, avatar_url: null }} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-black text-white">
                  {u.full_name || "(no name)"}
                  {u.role === "admin" && (
                    <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-black text-violet-300">ADMIN</span>
                  )}
                </p>
                <p className="truncate text-xs text-slate-500">{u.email ?? "—"}</p>
                <p className="text-[11px] text-slate-600">
                  Joined {new Date(u.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })} · {u.streak_days}d streak · target {u.target_score}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {busyId === u.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden />
                ) : (
                  <>
                    {u.role === "student" ? (
                      <button
                        type="button"
                        onClick={() => void setRole(u, "admin")}
                        className="inline-flex items-center gap-1.5 rounded-full bg-violet-600/20 px-3 py-1.5 text-[11px] font-bold text-violet-300 ring-1 ring-violet-500/30 hover:bg-violet-600/30"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Make admin
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void setRole(u, "student")}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700"
                      >
                        <ShieldOff className="h-3.5 w-3.5" aria-hidden /> Demote
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void deleteUser(u)}
                      aria-label={`Delete ${u.full_name}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-400 ring-1 ring-rose-500/30 hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
