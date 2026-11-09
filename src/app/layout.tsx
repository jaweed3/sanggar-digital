import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Tipografi sesuai brand/BRAND_DIRECTION.md:
//   Heading → Plus Jakarta Sans (semibold), Body → Inter.
// Brand juga menyatakan "hindari font script untuk body text", jadi
// serif tidak dipakai lagi di UI.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Sanggar Digital — Gerak Tradisi, Hidup Kembali",
  description:
    "Latihan tari tradisional dengan panduan kamera dan feedback yang membantu. Belajar dari gerak yang terverifikasi, bukan sekadar meniru video.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${inter.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
