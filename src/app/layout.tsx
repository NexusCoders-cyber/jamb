import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
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
    default: "Orbit Prep | Smart UTME & JAMB preparation",
    template: "%s | Orbit Prep",
  },
  description:
    "A focused UTME preparation platform for smarter exam preparation and better performance — past questions, mock CBT exams, study plans and analytics.",
  applicationName: "Orbit Prep",
  openGraph: {
    siteName: "Orbit Prep",
    type: "website",
    url: siteUrl,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Orbit Prep",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable}`}>
      <body className="h-full font-[family-name:var(--font-inter)] text-slate-900">
        {children}
      </body>
    </html>
  );
}
