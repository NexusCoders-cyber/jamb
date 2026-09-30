import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Qubit — Quick Unified Brain Interactive Test",
    short_name: "Qubit",
    description: "Qubit: JAMB/UTME past questions, mock CBT exams, study plans and analytics.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f4ff",
    theme_color: "#6557d9",
    icons: [
      { src: "/logo-192.png", sizes: "192x192", type: "image/png" },
      { src: "/logo-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
