// Palet visual game. Satu tempat — ganti warna tanpa bedah renderer.
//
// Dua set warna tier:
//   TIER_COLORS       → untuk kanvas gelap (lane, badge di atas video)
//   TIER_COLORS_INK   → versi lebih gelap untuk teks di latar terang
//                      (kartu skor, daftar vonis) supaya kontrasnya cukup.
import type { Tier } from "../pose/scorer";

export const GAME_COLORS = {
  bg: "#16222f", // = kanvas user di StageView
  laneBg: "#1c2b3a", // = lane di StageView
  gold: "#d99a2b",
  text: "#fff8e7",
  muted: "rgba(255,255,255,.6)",
} as const;

/** Warna semantik tier: HEBAT hijau, KECE emas, KELAZ merah. */
export const TIER_COLORS: Record<Tier, string> = {
  HEBAT: "#4ade80",
  KECE: "#f6c543",
  KELAZ: "#f87171",
};

/** Versi gelap dari tier — untuk teks di atas permukaan terang. */
export const TIER_COLORS_INK: Record<Tier, string> = {
  HEBAT: "#15803d",
  KECE: "#a16207",
  KELAZ: "#b91c1c",
};
