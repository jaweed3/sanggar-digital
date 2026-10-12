import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sanggar Digital — Gerak Tradisi, Hidup Kembali",
  description: "Interactive AI-assisted practice tool for Indonesian traditional dance.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
