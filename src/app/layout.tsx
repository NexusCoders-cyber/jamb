import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { OnlineProvider } from "@/components/OnlineDot";
import PwaInstall from "@/components/PwaInstall";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#6557d9",
};

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://orbitprep.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Orbit Prep | JAMB & UTME Smart Preparation",
    template: "%s | Orbit Prep",
  },
  description:
    "Smart JAMB/UTME preparation platform — 10,000+ past questions, mock CBT exams, study mode with instant explanations, live quiz duels and detailed analytics. Available on Android, desktop and iOS.",
  applicationName: "Orbit Prep",
  keywords: ["JAMB", "UTME", "past questions", "CBT", "JAMB preparation", "Nigeria exam", "UTME practice"],
  authors: [{ name: "Orbit Prep" }],
  manifest: "/manifest.json",
  openGraph: {
    siteName: "Orbit Prep",
    type: "website",
    url: siteUrl,
    title: "Orbit Prep | JAMB & UTME Smart Preparation",
    description: "10,000+ past questions, mock CBT, live duels, study mode with instant explanations. The smartest way to prepare for JAMB.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Orbit Prep" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Orbit Prep | JAMB Preparation",
    description: "Smart JAMB/UTME preparation — past questions, mock CBT, study mode and live duels.",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Orbit Prep",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#6557d9",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable}`}>
      <head>
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="h-full font-[family-name:var(--font-inter)] text-slate-900">
        <OnlineProvider>
          {children}
          <PwaInstall />
        </OnlineProvider>
      </body>
    </html>
  );
}
