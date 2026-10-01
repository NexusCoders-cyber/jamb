import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { OnlineProvider } from "@/components/OnlineDot";
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
  viewportFit: "cover",          // respect notch / home indicator
  themeColor: "#6557d9",
};

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Qubit | Quick Unified Brain Interactive Test",
    template: "%s | Qubit",
  },
  description:
    "A focused UTME preparation platform for smarter exam preparation and better performance — past questions, mock CBT exams, study plans and analytics.",
  applicationName: "Qubit",
  openGraph: {
    siteName: "Qubit",
    type: "website",
    url: siteUrl,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Qubit",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable}`}>
      <body className="h-full font-[family-name:var(--font-inter)] text-slate-900">
        {/* Page-lifetime presence channel (instant online dots) lives here so
            client-side navigations never tear it down. */}
        <OnlineProvider>{children}</OnlineProvider>
      </body>
    </html>
  );
}
