/**
 * Third-party service clients.
 * ALOC questions are now handled by src/lib/aloc.ts — callAlocApi is kept
 * here only for any legacy direct calls but is no longer used by API routes.
 */

import { Resend } from "resend";
import { getPaystackSecretKey, getResendConfig } from "@/lib/env";

export function createResendClient() {
  return new Resend(getResendConfig().apiKey);
}

export async function verifyPaystackTransaction(reference: string) {
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${getPaystackSecretKey()}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Paystack verification failed with status ${response.status}`);
  }

  return response.json() as Promise<{
    status: boolean;
    data?: { status: string; reference: string; amount: number; currency: string };
  }>;
}
