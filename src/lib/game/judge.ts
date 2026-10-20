// Penilaian segmen — murni, tanpa DOM/rAF. Dipakai loop main + gampang diuji.
import { getPose, type TariReference } from "../pose/reference";
import { bonesFromKeypoints, judgeWindow, scorePose, tierFor, type Tier } from "../pose/scorer";
import type { LaneMark } from "./lane";

export interface Verdict { id: string; t: number; score: number; tier: Tier; }
export interface ScoredFrame { t: number; score: number; }
export type UpperKp = Record<string, [number, number]>;

/** 7 keypoint tubuh-atas dari landmark 0..1 (indeks MediaPipe). */
export function upperKpFromLandmarks(lm: Array<{ x: number; y: number }>): UpperKp | null {
  if (!lm || lm.length < 17) return null;
  const g = (i: number): [number, number] => [lm[i].x, lm[i].y];
  return { nose: g(0), L_shoulder: g(11), R_shoulder: g(12), L_elbow: g(13), R_elbow: g(14), L_wrist: g(15), R_wrist: g(16) };
}

/** Normalisasi kontrak: origin tengah-bahu, skala lebar bahu frame. */
export function normalizeKp(ukp: UpperKp): UpperKp {
  const cx = (ukp.L_shoulder[0] + ukp.R_shoulder[0]) / 2;
  const cy = (ukp.L_shoulder[1] + ukp.R_shoulder[1]) / 2;
  const scale = Math.max(1e-6, Math.hypot(ukp.L_shoulder[0] - ukp.R_shoulder[0], ukp.L_shoulder[1] - ukp.R_shoulder[1]));
  const out: UpperKp = {};
  for (const [k, v] of Object.entries(ukp)) out[k] = [(v[0] - cx) / scale, (v[1] - cy) / scale];
  return out;
}

/** Pose aktif pada `now`: segmen pose yang mengandung now, atau target event ±tol. */
export function activePoseId(ref: TariReference, now: number, tolSec: number): string | null {
  let id: string | null = null;
  for (const s of ref.segments) {
    if (s.type === "pose" && s.scored && now >= s.tStart && now <= s.tEnd) id = s.pose;
    if ((s.type === "swap" || s.type === "bow") && s.scored && Math.abs(now - s.tOnset) <= tolSec) id = s.to;
  }
  return id;
}

/** Skor satu frame user vs pose referensi. Null bila pose tak dikenal. */
export function scoreFrame(ref: TariReference, ukp: UpperKp, poseId: string): number | null {
  try {
    const s = scorePose(bonesFromKeypoints(normalizeKp(ukp)), getPose(ref, poseId).bones, ref.scoring.boneWeights, ref.scoring.sigmaDeg.default);
    return s.score;
  } catch { return null; }
}

/** Vonis segmen yang jatuh tempo pada `now`. Kembalikan vonis baru saja. */
export function dueVerdicts(ref: TariReference, marks: LaneMark[], frames: ScoredFrame[], judged: Set<string>, now: number, opts: { tolSec: number; delayEvent: number; delayPoseEnd: number }): Verdict[] {
  const out: Verdict[] = [];
  for (const m of marks) {
    if (judged.has(m.id)) continue;
    const seg = ref.segments.find((x) => x.id === m.id.split(":")[0]);
    if (!seg || seg.type === "flow") continue;
    const judgeAt = seg.type === "pose" ? seg.tEnd + opts.delayPoseEnd : m.t + opts.delayEvent;
    if (now < judgeAt) continue;
    const [t0, t1] = seg.type === "pose" ? [seg.tStart, seg.tEnd] : [m.t - opts.tolSec, m.t + opts.tolSec];
    const score = judgeWindow(frames, t0, t1);
    judged.add(m.id);
    out.push({ id: m.id, t: m.t, score, tier: tierFor(score) });
  }
  return out;
}

/** Rata-rata vonis → skor akhir. */
export function finalFromVerdicts(vs: Verdict[]): number {
  return vs.length > 0 ? vs.reduce((a, x) => a + x.score, 0) / vs.length : 0;
}
