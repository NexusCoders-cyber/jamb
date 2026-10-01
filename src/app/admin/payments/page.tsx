"use client";

/**
 * Admin — Payments. Set the plan prices, manage discount codes
 * (percent or fixed-naira off, usage caps, expiry) and watch payments.
 */

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Loader2, Plus, Power, Tag, Trash2 } from "lucide-react";

type DiscountCode = {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
};

type PaymentRow = {
  id: string;
  reference: string;
  amount_kobo: number;
  status: string;
  plan: string | null;
  discount_code: string | null;
  created_at: string;
  user?: { full_name: string; email: string | null } | null;
};

export default function AdminPaymentsPage() {
  const [lifetimeNaira, setLifetimeNaira] = useState("1000");
  const [monthlyNaira, setMonthlyNaira] = useState("500");
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // New code form
  const [newCode, setNewCode] = useState("");
  const [newKind, setNewKind] = useState<"percent" | "fixed">("percent");
  const [newValue, setNewValue] = useState("10");
  const [newMaxUses, setNewMaxUses] = useState("");
  const [newExpires, setNewExpires] = useState("");

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const [settingsRes, codesRes, paymentsRes] = await Promise.all([
      supabase.from("admin_settings").select("key, value"),
      // discount codes/payments degrade to empty lists before the SQL runs
      supabase.from("discount_codes").select("*").order("created_at", { ascending: false }).limit(100),
      supabase
        .from("payments")
        .select("id, reference, amount_kobo, status, plan, discount_code, created_at, user:profiles(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    const settings = Object.fromEntries(((settingsRes.data ?? []) as Array<{ key: string; value: string }>).map((s) => [s.key, s.value]));
    setLifetimeNaira(settings.price_lifetime_naira ?? "1000");
    setMonthlyNaira(settings.price_monthly_naira ?? "500");
    setCodes(((codesRes.data ?? []) as unknown) as DiscountCode[]);
    setPayments(((paymentsRes.data ?? []) as unknown) as PaymentRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function savePrices() {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("admin_settings").upsert([
      { key: "price_lifetime_naira", value: lifetimeNaira, updated_at: new Date().toISOString() },
      { key: "price_monthly_naira", value: monthlyNaira, updated_at: new Date().toISOString() },
    ]);
    setNotice(error ? error.message : "Prices updated — the Premium page shows them immediately.");
    setBusy(false);
  }

  async function createCode() {
    const code = newCode.trim().toUpperCase().replace(/\s+/g, "");
    const value = parseInt(newValue, 10);
    if (!code) { setNotice("Enter a code."); return; }
    if (Number.isNaN(value) || value <= 0) { setNotice("Enter a valid value."); return; }
    if (newKind === "percent" && value > 100) { setNotice("Percent can't exceed 100."); return; }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("discount_codes").insert({
      code,
      kind: newKind,
      value,
      max_uses: newMaxUses.trim() ? parseInt(newMaxUses, 10) : null,
      expires_at: newExpires ? new Date(newExpires).toISOString() : null,
    });
    setNotice(error ? (error.message.includes("unique") ? "That code already exists." : error.message) : `Code ${code} created.`);
    if (!error) { setNewCode(""); setNewMaxUses(""); setNewExpires(""); }
    setBusy(false);
    void load();
  }

  async function toggleCode(c: DiscountCode) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("discount_codes").update({ active: !c.active }).eq("id", c.id);
    setNotice(error ? error.message : `${c.code} ${c.active ? "deactivated" : "activated"}.`);
    void load();
  }

  async function deleteCode(c: DiscountCode) {
    if (!window.confirm(`Delete code ${c.code}?`)) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("discount_codes").delete().eq("id", c.id);
    setNotice(error ? error.message : `${c.code} deleted.`);
    void load();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">Monetization</p>
        <h1 className="mt-1 text-2xl font-black text-white">Payments &amp; discounts</h1>
      </header>

      {notice && (
        <div className="mb-4 rounded-2xl bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-300 ring-1 ring-violet-500/30">
          {notice}
        </div>
      )}

      {/* Prices */}
      <section className="mb-6 rounded-3xl bg-slate-900 p-5 ring-1 ring-slate-800">
        <p className="text-sm font-black text-white">Plan prices</p>
        <p className="mt-1 text-xs text-slate-400">Shown on the Premium page immediately. Requires supabase/premium_payments.sql.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-400">Lifetime (₦)</span>
            <input value={lifetimeNaira} onChange={(e) => setLifetimeNaira(e.target.value)} inputMode="numeric"
              className="mt-1 w-32 rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-400">Monthly (₦)</span>
            <input value={monthlyNaira} onChange={(e) => setMonthlyNaira(e.target.value)} inputMode="numeric"
              className="mt-1 w-32 rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500" />
          </label>
          <button type="button" onClick={() => void savePrices()} disabled={busy}
            className="rounded-full bg-violet-600 px-5 py-2.5 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-50">
            Save prices
          </button>
        </div>
      </section>

      {/* Discount codes */}
      <section className="mb-6 rounded-3xl bg-slate-900 p-5 ring-1 ring-slate-800">
        <p className="flex items-center gap-2 text-sm font-black text-white"><Tag className="h-4 w-4" aria-hidden /> Discount codes</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          <input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="CODE"
            className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold uppercase text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500 sm:col-span-2" />
          <select value={newKind} onChange={(e) => setNewKind(e.target.value as "percent" | "fixed")}
            className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500">
            <option value="percent">% off</option>
            <option value="fixed">₦ off</option>
          </select>
          <input value={newValue} onChange={(e) => setNewValue(e.target.value)} inputMode="numeric" placeholder={newKind === "percent" ? "10" : "200"}
            className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500" />
          <input value={newMaxUses} onChange={(e) => setNewMaxUses(e.target.value)} inputMode="numeric" placeholder="Max uses (∞)"
            className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500" />
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="text-xs font-bold text-slate-400">Expires (optional)</span>
            <input type="date" value={newExpires} onChange={(e) => setNewExpires(e.target.value)}
              className="mt-0.5 block rounded-xl bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500" />
          </label>
          <button type="button" onClick={() => void createCode()} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2.5 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" aria-hidden /> Create code
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {codes.length === 0 ? (
            <p className="rounded-2xl bg-slate-800/60 px-4 py-3 text-xs text-slate-400">No discount codes yet — create one above.</p>
          ) : codes.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-slate-800/60 p-3">
              <span className="font-mono text-sm font-black text-white">{c.code}</span>
              <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-black text-violet-300">
                {c.kind === "percent" ? `${c.value}% off` : `₦${Math.round(c.value / 100)} off`}
              </span>
              <span className="text-[11px] text-slate-400">
                {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""} used{c.expires_at ? ` · expires ${new Date(c.expires_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}` : ""}
              </span>
              <span className="flex-1" />
              {!c.active && <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-black text-slate-400">OFF</span>}
              <button type="button" onClick={() => void toggleCode(c)} aria-label={`Toggle ${c.code}`}
                className={`rounded-full p-2 ${c.active ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
                <Power className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button type="button" onClick={() => void deleteCode(c)} aria-label={`Delete ${c.code}`}
                className="rounded-full bg-rose-500/10 p-2 text-rose-400 hover:bg-rose-500/20">
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Recent payments */}
      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-400">Recent payments</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>
        ) : payments.length === 0 ? (
          <div className="rounded-3xl bg-slate-900 p-8 text-center ring-1 ring-slate-800">
            <p className="font-black text-white">No payments yet.</p>
            <p className="mt-1 text-xs text-slate-400">They appear here the moment a student checks out.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-white">
                    ₦{Math.round(p.amount_kobo / 100).toLocaleString()} · {p.plan ?? "—"} {p.discount_code ? `· ${p.discount_code}` : ""}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {p.user?.full_name ?? "Unknown"} ({p.user?.email ?? "—"}) · {new Date(p.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${p.status === "paid" ? "bg-emerald-500/10 text-emerald-400" : p.status === "pending" ? "bg-amber-500/10 text-amber-400" : "bg-rose-500/10 text-rose-400"}`}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
