/**
 * Typed environment variable accessors.
 * - NEXT_PUBLIC_* vars use the safe publicVar() — returns "" instead of throwing
 *   so the browser client can show a descriptive error rather than crashing.
 * - All other vars use required() — throws at startup so misconfiguration is caught early.
 *
 * ALOC questions now go through src/lib/aloc.ts which hardcodes the real base URL.
 * ALOC_API_KEY is still needed; ALOC_API_URL is no longer used.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/**
 * NEXT_PUBLIC_* vars MUST be referenced directly (dotted access) — bundlers
 * inline them into the client bundle by literal name. A dynamic lookup like
 * process.env[name] is undefined in the browser and silently broke every
 * client-side Supabase call (sign-in walls, redirect loops, error pages).
 */
export function getSupabasePublicEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}

export function getSupabaseAdminEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function getPaystackSecretKey() {
  return required("PAYSTACK_SECRET_KEY");
}

export function getResendConfig() {
  return {
    apiKey: required("RESEND_API_KEY"),
    from: required("RESEND_FROM_EMAIL"),
  };
}

/** ALOC API key — base URL is owned by src/lib/aloc.ts */
export function getAlocApiKey(): string {
  return process.env.ALOC_API_KEY ?? "";
}
