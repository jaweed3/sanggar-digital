// Satu frame loop: deteksi → siluet → kalibrasi/skor → lane. Tanpa React.
// Pemilik state React memanggil step() tiap rAF dan membaca events keluar.
//
// Komposisi (semua dipecah supaya tiap bagian satu tanggung jawab):
//   silhouette-layer.ts  layer siluet persisten (anti-flicker)
//   calibration.ts       aturan kalibrasi (murni)
//   judge.ts             penilaian segmen (murni)
//   lane.ts + timeline.ts  lane & pictogram
//
// runner.ts hanya merangkai potongan-potongan itu.

import { CalibrationHold, checkFrame, type GuideBox } from "./calibration";
import type { MasterClock } from "./clock";
import { buildLane, type LaneMark } from "./lane";
import { drawLane, noteJudgedColor, type Sprite } from "./timeline";
import { createSilhouetteLayer, type SilhouetteLayer } from "./silhouette-layer";
import type { PoseEngine } from "../pose/PoseEngine";
import type { TariReference } from "../pose/reference";
import { drawUpperBody } from "../pose/silhouette";
import { shoulderWidthPx, upperKpFromLandmarks, upperKpToPx } from "../pose/keypoints";
import {
  JUDGE_DELAY_EVENT,
  JUDGE_DELAY_POSE_END,
  LANE_HEIGHT,
  LANE_VELOCITY,
  SCORE_TIME_OFFSET_SEC,
} from "./config";
import { activePoseId, dueVerdicts, scoreFrame, type ScoredFrame, type Verdict } from "./judge";

export interface Runner {
  engine: PoseEngine;
  ref: TariReference;
  clock: MasterClock;
  hold: CalibrationHold;
  sprites: Sprite[];
  marks: LaneMark[];
  frames: ScoredFrame[];
  judged: Set<string>;
  tolSec: number;
  /** Layer siluet persisten — siluet tidak boleh berkedip antar frame. */
  silhouette: SilhouetteLayer;
}

export function createRunner(engine: PoseEngine, ref: TariReference, clock: MasterClock, sprites: Sprite[]): Runner {
  return {
    engine, ref, clock,
    hold: new CalibrationHold(),
    sprites,
    marks: buildLane(ref.segments),
    frames: [],
    judged: new Set(),
    tolSec: (ref.scoring.timing.toleranceMs ?? 300) / 1000,
    silhouette: createSilhouetteLayer(),
  };
}

export interface FrameEvents {
  calibProgress?: number;
  calibHint?: string;
  calibDone?: boolean;
  liveScore?: number;
  newVerdicts?: Verdict[];
}

export function hintFor(reasons: string[]): string {
  if (reasons.some((r) => r.startsWith("visibilitas-rendah"))) return "Pastikan bahu, siku, dan pergelangan terlihat";
  if (reasons.includes("di-luar-panduan")) return "Masuk ke kotak panduan";
  if (reasons.includes("tubuh-keluar-frame")) return "Mundur sedikit agar tubuh masuk frame";
  return "Masuk ke kotak panduan";
}

/**
 * Gambar siluet + panduan (panduan hanya saat kalibrasi). Kembalikan landmark bila ada.
 *
 * Dua lapis, dari bawah ke atas:
 *   1. layer siluet (offscreen, persisten) — isi terakhir yang diketahui
 *   2. kanvas utama — salinan layer siluet + kotak panduan (kritis, tiap tick)
 */
