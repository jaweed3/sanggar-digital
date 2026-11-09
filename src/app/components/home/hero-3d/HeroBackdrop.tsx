"use client";

// Latar 3D hero — bungkus HeroScene dengan guard:
// - prefers-reduced-motion → tidak render sama sekali (fallback statis tampil)
// - WebGL gagal → HeroScene render div kosong transparan (fallback tampil)
//
// Dipakai via next/dynamic { ssr: false } dari HomeScreen supaya chunk
// three (~150-200 KB) lazy-load dan tidak membengkakkan first paint.

import { HeroScene } from "./HeroScene";
import { useReducedMotion } from "./useReducedMotion";

export function HeroBackdrop({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return <HeroScene className={className} />;
}
