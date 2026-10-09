# Putting Qubit Learn on the Google Play Store

Qubit Learn is a Progressive Web App. The Play Store version is a thin Android wrapper (a **Trusted Web Activity**) that opens
your live site full-screen with no browser bar. Updates you deploy to the site show up in the Android app instantly —
no new Play release needed for normal changes.

## 0. Before you start
- Google Play Console account (one-time US$25). New *personal* accounts must run a **closed test with 12+ testers for
  14 days** before they can publish to production. Organisation accounts skip this.
- Your site must be on a real HTTPS domain (e.g. `https://qubit.ng`), set in Vercel as `NEXT_PUBLIC_APP_URL`.
- Decide the **package name** once (cannot change later), e.g. `ng.qubit.app` or `com.yourname.qubit`.

## 1. Build the Android app (no coding)
1. Open **https://www.pwabuilder.com**, paste your site URL, click *Start*.
2. It should show the manifest and service worker as passing (the repo now ships valid icons, manifest, offline support).
3. Click *Package for stores → Android → Google Play*. Enter your package name, app name **Qubit Learn**, and let PWABuilder
   generate a new signing key. **Download the zip and keep the key file + passwords safe forever** — losing them means you
   can never update the app.
4. The zip contains `app-release-bundle.aab` (upload this to Play) and `assetlinks.json` snippets with the key's SHA-256.

(Alternative for developers: `npm i -g @bubblewrap/cli`, then `bubblewrap init --manifest https://YOUR-DOMAIN/manifest.json`
and `bubblewrap build`.)

## 2. Remove the address bar (Digital Asset Links)
In **Vercel → Settings → Environment Variables** add, then redeploy:

| Name | Value |
|---|---|
| `ANDROID_PACKAGE_NAME` | the package name you chose |
| `ANDROID_SHA256_FINGERPRINTS` | SHA-256 fingerprint(s), comma separated |

Use the fingerprint from PWABuilder **and** the one Google shows in *Play Console → Setup → App signing* (Play re-signs
your app, so both are needed). Check `https://YOUR-DOMAIN/.well-known/assetlinks.json` lists them. Until this is correct
the app shows a browser bar at the top.

## 3. Play Console listing
Everything you need is in the `play-store/` folder: `app-icon-512.png`, `feature-graphic-1024x500.png`,
`phone-*.png` screenshots, and the text in `play-store/listing.md`.

Required web addresses (already live in this app):
- Privacy policy: `https://YOUR-DOMAIN/privacy`
- Account/data deletion: `https://YOUR-DOMAIN/delete-account` (Play requires this; deletion also works in Settings)

Complete *App content*: Privacy policy, Ads (none), App access (give reviewers a test login), Content rating
(education, no violence), Target audience (13+ / 16+ recommended since there is chat), Data safety (see `listing.md`).

## 4. ⚠️ Payments policy — read before submitting
Google Play requires **Google Play Billing** for digital subscriptions sold *inside* an app distributed on Play. Qubit Learn
Pro is sold through **Paystack**. As of the Play help page checked on 6 Oct 2026, Nigeria is not listed among the
countries with alternative-billing programs, so an app that sells Pro through Paystack can be **rejected or suspended**.

Options:
1. **Free-tier first release:** publish without the Pro purchase screens in the Android build, add Play Billing later.
2. **Add Google Play Billing** (Digital Goods API for Trusted Web Activities + server-side receipt checks).
3. Ask Play support whether your situation qualifies for an exception.

This is a business/policy decision — ask a developer to implement whichever you choose before submitting.

## 5. Testing checklist
- Install the `.aab` via *Internal testing* on your Android 16 phone.
- Opens full-screen with no address bar (needs step 2).
- Sign in, take an exam, turn on airplane mode, open Offline packs content.
- Back button shows "Leave this exam?" during an exam.
