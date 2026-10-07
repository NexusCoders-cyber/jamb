"use client";

/**
 * Admin — Users. Data table of all profiles with search (name or email),
 * sortable columns, copy-all-emails, CSV export, role management and
 * account deletion (via /api/admin/delete-user, service role).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import Avatar from "@/components/Avatar";
import AdminUserPanel from "@/components/AdminUserPanel";
import { Copy, Crown, Download, Loader2, Search, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";

type UserRow = {
  id: string;
  full_name: string;
  email: string | null;
  role: "student" | "admin";
  target_score: number;
  streak_days: number;
  created_at: string;
  premium_until?: string | null;
};

const isPro = (u: { premium_until?: string | null }) => !!u.premium_until && new Date(u.premium_until).getTime() > Date.now();

type SortKey = "created_at" | "full_name" | "streak_days";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pro" | "admin">("all");
  const [managing, setManaging] = useState<UserRow | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const q = supabase
      .from("profiles")
      .select("id, full_name, email, role, target_score, streak_days, created_at, user_code, premium_until")
      .order("created_at", { ascending: false })
      .limit(1000);
    const { data } = await q;
    setUsers((data ?? []) as UserRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Search by name OR email, then sort
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = filter === "pro" ? users.filter(isPro) : filter === "admin" ? users.filter((u) => u.role === "admin") : users;
    const filtered = q
      ? pool.filter((u) =>
          (u.full_name ?? "").toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q) ||
          (u as unknown as { user_code?: string }).user_code?.toLowerCase().includes(q))
      : pool;
    const sorted = [...filtered].sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
      const cmp = typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb));
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [users, query, filter, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(key !== "created_at"); }
  }

  async function copyEmails() {
    const emails = visible.map((u) => u.email).filter(Boolean).join(", ");
    if (!emails) { setNotice({ text: "No emails to copy.", ok: false }); return; }
    await navigator.clipboard?.writeText(emails);
    setNotice({ text: `Copied ${emails.split(",").length} emails to clipboard.`, ok: true });
  }

  function downloadCsv() {
    const header = "full_name,email,user_code,role,plan,pro_until,target_score,streak_days,joined";
    const rows = visible.map((u) => [
      `"${(u.full_name ?? "").replace(/"/g, '""')}"`,
      u.email ?? "",
      (u as unknown as { user_code?: string }).user_code ?? "",
      u.role,
      isPro(u) ? "pro" : "free",
      isPro(u) ? (u.premium_until ?? "").slice(0, 10) : "",
      String(u.target_score ?? ""),
      String(u.streak_days ?? 0),
      new Date(u.created_at).toISOString().slice(0, 10),
    ].join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qubit-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice({ text: `Exported ${rows.length} users to CSV.`, ok: true });
  }

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

  const th = (label: string, key?: SortKey) => (
    <th scope="col" className={`px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 ${key ? "cursor-pointer select-none hover:text-white" : ""}`}
      onClick={key ? () => toggleSort(key) : undefined}>
      {label}{key === sortKey ? (sortAsc ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <div className="mx-auto max-w-6xl">
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

      {/* Toolbar: search + copy + export */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" aria-hidden />
          <input
            type="search"
            placeholder="Search by name, email or ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-500"
          />
        </div>
        <button type="button" onClick={() => void copyEmails()}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-200 ring-1 ring-slate-700 hover:text-white">
          <Copy className="h-3.5 w-3.5" aria-hidden /> Copy emails
        </button>
        <button type="button" onClick={downloadCsv}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-200 ring-1 ring-slate-700 hover:text-white">
          <Download className="h-3.5 w-3.5" aria-hidden /> Download CSV
        </button>
        {(["all", "pro", "admin"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
            className={`rounded-full px-3 py-2 text-xs font-bold ring-1 ${filter === f ? "bg-violet-600 text-white ring-violet-500" : "bg-slate-900 text-slate-300 ring-slate-700 hover:text-white"}`}>
            {f === "all" ? "All" : f === "pro" ? `Pro (${users.filter(isPro).length})` : "Admins"}
          </button>
        ))}
        <span className="rounded-full bg-slate-900 px-3 py-2 text-xs font-bold text-slate-400">{visible.length} users</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((n) => <div key={n} className="h-16 animate-pulse rounded-2xl bg-slate-900" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-3xl bg-slate-900 p-8 text-center ring-1 ring-slate-800">
          <p className="font-black text-white">No users found</p>
          <p className="mt-1 text-sm text-slate-500">Try a different search.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-3xl bg-slate-900 ring-1 ring-slate-800 lg:block">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-slate-800">
                <tr>
                  {th("Student", "full_name")}
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Email</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Role</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Plan</th>
                  {th("Streak", "streak_days")}
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Target</th>
                  {th("Joined", "created_at")}
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {visible.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar user={{ full_name: u.full_name, avatar_url: null }} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-bold text-white">{u.full_name || "(no name)"}</p>
                          <p className="font-mono text-[10px] text-slate-600">{(u as unknown as { user_code?: string }).user_code ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-slate-400">{u.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      {u.role === "admin"
                        ? <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-black text-violet-300">ADMIN</span>
                        : <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-black text-slate-400">STUDENT</span>}
                    </td>
                    <td className="px-4 py-3">
                      {isPro(u)
                        ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-300"><Crown className="h-3 w-3" aria-hidden />PRO</span>
                        : <span className="text-[10px] font-bold text-slate-600">Free</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{u.streak_days}d</td>
                    <td className="px-4 py-3 text-slate-300">{u.target_score}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(u.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "2-digit" })}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {busyId === u.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden />
                        ) : (
                          <>
                            <button type="button" onClick={() => setManaging(u)} aria-label={`Manage Pro and phones for ${u.full_name}`}
                              className="rounded-full bg-amber-500/10 p-2 text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-500/20">
                              <Crown className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            {u.role === "student" ? (
                              <button type="button" onClick={() => void setRole(u, "admin")} aria-label={`Make ${u.full_name} admin`}
                                className="rounded-full bg-violet-600/20 p-2 text-violet-300 ring-1 ring-violet-500/30 hover:bg-violet-600/30">
                                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            ) : (
                              <button type="button" onClick={() => void setRole(u, "student")} aria-label={`Demote ${u.full_name}`}
                                className="rounded-full bg-slate-800 p-2 text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700">
                                <ShieldOff className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            )}
                            <button type="button" onClick={() => void deleteUser(u)} aria-label={`Delete ${u.full_name}`}
                              className="rounded-full bg-rose-500/10 p-2 text-rose-400 ring-1 ring-rose-500/30 hover:bg-rose-500/20">
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {visible.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
                <Avatar user={{ full_name: u.full_name, avatar_url: null }} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-black text-white">
                    {u.full_name || "(no name)"}
                    {u.role === "admin" && <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-black text-violet-300">ADMIN</span>}
                    {isPro(u) && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-300">PRO</span>}
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
                      <button type="button" onClick={() => setManaging(u)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-500/20">
                        <Crown className="h-3.5 w-3.5" aria-hidden /> Pro &amp; phones
                      </button>
                      {u.role === "student" ? (
                        <button type="button" onClick={() => void setRole(u, "admin")}
                          className="inline-flex items-center gap-1.5 rounded-full bg-violet-600/20 px-3 py-1.5 text-[11px] font-bold text-violet-300 ring-1 ring-violet-500/30 hover:bg-violet-600/30">
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Make admin
                        </button>
                      ) : (
                        <button type="button" onClick={() => void setRole(u, "student")}
                          className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700">
                          <ShieldOff className="h-3.5 w-3.5" aria-hidden /> Demote
                        </button>
                      )}
                      <button type="button" onClick={() => void deleteUser(u)} aria-label={`Delete ${u.full_name}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-400 ring-1 ring-rose-500/30 hover:bg-rose-500/20">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {managing && (
        <AdminUserPanel
          user={managing}
          onClose={() => setManaging(null)}
          onProChange={(until) => setUsers((prev) => prev.map((x) => (x.id === managing.id ? { ...x, premium_until: until } : x)))}
        />
      )}
    </div>
  );
}
