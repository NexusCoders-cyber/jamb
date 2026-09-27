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

export const metadata: Metadata = {
  title: "Orbit Prep | Smart preparation",
  description: "A focused UTME preparation platform for smarter exam preparation and better performance.",
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
