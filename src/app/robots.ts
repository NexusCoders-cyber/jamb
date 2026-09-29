import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog", "/novels"],
        disallow: ["/api/", "/admin", "/admin/", "/dashboard", "/exam", "/practice", "/messages", "/settings", "/profile"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
