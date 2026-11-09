// Test lapis pose: filter One Euro + pemetaan keypoint.
//
// Why test ini ada: filter One Euro параметernya dulu ditulis inline
// (mincutoff=1.0) dan tak pernah diuji — bug latensi 138 ms lolos tanpa
// terdeteksi. Test di bawah mengunci NILAI PARAMETER, jadi siapa pun yang
// mengubahnya harus sadar sedang menukar latensi dengan jitter.
//
// Jalankan: bun test
import { describe, expect, test } from "bun:test";
import { OneEuroFilter } from "../lib/pose/oneEuro";
import { POSE_FILTER_BETA, POSE_FILTER_DCUTOFF, POSE_FILTER_MINCUTOFF } from "../lib/pose/types";
import { IDX, MIN_LANDMARKS, shoulderWidthPx, upperKpFromLandmarks, upperKpToPx } from "../lib/pose/keypoints";

/** Landmark tiruan 33 titik; 0..16 diisi sendi tubuh-atas. */
function fakeLandmarks(): Array<{ x: number; y: number; visibility: number }> {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  lm[IDX.nose] = { x: 0.5, y: 0.2, visibility: 0.9 };
  lm[IDX.L_shoulder] = { x: 0.4, y: 0.3, visibility: 0.9 };
  lm[IDX.R_shoulder] = { x: 0.6, y: 0.3, visibility: 0.9 };
  lm[IDX.L_elbow] = { x: 0.35, y: 0.45, visibility: 0.9 };
  lm[IDX.R_elbow] = { x: 0.65, y: 0.45, visibility: 0.9 };
  lm[IDX.L_wrist] = { x: 0.3, y: 0.6, visibility: 0.9 };
  lm[IDX.R_wrist] = { x: 0.7, y: 0.6, visibility: 0.9 };
  return lm;
}

describe("parameter filter One Euro (kunci latensi)", () => {
  test("mincutoff = 2.0 — group delay 71 ms, bukan 138 ms", () => {
    // mincutoff=1.0 memberi group delay ~138 ms pada gerak tangan dan itu
    // penyebab utama "kurang real time". Jangan dikembalikan ke 1.0 tanpa
    // mengukur ulang (docs/LATENCY.md).
    expect(POSE_FILTER_MINCUTOFF).toBe(2.0);
    expect(POSE_FILTER_BETA).toBe(0.05);
    expect(POSE_FILTER_DCUTOFF).toBe(1.0);
  });
});

describe("OneEuroFilter", () => {
  test("frame pertama diteruskan tanpa smoothing", () => {
    const f = new OneEuroFilter(2.0, 0.05, 1.0);
    expect(f.filter(0.42, 0)).toBeCloseTo(0.42, 10);
  });

  test("meredam noise statis", () => {
    const f = new OneEuroFilter(2.0, 0.05, 1.0);
    const out: number[] = [];
    // Noise deterministik di sekitar 0.5 pada 60 Hz selama 1 detik.
    for (let i = 0; i < 60; i++) {
      const noise = 0.5 + (i % 2 === 0 ? 0.002 : -0.002);
      out.push(f.filter(noise, i / 60));
    }
    const tail = out.slice(30);
    const spread = Math.max(...tail) - Math.min(...tail);
    // Deviasi jauh lebih kecil dari amplitudo noise mentah (0.004).
    expect(spread).toBeLessThan(0.002);
  });

  test("mengikuti sinyal yang bergerak (tidak macet seperti moving average)", () => {
    const f = new OneEuroFilter(2.0, 0.05, 1.0);
    // Ramp 0 → 1 selama 1 detik, 60 Hz.
    let last = 0;
    for (let i = 0; i < 60; i++) last = f.filter(i / 60, i / 60);
    // Nilai akhir harus mendekati input terakhir (1.0), bukan tertinggal jauh.
    expect(last).toBeGreaterThan(0.9);
  });

  test("reset() mengembalikan filter ke keadaan awal", () => {
    const f = new OneEuroFilter(2.0, 0.05, 1.0);
    f.filter(0.5, 0);
    f.filter(0.9, 1 / 60);
    f.reset();
    // Setelah reset, frame pertama kembali diteruskan apa adanya.
    expect(f.filter(0.123, 2 / 60)).toBeCloseTo(0.123, 10);
  });

  test("step waktu tidak monotonik tidak merusak filter", () => {
    const f = new OneEuroFilter(2.0, 0.05, 1.0);
    f.filter(0.5, 0);
    const v = f.filter(0.5, -1); // dt negatif → harus di-clamp, tidak NaN
    expect(Number.isFinite(v)).toBe(true);
  });
});

describe("pemetaan keypoint", () => {
  test("landmark kurang dari 17 titik ditolak", () => {
    expect(upperKpFromLandmarks([])).toBeNull();
    expect(upperKpFromLandmarks(null)).toBeNull();
    const short = fakeLandmarks().slice(0, MIN_LANDMARKS - 1);
    expect(upperKpFromLandmarks(short)).toBeNull();
  });

  test("tujuh sendi tubuh-atas diambil dari indeks yang benar", () => {
    const lm = fakeLandmarks();
    const ukp = upperKpFromLandmarks(lm)!;
    expect(ukp.nose).toEqual([lm[IDX.nose].x, lm[IDX.nose].y]);
    expect(ukp.L_wrist).toEqual([lm[IDX.L_wrist].x, lm[IDX.L_wrist].y]);
    expect(ukp.R_elbow).toEqual([lm[IDX.R_elbow].x, lm[IDX.R_elbow].y]);
    expect(Object.keys(ukp).sort()).toEqual(
      ["L_elbow", "L_shoulder", "L_wrist", "R_elbow", "R_shoulder", "R_wrist", "nose"].sort(),
    );
  });

  test("konversi ke piksel mengikuti rasio W/H", () => {
    const lm = fakeLandmarks();
    const ukp = upperKpFromLandmarks(lm)!;
    const px = upperKpToPx(ukp, 640, 480);
    expect(px.nose.x).toBeCloseTo(0.5 * 640, 10);
    expect(px.nose.y).toBeCloseTo(0.2 * 480, 10);
  });

  test("lebar bahu dihitung dalam piksel", () => {
    const lm = fakeLandmarks();
    const ukp = upperKpFromLandmarks(lm)!;
    // Bahu di x=0.4 dan x=0.6 → selisih 0.2 * W
    expect(shoulderWidthPx(ukp, 1000, 1000)).toBeCloseTo(200, 6);
  });
});
