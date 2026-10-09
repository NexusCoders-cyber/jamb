# Payments

Student taps Pay → `/api/payments/checkout` (or `/api/premium/checkout`) creates a Paystack transaction and saves a
`payments` row (plan, price, and which phone is paying). When the payment succeeds, Pro is switched on by whichever
of these arrives first — they all use `src/lib/payment-finalize.ts`, so Pro is granted exactly once:

1. the app's own check right after paying (`/api/payments/verify`, `/api/premium/confirm`);
2. **Paystack's webhook** (`/api/payments/webhook`) — works even if the student closed the app or lost signal.

## One-time setup
Paystack dashboard → Settings → API Keys & Webhooks → set **Live Webhook URL** to
`https://YOUR-DOMAIN/api/payments/webhook` (Admin → Payments shows the exact address). Use the test URL box for test mode.

## Safety rules the webhook follows
- Rejects anything without a valid `x-paystack-signature` (HMAC-SHA512 of the body with your secret key).
- Only honours references our own checkout created; plan and price come from our record, never from event metadata.
- Amount paid must cover the price we quoted.
- If anything fails halfway, the payment goes back to "pending" and Paystack's retry (or the app) finishes it.
