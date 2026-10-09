import { createHmac, timingSafeEqual } from "node:crypto";

/** Paystack signs every webhook: HMAC-SHA512 of the raw request body, keyed with your secret key, sent as x-paystack-signature. */
export function signatureOk(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
