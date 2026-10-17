import type { NextConfig } from "next";
import { execSync } from "node:child_process";

/**
 * Which build of the app is this? Baked into the app at build time (and read back by /api/version) so a phone that is
 * still running an older copy can tell a newer one has been published and offer the "Update available" card.
 * The git commit is used when it is known (the same commit always gives the same id); a timestamp is the fallback.
 */
function buildId(): string {
  const fromHost = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (fromHost) return fromHost.slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || Date.now().toString(36);
  } catch {
    return Date.now().toString(36);
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,

  env: {
    NEXT_PUBLIC_BUILD_ID: buildId(),
    // When this build was made; the card only offers builds NEWER than the one running (never a rollback)
    NEXT_PUBLIC_BUILD_TIME: String(Date.now()),
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "questions.aloc.com.ng" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },

  async headers() {
    return [
      {
        // The browser must always re-check the service worker so fixes reach phones quickly
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              // https: (any host) — ALOC diagrams are not guaranteed to live on the three hosts we used to allow,
              // and a blocked image just silently disappears. Scripts/connect stay locked down.
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.supabase.co https://api.paystack.co https://questions.aloc.com.ng https://res.cloudinary.com wss://*.supabase.co",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // Silence the Supabase ssr peer-dep warning
  serverExternalPackages: [],
};

export default nextConfig;
