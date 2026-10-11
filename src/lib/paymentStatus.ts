/**
 * The status a payment row gets once Paystack has confirmed it.
 *
 * It must be one of the labels of the database enum `payment_status` (pending, success, failed, refunded — see
 * supabase/schema_safe.sql). An earlier version wrote "paid", which the database refuses, so real payments stayed
 * "pending" and Pro was never granted. Use this constant everywhere instead of typing the word.
 *
 * Pure (no imports) so `npm test` can check it against the database definition.
 */
export const PAID_STATUS = "success" as const;
