import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Orbit Prep | Smart preparation",
  description: "A focused learning platform for smarter exam preparation and better performance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable}`}>
      <body className="min-h-full bg-[#eef2ff] font-[family-name:var(--font-inter)] text-slate-900">
        {children}
      </body>
    </html>
  );
}
