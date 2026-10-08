/** Pro plan prices — shared by the landing page, paywall and upgrade page. The live numbers live in admin_settings. */
export type Prices = {
  weekly: number;
  monthly: number;
  biannual: number;
  freeTrialEnabled: boolean;
  freeTrialDays: number;
};

/** Only used when the database can't be reached. Keep in step with what you charge. */
export const DEFAULT_PRICES: Prices = { weekly: 200, monthly: 900, biannual: 1700, freeTrialEnabled: false, freeTrialDays: 1 };

export const formatNaira = (n: number): string => `₦${Math.round(n).toLocaleString("en-NG")}`;

export type PlanCard = { id: "weekly" | "monthly" | "biannual"; label: string; price: string; naira: number; duration: string; sub: string; highlight?: boolean };

export function planCards(p: Prices): PlanCard[] {
  return [
    { id: "weekly", label: "Weekly", price: formatNaira(p.weekly), naira: p.weekly, duration: "7 days", sub: "7 days" },
    { id: "monthly", label: "Monthly", price: formatNaira(p.monthly), naira: p.monthly, duration: "30 days", sub: "30 days", highlight: true },
    { id: "biannual", label: "6-Month", price: formatNaira(p.biannual), naira: p.biannual, duration: "180 days", sub: "180 days · best value" },
  ];
}

/** Turns the raw admin_settings rows into prices, ignoring anything that isn't a sensible positive number. */
export function pricesFromSettings(settings: Record<string, string | undefined>): Prices {
  const num = (v: string | undefined, fallback: number) => {
    const n = parseInt(v ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    weekly: num(settings.price_weekly_naira, DEFAULT_PRICES.weekly),
    monthly: num(settings.price_monthly_naira, DEFAULT_PRICES.monthly),
    biannual: num(settings.price_biannual_naira, DEFAULT_PRICES.biannual),
    freeTrialEnabled: settings.free_trial_enabled === "true",
    freeTrialDays: num(settings.free_trial_days, DEFAULT_PRICES.freeTrialDays),
  };
}