export function drawUserFrame(r: Runner, cam: HTMLVideoElement, uCan: HTMLCanvasElement, showGuide = false): Array<{ x: number; y: number; visibility?: number }> | null {
  const W = cam.videoWidth;
  const H = cam.videoHeight;
  if (W === 0 || H === 0) return null;
  const ctx = uCan.getContext("2d");
  if (!ctx) return null;
  // Resize hanya bila berubah — setting ulang width tiap frame membuang
  // backing store dan menambah biaya.
  if (uCan.width !== W) uCan.width = W;
  if (uCan.height !== H) uCan.height = H;

  const frame = r.engine.detect(cam);
  const lm = frame?.landmarks ?? null;

  // Layer 1: siluet — hanya digambar ulang bila ada frame kamera BARU.
  r.silhouette.update(frame, W, H, (sctx) => {
    if (!lm) return;
    const ukp = upperKpFromLandmarks(lm);
    if (!ukp) return;
    const sw = Math.max(1, shoulderWidthPx(ukp, W, H));
    drawUpperBody(sctx, upperKpToPx(ukp, W, H), { scalePx: sw, color: "#ffffff", mirror: true, W, glow: true });
  });

  // Layer 2: kanvas utama — salin siluet persisten, lalu gambar panduan di atasnya.
  ctx.clearRect(0, 0, W, H);
  r.silhouette.blitTo(ctx);
  if (showGuide) {
    const guide = guideBox(W, H);
    ctx.strokeStyle = "rgba(246,197,67,.6)";
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 3;
    ctx.strokeRect(guide.x, guide.y, guide.w, guide.h);
    ctx.setLineDash([]);
  }
  return lm;
}

export function guideBox(W: number, H: number): GuideBox {
  return { x: W * 0.2, y: H * 0.05, w: W * 0.6, h: H * 0.9 };
}

/** Step kalibrasi. Kembalikan events bila progres berubah / selesai. */
export function stepCalibration(r: Runner, lm: Array<{ x: number; y: number; visibility?: number }>, W: number, H: number): FrameEvents {
  const cf = checkFrame(lm, W, H, guideBox(W, H));
  const p = r.hold.update(cf, performance.now());
  const out: FrameEvents = { calibProgress: p, calibHint: cf.ok ? `Tahan... ${Math.round(p * 100)}%` : hintFor(cf.reasons) };
  if (r.hold.done) out.calibDone = true;
  return out;
}

/**
 * Step main: skor frame, vonis jatuh tempo, gambar lane.
 *
 * Waktu penilaian memakai `t = clock.now() + SCORE_TIME_OFFSET_SEC`.
 * Pipeline (penangkapan kamera ~1 frame + group delay filter ~71 ms + deteksi
 * ~10 ms) membuat kita SELALU melihat keadaan user sekitar 100 ms yang lalu.
 * Tanpa kompensasi, pose user dibandingkan dengan segmen referensi yang
 * 100 ms terlalu maju — user harus bergerak lebih cepat dari video agar
 * dianggap cocok. Offset yang sama dipakai untuk lane supaya garis target
 * dan penilaian konsisten: yang diukur adalah keadaan user "sekarang",
 * bukan keadaan user 100 ms lalu.
 */
export function stepMain(r: Runner, lm: Array<{ x: number; y: number; visibility?: number }> | null, lCan: HTMLCanvasElement): FrameEvents {
  const now = r.clock.now() + SCORE_TIME_OFFSET_SEC;
  const out: FrameEvents = {};
  const poseId = activePoseId(r.ref, now, r.tolSec);
  if (lm && poseId) {
    const ukp = upperKpFromLandmarks(lm);
    if (ukp) {
      const s = scoreFrame(r.ref, ukp, poseId);
      if (s != null) {
        r.frames.push({ t: now, score: s });
        out.liveScore = s;
      }
    }
  }
  const fresh = dueVerdicts(r.ref, r.marks, r.frames, r.judged, now, {
    tolSec: r.tolSec, delayEvent: JUDGE_DELAY_EVENT, delayPoseEnd: JUDGE_DELAY_POSE_END,
  });
  for (const vd of fresh) noteJudgedColor(vd.id, vd.tier);
  if (fresh.length > 0) out.newVerdicts = fresh;
  const lw = (lCan.width = lCan.clientWidth || 640);
  const lh = (lCan.height = LANE_HEIGHT);
  const ctx = lCan.getContext("2d");
  if (ctx) {
    drawLane(ctx, r.marks, r.sprites, now, { W: lw, H: lh, xTarget: lw - 90, v: LANE_VELOCITY, judgedIds: r.judged });
  }
  return out;
}
