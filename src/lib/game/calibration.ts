// Kalibrasi: lolos jika bahu+siku+pergelangan visibility > 0.6 dan bbox
// masuk area panduan, ditahan 1.5 dtk. Median lebar bahu = skala user.

import { CALIBRATION_HOLD_MS, CALIBRATION_JOINTS, CALIBRATION_VIS_THRESHOLD } from "../pose/types";

export interface GuideBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CalibFrame {
  ok: boolean;
  shoulderWidthPx: number;
  reasons: string[];
}

/** Cek satu frame (landmark 0..1, W/H piksel kanvas). Murni. */
export function checkFrame(
  lm: Array<{ x: number; y: number; visibility?: number }> | null,
  W: number,
  H: number,
  guide: GuideBox,
): CalibFrame {
  if (!lm || lm.length < 17) return { ok: false, shoulderWidthPx: 0, reasons: ["tubuh-keluar-frame"] };
  const missing: number[] = [];
  for (const j of CALIBRATION_JOINTS) {
    if ((lm[j]?.visibility ?? 0) < CALIBRATION_VIS_THRESHOLD) missing.push(j);
  }
  if (missing.length > 0) return { ok: false, shoulderWidthPx: 0, reasons: [`visibilitas-rendah:${missing.join(",")}`] };
  const pts = [11, 12, 13, 14, 15, 16].map((j) => ({ x: lm[j].x * W, y: lm[j].y * H }));
  const outside = pts.some((p) => p.x < guide.x || p.x > guide.x + guide.w || p.y < guide.y || p.y > guide.y + guide.h);
  if (outside) return { ok: false, shoulderWidthPx: 0, reasons: ["di-luar-panduan"] };
  const sw = Math.hypot(lm[11].x * W - lm[12].x * W, lm[11].y * H - lm[12].y * H);
  return { ok: true, shoulderWidthPx: sw, reasons: [] };
}

/** Akumulator tahan-1.5-detik. Gagal sekali → timer reset. */
export class CalibrationHold {
  private samples: number[] = [];
  private holdStart = 0;
  done = false;

  constructor(private holdMs = CALIBRATION_HOLD_MS) {}

  /** nowMs monotonik (performance.now). Kembalikan progres 0..1. */
  update(frame: CalibFrame, nowMs: number): number {
    if (this.done) return 1;
    if (!frame.ok) {
      this.samples = [];
      this.holdStart = 0;
      return 0;
    }
    if (this.holdStart === 0) this.holdStart = nowMs;
    this.samples.push(frame.shoulderWidthPx);
    const elapsed = nowMs - this.holdStart;
    if (elapsed >= this.holdMs) this.done = true;
    return Math.min(1, elapsed / this.holdMs);
  }

  /** Median lebar bahu — skala normalisasi user. */
  medianShoulder(): number {
    if (this.samples.length === 0) return 0;
    const s = [...this.samples].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }

  reset(): void {
    this.samples = [];
    this.holdStart = 0;
    this.done = false;
  }
}
