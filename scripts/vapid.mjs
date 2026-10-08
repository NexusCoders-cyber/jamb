// Prints a fresh VAPID key pair for phone notifications. Run once:  npm run vapid
// Put the three values in your hosting environment variables (NOT in the repo), then redeploy.
import webpush from "web-push";
const k = webpush.generateVAPIDKeys();
console.log(`
VAPID_PUBLIC_KEY=${k.publicKey}
VAPID_PRIVATE_KEY=${k.privateKey}
VAPID_SUBJECT=mailto:you@your-domain.com

Keep the private key secret. If you change these keys later, every phone has to switch notifications on again.
`);
