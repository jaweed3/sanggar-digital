// Satu frame loop: deteksi → siluet → kalibrasi/skor → lane. Tanpa React.
// Pemilik state React memanggil step() tiap rAF dan membaca events keluar.
import { CalibrationHold, checkFrame, type GuideBox } from "@/lib/game/calibration";
import type { MasterClock } from "@/lib/game/clock";
import { buildLane, type LaneMark } from "@/lib/game/lane";
import { drawLane, noteJudgedColor, type Sprite } from "@/lib/game/timeline";
import type { PoseEngine } from "@/lib/pose/PoseEngine";
import type { TariReference } from "@/lib/pose/reference";
import { drawUpperBody, userToPx } from "@/lib/pose/silhouette";
import { JUDGE_DELAY_EVENT, JUDGE_DELAY_POSE_END, LANE_HEIGHT, LANE_VELOCITY } from "./config";
import { activePoseId, dueVerdicts, scoreFrame, upperKpFromLandmarks, type ScoredFrame, type Verdict } from "./judge";

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

/** Gambar siluet + panduan (panduan hanya saat kalibrasi). Kembalikan landmark bila ada. */
export function drawUserFrame(r: Runner, cam: HTMLVideoElement, uCan: HTMLCanvasElement, showGuide = false): Array<{ x: number; y: number; visibility?: number }> | null {
  const W = (uCan.width = cam.videoWidth);
  const H = (uCan.height = cam.videoHeight);
  const ctx = uCan.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, W, H);
  const frame = r.engine.detect(cam);
  const lm = frame?.landmarks ?? null;
  if (lm) {
    const pts = userToPx(lm, W, H);
    if (pts) {
      const sw = Math.max(1, Math.hypot(lm[11].x * W - lm[12].x * W, lm[11].y * H - lm[12].y * H));
      drawUpperBody(ctx, pts, { scalePx: sw, color: "#ffffff", mirror: true, W, glow: true });
    }
  }
  const guide = guideBox(W, H);
  if (showGuide) {
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
  const out: FrameEvents = { calibProgress: p, calibHint: cf.ok ? `Tahan… ${Math.round(p * 100)}%` : hintFor(cf.reasons) };
  if (r.hold.done) out.calibDone = true;
  return out;
}

/** Step main: skor frame, vonis jatuh tempo, gambar lane. */
export function stepMain(r: Runner, lm: Array<{ x: number; y: number; visibility?: number }> | null, lCan: HTMLCanvasElement): FrameEvents {
  const now = r.clock.now();
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
