"use client";

/**
 * Admin — Payments & Subscription Config.
 *
 * Sections:
 *  1. Paystack API keys (secret + public) — stored in admin_settings
 *  2. Plan prices (weekly / monthly / biannual) — stored in admin_settings
 *  3. Discount codes — create / toggle / delete
 *  4. Recent payments feed
 *  5. Pro subscribers list
 */

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Eye, EyeOff, Loader2, Plus, Power, Tag, Trash2, Key, RefreshCw } from "lucide-react";

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
  paid_at: string | null;
  user?: { full_name: string; email: string | null } | null;
};

type ProUser = {
  id: string;
  full_name: string;
  email: string | null;
  premium_until: string | null;
};

const PLAN_KEYS = [
  { key: "price_weekly_naira",   label: "Weekly (₦)",   default: "200"  },
  { key: "price_monthly_naira",  label: "Monthly (₦)",  default: "800"  },
  { key: "price_biannual_naira", label: "6-Month (₦)",  default: "1700" },
];

export default function AdminPaymentsPage() {
  // ── Paystack keys ──────────────────────────────────────────────────────────
  const [secretKey, setSecretKey]   = useState("");
  const [publicKey, setPublicKey]   = useState("");
  const [showSecret, setShowSecret] = useState(false);

  // ── Plan prices ────────────────────────────────────────────────────────────
  const [prices, setPrices] = useState<Record<string, string>>({
    price_weekly_naira:   "200",
    price_monthly_naira:  "800",
    price_biannual_naira: "1700",
  });

  // ── Free trial ─────────────────────────────────────────────────────────────
  const [trialEnabled, setTrialEnabled] = useState(false);
  const [trialDays, setTrialDays]       = useState("1");

  // ── Discount codes ─────────────────────────────────────────────────────────
  const [codes, setCodes]     = useState<DiscountCode[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newKind, setNewKind] = useState<"percent" | "fixed">("percent");
  const [newValue, setNewValue]     = useState("10");
  const [newMaxUses, setNewMaxUses] = useState("");
  const [newExpires, setNewExpires] = useState("");

  // ── Recent payments ────────────────────────────────────────────────────────
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  // ── Pro subscribers ────────────────────────────────────────────────────────
  const [proUsers, setProUsers] = useState<ProUser[]>([]);
  const [grantId, setGrantId]   = useState("");
  const [grantDays, setGrantDays] = useState("30");

  // ── UI state ───────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [notice, setNotice]   = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy]       = useState(false);

  const flash = (msg: string, ok = true) => {
    setNotice({ msg, ok });
    setTimeout(() => setNotice(null), 4000);
  };

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const [settingsRes, codesRes, paymentsRes, proRes] = await Promise.all([
      supabase.from("admin_settings").select("key, value"),      supabase.from("discount_codes").select("*").order("created_at", { ascending: false }).limit(100),
      supabase
        .from("payments")
        .select("id, reference, amount_kobo, status, plan, discount_code, created_at, paid_at, user:profiles(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("profiles")
        .select("id, full_name, email, premium_until")
        .not("premium_until", "is", null)
        .gt("premium_until", new Date().toISOString())
        .order("premium_until", { ascending: false })
        .limit(100),
    ]);

    const settings = Object.fromEntries(
      ((settingsRes.data ?? []) as Array<{ key: string; value: string }>).map((s) => [s.key, s.value]),
    );

    setSecretKey(settings.paystack_secret_key ?? "");
    setPublicKey(settings.paystack_public_key ?? "");
    setPrices({
      price_weekly_naira:   settings.price_weekly_naira   ?? "200",
      price_monthly_naira:  settings.price_monthly_naira  ?? "800",
      price_biannual_naira: settings.price_biannual_naira ?? "1700",
    });
    setTrialEnabled(settings.free_trial_enabled === "true");
    setTrialDays(settings.free_trial_days ?? "1");
    setCodes(((codesRes.data ?? []) as unknown) as DiscountCode[]);
    setPayments(((paymentsRes.data ?? []) as unknown) as PaymentRow[]);
    setProUsers(((proRes.data ?? []) as unknown) as ProUser[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Save Paystack keys ─────────────────────────────────────────────────────
  async function saveKeys() {
    if (!secretKey.trim() || !publicKey.trim()) {
      flash("Both keys are required.", false); return;
    }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("admin_settings").upsert([
      { key: "paystack_secret_key", value: secretKey.trim(),  updated_at: new Date().toISOString() },
      { key: "paystack_public_key", value: publicKey.trim(),  updated_at: new Date().toISOString() },
    ]);
    flash(error ? error.message : "Paystack keys saved — checkout will use them immediately.", !error);
    setBusy(false);
  }

  // ── Save plan prices ───────────────────────────────────────────────────────
  async function savePrices() {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const rows = Object.entries(prices).map(([key, value]) => ({
      key, value, updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("admin_settings").upsert(rows);
    flash(error ? error.message : "Prices updated — the upgrade page shows them immediately.", !error);
    setBusy(false);
  }

  // ── Save trial settings ────────────────────────────────────────────────────
  async function saveTrial() {
    const days = parseInt(trialDays, 10);
    if (Number.isNaN(days) || days < 1 || days > 30) {
      flash("Trial duration must be between 1 and 30 days.", false); return;
    }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("admin_settings").upsert([
      { key: "free_trial_enabled", value: trialEnabled ? "true" : "false", updated_at: new Date().toISOString() },
      { key: "free_trial_days",    value: String(days),                     updated_at: new Date().toISOString() },
    ]);
    flash(error ? error.message : `Free trial ${trialEnabled ? `enabled (${days} day${days !== 1 ? "s" : ""})` : "disabled"}.`, !error);
    setBusy(false);
  }

  // ── Create discount code ─────────────────────────────────────────────────────
  async function createCode() {
    const code = newCode.trim().toUpperCase().replace(/\s+/g, "");
    const value = parseInt(newValue, 10);
    if (!code)                              { flash("Enter a code name.", false); return; }
    if (Number.isNaN(value) || value <= 0)  { flash("Enter a valid value.", false); return; }
    if (newKind === "percent" && value > 100) { flash("Percent can't exceed 100.", false); return; }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("discount_codes").insert({
      code,
      kind: newKind,
      value,
      max_uses: newMaxUses.trim() ? parseInt(newMaxUses, 10) : null,
      expires_at: newExpires ? new Date(newExpires).toISOString() : null,
    });
    flash(error
      ? (error.message.includes("unique") ? `Code "${code}" already exists.` : error.message)
      : `Code ${code} created.`,
    !error);
    if (!error) { setNewCode(""); setNewMaxUses(""); setNewExpires(""); }
    setBusy(false);
    void load();
  }

  async function toggleCode(c: DiscountCode) {
    const supabase = createSupabaseBrowserClient();
    await supabase.from("discount_codes").update({ active: !c.active }).eq("id", c.id);
    flash(`${c.code} ${c.active ? "deactivated" : "activated"}.`);
    void load();
  }

  async function deleteCode(c: DiscountCode) {
    if (!window.confirm(`Delete code ${c.code}? This cannot be undone.`)) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.from("discount_codes").delete().eq("id", c.id);
    flash(`${c.code} deleted.`);
    void load();
  }

  // ── Grant Pro manually ─────────────────────────────────────────────────────
  async function grantPro() {
    const id = grantId.trim();
    const days = parseInt(grantDays, 10);
    if (!id || Number.isNaN(days) || days <= 0) {
      flash("Enter a valid user ID and number of days.", false); return;
    }
    setBusy(true);
    const until = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("profiles")
      .update({ premium_until: until, updated_at: new Date().toISOString() })
      .eq("id", id);
    flash(error ? error.message : `Pro granted to ${id} for ${days} days.`, !error);
    setBusy(false);
    if (!error) { setGrantId(""); void load(); }
  }

  // ── Revoke Pro ─────────────────────────────────────────────────────────────
  async function revokePro(userId: string, name: string) {
    if (!window.confirm(`Revoke Pro from ${name}?`)) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("profiles")
      .update({ premium_until: null, updated_at: new Date().toISOString() })
      .eq("id", userId);
    flash(error ? error.message : `Pro revoked from ${name}.`, !error);
    void load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="mb-2">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">Monetization</p>
        <h1 className="mt-1 text-2xl font-black text-white">Payments &amp; Subscriptions</h1>
      </header>

      {notice && (
        <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ${
          notice.ok
            ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
            : "bg-rose-500/10 text-rose-300 ring-rose-500/30"
        }`}>
          {notice.msg}
        </div>
      )}

      {/* ── 1. Paystack Keys ──────────────────────────────────────────────── */}
      <section className="rounded-3xl bg-slate-900 p-6 ring-1 ring-slate-800">
        <div className="mb-4 flex items-center gap-2">
          <Key className="h-4 w-4 text-violet-400" />
          <p className="text-sm font-black text-white">Paystack API Keys</p>
        </div>
        <p className="mb-4 text-xs text-slate-400">
          Get these from your{" "}
          <a href="https://dashboard.paystack.com/#/settings/developer" target="_blank" rel="noopener noreferrer"
            className="text-violet-400 underline">
            Paystack dashboard → Settings → API Keys
          </a>. The secret key is stored securely server-side and never sent to the browser.
        </p>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-400">Secret Key (sk_live_… or sk_test_…)</span>
            <div className="relative mt-1">
              <input
                type={showSecret ? "text" : "password"}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="sk_live_xxxxxxxxxxxxxxxx"
                className="w-full rounded-xl bg-slate-800 px-4 py-2.5 pr-10 text-sm font-mono text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500"
              />
              <button type="button" onClick={() => setShowSecret((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-400">Public Key (pk_live_… or pk_test_…)</span>
            <input
              type="text"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="pk_live_xxxxxxxxxxxxxxxx"
              className="mt-1 w-full rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-mono text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500"
            />
          </label>
        </div>
        <button type="button" onClick={() => void saveKeys()} disabled={busy}
          className="mt-4 rounded-full bg-violet-600 px-5 py-2.5 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-50">
          Save keys
        </button>
      </section>

      {/* ── 2. Plan prices ────────────────────────────────────────────────── */}
      <section className="rounded-3xl bg-slate-900 p-6 ring-1 ring-slate-800">
        <p className="mb-1 text-sm font-black text-white">Plan Prices</p>
        <p className="mb-4 text-xs text-slate-400">
          Changes take effect immediately on the upgrade page. Paystack uses these to charge the correct amount.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          {PLAN_KEYS.map(({ key, label, default: def }) => (
            <label key={key} className="block">
              <span className="text-xs font-bold text-slate-400">{label}</span>
              <input
                value={prices[key] ?? def}
                onChange={(e) => setPrices((p) => ({ ...p, [key]: e.target.value }))}
                inputMode="numeric"
                className="mt-1 w-32 rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500"
              />
            </label>
          ))}
          <button type="button" onClick={() => void savePrices()} disabled={busy}
            className="rounded-full bg-violet-600 px-5 py-2.5 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-50">
            Save prices
          </button>
        </div>
      </section>

      {/* ── 3. Free Trial ─────────────────────────────────────────────────── */}
      <section className="rounded-3xl bg-slate-900 p-6 ring-1 ring-slate-800">
        <p className="mb-1 text-sm font-black text-white">Free Trial</p>
        <p className="mb-4 text-xs text-slate-400">
          When enabled, new users see a "Claim free trial" button on the upgrade page.
          Each account can only claim once. Changes take effect immediately.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          {/* Toggle */}
          <div>
            <span className="mb-1.5 block text-xs font-bold text-slate-400">Status</span>
            <button
              type="button"
              onClick={() => setTrialEnabled((v) => !v)}
              className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm font-black transition ${
                trialEnabled
                  ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
                  : "bg-slate-800 text-slate-400 ring-1 ring-slate-700"
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${trialEnabled ? "bg-emerald-400" : "bg-slate-600"}`} />
              {trialEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>
          {/* Duration */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-400">Duration (days)</span>
            <input
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
              inputMode="numeric"
              placeholder="1"
              className="w-24 rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500"
            />
          </label>
          <button type="button" onClick={() => void saveTrial()} disabled={busy}
            className="rounded-full bg-violet-600 px-5 py-2.5 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-50">
            Save trial settings
          </button>
        </div>
        {trialEnabled && (
          <div className="mt-3 rounded-2xl bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300 ring-1 ring-emerald-500/20">
            ✓ Free trial is <strong>active</strong> — users who have never subscribed will see a
            "{trialDays}-day free trial" claim button on the upgrade page.
          </div>
        )}
      </section>

      {/* ── 4. Discount codes ─────────────────────────────────────────────── */}
      <section className="rounded-3xl bg-slate-900 p-6 ring-1 ring-slate-800">
        <div className="mb-4 flex items-center gap-2">
          <Tag className="h-4 w-4 text-violet-400" />
          <p className="text-sm font-black text-white">Discount Codes</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-5">
          <input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            placeholder="CODE" maxLength={20}
            className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold uppercase text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500 sm:col-span-2" />
          <select value={newKind} onChange={(e) => setNewKind(e.target.value as "percent" | "fixed")}
            className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500">
            <option value="percent">% off</option>
            <option value="fixed">₦ off</option>
          </select>
          <input value={newValue} onChange={(e) => setNewValue(e.target.value)}
            inputMode="numeric" placeholder={newKind === "percent" ? "10" : "200"}
            className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500" />
          <input value={newMaxUses} onChange={(e) => setNewMaxUses(e.target.value)}
            inputMode="numeric" placeholder="Max uses (∞)"
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
            <Plus className="h-3.5 w-3.5" /> Create code
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {codes.length === 0 ? (
            <p className="rounded-2xl bg-slate-800/60 px-4 py-3 text-xs text-slate-400">No discount codes yet.</p>
          ) : codes.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-slate-800/60 p-3">
              <span className="font-mono text-sm font-black text-white">{c.code}</span>
              <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-black text-violet-300">
                {c.kind === "percent" ? `${c.value}% off` : `₦${c.value} off`}
              </span>
              <span className="text-[11px] text-slate-400">
                {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""} used
                {c.expires_at ? ` · expires ${new Date(c.expires_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}` : ""}
              </span>
              <span className="flex-1" />
              {!c.active && <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-black text-slate-400">OFF</span>}
              <button type="button" onClick={() => void toggleCode(c)}
                aria-label={`Toggle ${c.code}`}
                className={`rounded-full p-2 ${c.active ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
                <Power className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => void deleteCode(c)}
                aria-label={`Delete ${c.code}`}
                className="rounded-full bg-rose-500/10 p-2 text-rose-400 hover:bg-rose-500/20">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. Pro subscribers ────────────────────────────────────────────── */}
      <section className="rounded-3xl bg-slate-900 p-6 ring-1 ring-slate-800">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-black text-white">
            Pro Subscribers
            <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300">
              {proUsers.length} active
            </span>
          </p>
          <button type="button" onClick={() => void load()} className="text-slate-400 hover:text-white">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Grant Pro manually */}
        <div className="mb-4 rounded-2xl bg-slate-800/50 p-4">
          <p className="mb-2 text-xs font-bold text-slate-400">Grant Pro manually (e.g. for testers or manual payments)</p>
          <div className="flex flex-wrap gap-2">
            <input value={grantId} onChange={(e) => setGrantId(e.target.value)}
              placeholder="User UUID"
              className="h-9 flex-1 min-w-0 rounded-xl bg-slate-800 px-3 text-xs font-mono text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500" />
            <input value={grantDays} onChange={(e) => setGrantDays(e.target.value)}
              inputMode="numeric" placeholder="Days"
              className="h-9 w-20 rounded-xl bg-slate-800 px-3 text-xs text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500" />
            <button type="button" onClick={() => void grantPro()} disabled={busy}
              className="h-9 rounded-full bg-amber-500 px-4 text-xs font-black text-white hover:bg-amber-600 disabled:opacity-50">
              Grant Pro
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>
        ) : proUsers.length === 0 ? (
          <p className="text-xs text-slate-500">No active Pro subscribers yet.</p>
        ) : (
          <div className="space-y-2">
            {proUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-slate-800/50 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{u.full_name}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {u.email} · expires{" "}
                    {u.premium_until
                      ? new Date(u.premium_until).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-black text-amber-400">⭐ PRO</span>
                <button type="button" onClick={() => void revokePro(u.id, u.full_name)}
                  className="shrink-0 rounded-full bg-rose-500/10 px-3 py-1 text-[10px] font-black text-rose-400 hover:bg-rose-500/20">
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 6. Recent payments ────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-400">Recent Payments</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>
        ) : payments.length === 0 ? (
          <div className="rounded-3xl bg-slate-900 p-8 text-center ring-1 ring-slate-800">
            <p className="font-black text-white">No payments yet.</p>
            <p className="mt-1 text-xs text-slate-400">They appear here the moment a student pays.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-white">
                    ₦{Math.round(p.amount_kobo / 100).toLocaleString()}
                    {p.plan ? ` · ${p.plan}` : ""}
                    {p.discount_code ? ` · ${p.discount_code}` : ""}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {p.user?.full_name ?? "Unknown"} ({p.user?.email ?? "—"}) ·{" "}
                    {new Date(p.created_at).toLocaleDateString("en-NG", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                    {p.paid_at ? ` · paid ${new Date(p.paid_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                  p.status === "paid"    ? "bg-emerald-500/10 text-emerald-400" :
                  p.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                  "bg-rose-500/10 text-rose-400"
                }`}>
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
