/**
 * Digital Asset Links — proves to Android that the Play Store app is allowed to open this site full-screen
 * (without a browser address bar). Android fetches /.well-known/assetlinks.json when the app is installed.
 *
 * Set in Vercel → Environment Variables:
 *   ANDROID_PACKAGE_NAME          e.g. com.yourname.qubit   (the package id you chose when building the app)
 *   ANDROID_SHA256_FINGERPRINTS   one or more SHA-256 signing-certificate fingerprints, comma separated
 *                                 (from Play Console → Setup → App signing, and your upload key)
 * Until both are set this returns an empty list, which is valid and harmless.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim();
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));

  const body =
    packageName && fingerprints.length > 0
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: fingerprints },
          },
        ]
      : [];

  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
  });
}
