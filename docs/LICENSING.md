# Pro plans, phones and offline — how it works

**One paid account = one Pro phone** (change `pro_max_devices` in `admin_settings` to allow more).

- Every phone is recorded the first time a student opens the app signed in (free or paid). Table: `user_devices`.
- The first phone to open the app after paying takes the licence. Paying on another phone moves it there.
- A second phone using the same login sees "Your Pro plan is active on another phone — upgrade to use it here".
- Admin → Users → **Pro & phones** shows each student's phones, can reset a licence (e.g. a student changed phone) and give or end Pro.

## What identifies a phone
- **Website / PWA / Play-Store web app (Trusted Web Activity):** a random id stored on the phone. A website cannot read the Android ID —
  browsers don't allow it. Clearing the app's data or reinstalling creates a new id (the admin "Reset licence" button covers that).
- **Native Capacitor build (optional, later):** `lib/device.ts` already uses the phone's real Android ID when it runs inside Capacitor
  (`@capacitor/device`), which survives reinstalling. Nothing else needs to change.

## Offline (`lib/licensePolicy.ts`)
- Phone told "not licensed" → stays locked offline (airplane mode doesn't unlock it).
- Licensed phone → works offline for **7 days** after its last online confirmation, then must connect once ("Check your Pro plan" screen — no payment needed).
- Phone clock set backwards doesn't stretch the plan or the 7 days.
- Our own server down while the phone is online → fails open (a paying student is never locked out by our outage).

## Server-side enforcement (`lib/pro-server.ts`)
`/api/aloc` (questions, english-paper, questions-count above 10) and `/api/topics/questions` refuse free accounts (HTTP 402) and,
when the app names its phone (`x-device-id`), phones that don't hold the licence.

## When Pro ends (expiry rules)
- **One source of truth:** `profiles.premium_until`. A student is Pro while it is in the future. The rule lives in `lib/premium.ts`
  (`isProActive`) and every server route plus the app uses it. No date, an unreadable date or a past date = free.
- **Buying more stacks:** a new plan adds its days to the current end date while Pro is still running (weekly + monthly = 37 days).
- **Granting is atomic** (`supabase/atomic_pro_grant.sql`, function `grant_pro_for_payment`): the payment is marked paid and Pro is
  extended in ONE database transaction. A crash half-way saves nothing, so the payment stays pending and the retry grants it; two
  payments confirmed at once both add their days. Without the SQL the app uses the older two-step grant.
- **Plans are never guessed:** a paid row whose plan is not weekly / monthly / biannual / lifetime is refused (logged, left pending),
  not defaulted to 30 days or lifetime. An unreadable paid amount counts as unpaid.
- **Free trial:** length is clamped to 1–30 days, and the write itself only changes an account that never had a trial and is not Pro,
  so two taps at once cannot both claim it.
- **An open app drops Pro on time:** the app re-checks at the moment `premium_until` passes (and when it is brought back to the
  foreground), instead of waiting for the next reload.
- **Server vs outage:** a database error never locks a paying student out, but an account with no profile row gets the free rules.

## Database
`supabase/user_devices.sql`, `supabase/question_bank.sql`, `supabase/security_hardening.sql`, `supabase/atomic_pro_grant.sql` — run each once in the SQL Editor.
`security_hardening.sql` stops students editing their own `role` / `premium_until` (important), and creates `question_reports`.
