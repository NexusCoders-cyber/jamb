import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Orbit Prep — UTME & JAMB Preparation",
    short_name: "Orbit Prep",
    description: "JAMB/UTME past questions, mock CBT exams, study plans and analytics.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f4ff",
    theme_color: "#6557d9",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
