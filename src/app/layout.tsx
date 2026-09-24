import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orbit Prep | Smart preparation",
  description: "A focused learning platform for smarter exam preparation and better performance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#eef2ff] text-slate-900">{children}</body>
    </html>
  );
}
