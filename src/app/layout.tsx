import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { OnlineProvider } from "@/components/OnlineDot";
import OfflineBanner from "@/components/OfflineBanner";
import PwaInstall from "@/components/PwaInstall";
import PushResync from "@/components/PushResync";
import AutoBackup from "@/components/AutoBackup";
import ThemeSync from "@/components/ThemeSync";
import StorageGuard from "@/components/StorageGuard";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init";
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
  // When the keyboard opens, shrink the layout (like a native app) instead of covering the answer field
  interactiveWidget: "resizes-content",
  themeColor: "#6557d9",
};

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://orbitprep.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Qubit Learn | JAMB & UTME Smart Preparation",
    template: "%s | Qubit Learn",
  },
  description:
    "Smart JAMB/UTME preparation platform — 10,000+ past questions, mock CBT exams, study mode with instant explanations, live quiz duels and detailed analytics. Available on Android, desktop and iOS.",
  applicationName: "Qubit Learn",
  keywords: ["JAMB", "UTME", "past questions", "CBT", "JAMB preparation", "Nigeria exam", "UTME practice"],
  authors: [{ name: "Qubit Learn" }],
  manifest: "/manifest.json",
  openGraph: {
    siteName: "Qubit Learn",
    type: "website",
    url: siteUrl,
    title: "Qubit Learn | JAMB & UTME Smart Preparation",
    description: "10,000+ past questions, mock CBT, live duels, study mode with instant explanations. The smartest way to prepare for JAMB.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Qubit Learn" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Qubit Learn | JAMB Preparation",
    description: "Smart JAMB/UTME preparation — past questions, mock CBT, study mode and live duels.",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Qubit Learn",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#6557d9",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script adds the "dark" class to <html> before React loads
    <html lang="en" className={`h-full antialiased ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Runs before first paint so a dark-mode student never sees a white flash */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/icons/icon-96.png" type="image/png" sizes="96x96" />
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="h-full font-[family-name:var(--font-inter)] text-slate-900">
        <ThemeSync />
        <StorageGuard />
        <OnlineProvider>
          {children}
          <PwaInstall />
          <PushResync />
          <AutoBackup />
          <OfflineBanner />
        </OnlineProvider>
      </body>
    </html>
  );
}
