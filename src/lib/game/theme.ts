// Palet visual game. Satu tempat — ganti warna tanpa bedah renderer.
import type { Tier } from "../pose/scorer";

export const GAME_COLORS = {
  bg: "#1d2733",
  laneBg: "#24313f",
  gold: "#f6c543",
  text: "#fff8e7",
  muted: "rgba(255,255,255,.6)",
} as const;

/** Warna semantik tier: HEBAT hijau, KECE emas, KELAZ merah. */
export const TIER_COLORS: Record<Tier, string> = {
  HEBAT: "#4ade80",
  KECE: "#f6c543",
  KELAZ: "#f87171",
};
