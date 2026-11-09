// Sumber kebenaran indeks + keypoint tubuh-atas.
//
// SEBABUNYA MODUL INI ADA: indeks MediaPipe (0, 11..16) sebelumnya ditulis
// tangan di 4 file (silhouette, judge, calibration, runner) dan konstanta
// IDX di types.ts tidak pernah dipakai. Satu lokasi ini menutup celah itu:
// ubah pemetaan di sini, seluruh aplikasi ikut berubah.
//
// Layer: pose (dasar) — game dan app boleh memakainya, tapi pose tidak
// boleh bergantung ke game.

/** Indeks MediaPipe Pose (33 titik). Tubuh-atas saja yang dipakai. */
export const IDX = {
  nose: 0,
  L_shoulder: 11,
  R_shoulder: 12,
  L_elbow: 13,
  R_elbow: 14,
  L_wrist: 15,
  R_wrist: 16,
} as const;

/** Nama keypoint tubuh-atas — kunci yang dipakai scorer & renderer. */
export const UPPER_KP_NAMES = [
  "nose",
  "L_shoulder",
  "R_shoulder",
  "L_elbow",
  "R_elbow",
  "L_wrist",
  "R_wrist",
] as const;

export type UpperKpName = (typeof UPPER_KP_NAMES)[number];

/** Sendi wajib terlihat saat kalibrasi (tanpa hidung). */
export const UPPER_BODY_JOINTS: readonly number[] = UPPER_KP_NAMES.filter((n) => n !== "nose").map(
  (n) => IDX[n],
);

/** Keypoint tubuh-atas ternormalisasi (0..1) atau piksel. */
export type UpperKp = Record<string, [number, number]>;

export type Pt = { x: number; y: number };

/** Keypoint tubuh-atas dalam piksel kanvas — bentuk yang dipakai renderer. */
export type UpperBodyPts = {
  nose: Pt;
  L_shoulder: Pt;
  R_shoulder: Pt;
  L_elbow: Pt;
  R_elbow: Pt;
  L_wrist: Pt;
  R_wrist: Pt;
};

/** Landmark minimal 17 titik (0..16) agar tujuh sendi tubuh-atas tersedia. */
export const MIN_LANDMARKS = 17;

/**
 * Landmark (indeks MediaPipe) → keypoint bernama, ternormalisasi.
 * Null bila landmark kurang dari 17 titik.
 */
export function upperKpFromLandmarks(
  lm: Array<{ x: number; y: number }> | null | undefined,
): UpperKp | null {
  if (!lm || lm.length < MIN_LANDMARKS) return null;
  const g = (i: number): [number, number] => [lm[i].x, lm[i].y];
  return {
    nose: g(IDX.nose),
    L_shoulder: g(IDX.L_shoulder),
    R_shoulder: g(IDX.R_shoulder),
    L_elbow: g(IDX.L_elbow),
    R_elbow: g(IDX.R_elbow),
    L_wrist: g(IDX.L_wrist),
    R_wrist: g(IDX.R_wrist),
  };
}

/** Keypoint bernama (ternormalisasi) → piksel kanvas. */
export function upperKpToPx(ukp: UpperKp, W: number, H: number): UpperBodyPts {
  return mapUpperKp(ukp, (v) => ({ x: v[0] * W, y: v[1] * H }));
}

/**
 * Keypoint bernama → UpperBodyPts lewat fungsi pemetaan koordinat.
 * Dipakai juga untuk sprite pictogram (skala/offset berbeda).
 */
export function mapUpperKp(ukp: UpperKp, toPt: (v: [number, number]) => Pt): UpperBodyPts {
  const g = (k: UpperKpName): Pt => toPt(ukp[k]);
  return {
    nose: g("nose"),
    L_shoulder: g("L_shoulder"),
    R_shoulder: g("R_shoulder"),
    L_elbow: g("L_elbow"),
    R_elbow: g("R_elbow"),
    L_wrist: g("L_wrist"),
    R_wrist: g("R_wrist"),
  };
}

/** Lebar bahu dalam piksel — skala normalisasi user & ukuran corak siluet. */
export function shoulderWidthPx(ukp: UpperKp, W: number, H: number): number {
  const a = ukp.L_shoulder;
  const b = ukp.R_shoulder;
  return Math.hypot((a[0] - b[0]) * W, (a[1] - b[1]) * H);
}
