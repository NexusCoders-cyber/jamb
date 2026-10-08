# Blog + phone notifications

**Students** — Blog is in the app menu (and a card on Home). New articles show a NEW tag; articles they have opened are
saved on the phone so they can be read offline. In Settings → Notifications a student switches phone notifications on
for *this phone* and chooses "New articles" and/or "Announcements".

**Admins** — Admin → Blog: write, publish, add a cover image. Ticking "Tell students when this goes live" sends one
in-app notification to everyone and one phone notification to every phone that switched on "New articles". The bell
button on a live post sends it (again) by hand. Admin → Announcements also sends a phone notification now.

## One-time setup
1. Run `supabase/push.sql` in the Supabase SQL Editor.
2. Run `npm run vapid` once. Put the three values it prints (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`)
   in your hosting environment variables and redeploy. Never commit the private key. Changing the keys later means every
   phone has to switch notifications on again.

## Good to know
- Works in Chrome/Edge/Firefox on Android, in the installed app (TWA) and on desktop. iPhone only after "Add to Home Screen".
- A phone that uninstalls or revokes permission is removed automatically the next time a notification is sent to it.
- The same account can be signed in on several phones; each phone is registered separately and one phone belongs to
  whoever is signed in on it now.
- Without the keys everything else still works; the admin Blog page shows what is missing.
