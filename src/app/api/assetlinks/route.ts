import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Digital Asset Links — served at /.well-known/assetlinks.json (see rewrite in next.config.ts).
 *
 * This file is what lets the Android app open Qubit full-screen WITHOUT a browser address bar:
 * Android checks that this website vouches for the app's signing key.
 *
 * Set in Vercel:
 *   ANDROID_PACKAGE_NAME        e.g. com.yourname.qubit  (must match the package in Play Console)
 *   ANDROID_SHA256_FINGERPRINTS SHA-256 certificate fingerprint(s), comma-separated. Use the one from
 *                               Play Console → Setup → App signing ("App signing key certificate"),
 *                               plus your upload key's if you also sideload test builds.
 * Until both are set this returns an empty list (harmless).
 */
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function GET() {
  const pkg = (process.env.ANDROID_PACKAGE_NAME ?? "").trim();
  const prints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? "")
    .split(/[\s,]+/)
    .map((f) => f.trim().toUpperCase())
    .filter((f) => FINGERPRINT.test(f));

  const body =
    pkg && prints.length > 0
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: prints },
          },
        ]
      : [];

  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=300" } });
}
