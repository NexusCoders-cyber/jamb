/**
 * Leaked-password check using the Have I Been Pwned "Pwned Passwords" range API (k-anonymity):
 * only the first 5 characters of the password's SHA-1 ever leave the device; the password itself never does.
 * Every function FAILS OPEN — if the service is slow or down, nobody is blocked from signing up.
 */

export const PWNED_MESSAGE =
  "That password has appeared in known data breaches, so it isn't safe to use. Please choose a different one.";

/** Does a HIBP range response contain this SHA-1 suffix? Pure, so it is easy to test. */
export function rangeContains(rangeText: string, suffix: string): boolean {
  const want = suffix.toUpperCase();
  for (const line of rangeText.split(/\r?\n/)) {
    const [hash, count] = line.trim().split(":");
    if (hash && hash.toUpperCase() === want && parseInt(count ?? "1", 10) > 0) return true; // count 0 = padding row
  }
  return false;
}

async function sha1Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Browser: asks our own proxy route (HIBP sends no CORS-friendly cache headers we control). */
export async function isPasswordPwnedClient(password: string): Promise<boolean> {
  try {
    const hash = await sha1Hex(password);
    const res = await fetch(`/api/auth/pwned?prefix=${hash.slice(0, 5)}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    return rangeContains(await res.text(), hash.slice(5));
  } catch {
    return false;
  }
}

/** Server: talks to HIBP directly. */
export async function isPasswordPwnedServer(password: string): Promise<boolean> {
  try {
    const hash = await sha1Hex(password);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { "Add-Padding": "true", "User-Agent": "qubit-cbt-password-check" },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    return rangeContains(await res.text(), hash.slice(5));
  } catch {
    return false;
  }
}
