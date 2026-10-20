// Scorer MURNI: tanpa DOM, tanpa state, tanpa waktu. Input: vektor bone 2D.
// Rumus ini dimirror di scripts/scorer_mirror.py — golden test
// (scripts/golden-check.mjs) memastikan TS dan Python identik.
// Tanpa itu, validasi Python tidak berlaku untuk app yang dinilai juri.

export type BoneMap = Record<string, [number, number]>;

export interface PoseScore {
  score: number; // 0..100
  perBone: Record<string, { errDeg: number; boneScore: number; weight: number }>;
}

/** Sudut (derajat) antara dua vektor bone 2D. */
export function angleErrDeg(a: [number, number], b: [number, number]): number {
  const dot = a[0] * b[0] + a[1] * b[1];
  const cross = a[0] * b[1] - a[1] * b[0];
  return (Math.abs(Math.atan2(cross, dot)) * 180) / Math.PI;
}

/** Bone dari 7 keypoint tubuh-atas (koordinat ternormalisasi apa pun, asal konsisten). */
export function bonesFromKeypoints(kp: Record<string, [number, number]>): BoneMap {
  const sub = (p: string, q: string): [number, number] => [kp[p][0] - kp[q][0], kp[p][1] - kp[q][1]];
  const norm = (v: [number, number]): [number, number] => {
    const n = Math.hypot(v[0], v[1]) || 1;
    return [v[0] / n, v[1] / n];
  };
  return {
    L_upper: norm(sub("L_elbow", "L_shoulder")),
    L_fore: norm(sub("L_wrist", "L_elbow")),
    R_upper: norm(sub("R_elbow", "R_shoulder")),
    R_fore: norm(sub("R_wrist", "R_elbow")),
    shoulders: norm(sub("L_shoulder", "R_shoulder")),
  };
}

/**
 * Kecocokan pose: gaussian per bone lalu rata-rata berbobot.
 * score_bone = exp(-0.5 * (err/sigma)^2); total = 100 * Σw·s / Σw.
 */
export function scorePose(
  userBones: BoneMap,
  refBones: BoneMap,
  weights: Record<string, number>,
  sigmaDeg: number,
): PoseScore {
  const perBone: PoseScore["perBone"] = {};
  let num = 0;
  let den = 0;
  for (const bone of Object.keys(refBones)) {
    const u = userBones[bone];
    const r = refBones[bone];
    if (!u || !r) continue;
    const w = weights[bone] ?? 1;
    const errDeg = angleErrDeg(u, r);
    const boneScore = Math.exp(-0.5 * (errDeg / sigmaDeg) ** 2);
    perBone[bone] = { errDeg, boneScore, weight: w };
    num += w * boneScore;
    den += w;
  }
  return { score: den > 0 ? (100 * num) / den : 0, perBone };
}

/** Agregat frame {t, score} dalam jendela → rata-rata (0 bila kosong). */
export function judgeWindow(frames: Array<{ t: number; score: number }>, t0: number, t1: number): number {
  const inWin = frames.filter((f) => f.t >= t0 && f.t <= t1);
  if (inWin.length === 0) return 0;
  return inWin.reduce((a, f) => a + f.score, 0) / inWin.length;
}

export type Tier = "KELAZ" | "KECE" | "HEBAT";

// PLACEHOLDER — ganti dari distribusi skor 3 kelompok (penari/terlatih/awam).
// scoring.tiers.calibrated=false di kontrak data sampai itu ada.
export const TIERS_UNCALIBRATED = { HEBAT: 75, KECE: 55 } as const;

export function tierFor(score: number, t = TIERS_UNCALIBRATED): Tier {
  if (score >= t.HEBAT) return "HEBAT";
  if (score >= t.KECE) return "KECE";
  return "KELAZ";
}
