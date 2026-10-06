import type { MetadataRoute } from "next";

/**
 * The one web-app manifest (served at /manifest.webmanifest and, via a rewrite in
 * next.config.ts, at the legacy /manifest.json URL the layout and older installs use).
 * It drives "Add to Home screen" AND the Android app packaged for Google Play.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Keeps the identity existing installs already have (it used to default to start_url)
    id: "/dashboard",
    name: "Qubit — JAMB & UTME Prep",
    short_name: "Qubit",
    description: "Qubit: JAMB/UTME past questions, mock CBT exams, live quiz duels, study plans and analytics.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "en-NG",
    categories: ["education"],
    background_color: "#f5f4ff",
    theme_color: "#6557d9",
    icons: [
      { src: "/logo-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/logo-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Full-bleed versions so Android's round/squircle masks never show white corners
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mock exam", short_name: "Mock", url: "/exam", icons: [{ src: "/logo-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Practice", short_name: "Practice", url: "/practice", icons: [{ src: "/logo-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Arena duel", short_name: "Arena", url: "/arena", icons: [{ src: "/logo-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
