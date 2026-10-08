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

## Database
`supabase/user_devices.sql`, `supabase/question_bank.sql`, `supabase/security_hardening.sql` — run each once in the SQL Editor.
`security_hardening.sql` stops students editing their own `role` / `premium_until` (important), and creates `question_reports`.
