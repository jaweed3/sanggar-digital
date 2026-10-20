// TimelineRenderer: pre-render tiap pose jadi sprite, lalu gambar lane.
// x_i = x_target + (t_i - now) * v. Canvas 2D saja, tanpa lib game.

import { drawUpperBody, type UpperBodyPts } from "../pose/silhouette";
import { TIER_COLORS, GAME_COLORS } from "./theme";
import type { LaneMark } from "./lane";
import { laneX } from "./lane";

export interface Sprite {
  poseId: string;
  canvas: HTMLCanvasElement;
}

function ptsFromKp(kp: Record<string, [number, number]>, scalePx: number): UpperBodyPts {
  const c = 48;
  const cy = 62;
  const g = (k: string): { x: number; y: number } => ({ x: c + kp[k][0] * scalePx, y: cy + kp[k][1] * scalePx });
  return { nose: g("nose"), L_shoulder: g("L_shoulder"), R_shoulder: g("R_shoulder"), L_elbow: g("L_elbow"), R_elbow: g("R_elbow"), L_wrist: g("L_wrist"), R_wrist: g("R_wrist") };
}

/** Pre-render sprite 96x120 per pose. Dipanggil sekali setelah referensi dimuat. */
export function prerenderSprites(poses: Array<{ id: string; keypoints: Record<string, [number, number]> }>): Sprite[] {
  return poses.map((p) => {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, 96, 120);
      drawUpperBody(ctx, ptsFromKp(p.keypoints, 26), { scalePx: 26, color: "#ffffff" });
    }
    return { poseId: p.id, canvas };
  });
}

export function drawLane(
  ctx: CanvasRenderingContext2D,
  marks: LaneMark[],
  sprites: Sprite[],
  now: number,
  opts: { W: number; H: number; xTarget: number; v: number; judgedIds: Set<string> },
): void {
  const { W, H, xTarget, v } = opts;
  ctx.clearRect(0, 0, W, H);
  const baseY = H - 14;
  // Garis dasar.
  ctx.strokeStyle = "rgba(255,255,255,.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  ctx.lineTo(W, baseY);
  ctx.stroke();
  // Garis target berdenyut: memudar saat beat jauh, terang saat beat dekat.
  const nearest = marks.reduce((best, m) => Math.min(best, Math.abs(m.t - now)), Infinity);
  const pulse = nearest < 0.6 ? 1 - nearest / 0.6 : 0;
  ctx.save();
  ctx.strokeStyle = GAME_COLORS.gold;
  ctx.globalAlpha = 0.45 + 0.55 * pulse;
  ctx.lineWidth = 3 + 2 * pulse;
  ctx.shadowColor = GAME_COLORS.gold;
  ctx.shadowBlur = 6 + 14 * pulse;
  ctx.beginPath();
  ctx.moveTo(xTarget, 8);
  ctx.lineTo(xTarget, H - 8);
  ctx.stroke();
  ctx.restore();
  for (const m of marks) {
    const x = laneX(m.t, now, xTarget, v);
    if (x < -60 || x > W + 60) continue;
    const sp = sprites.find((s) => s.poseId === m.poseId);
    if (!sp) continue;
    const judged = opts.judgedIds.has(m.id);
    const dt = m.t - now;
    // Cincin hit: menyusut ke target saat beat tiba (2 dtk → 0).
    if (!judged && dt > 0 && dt < 2) {
      const k = 1 - dt / 2;
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(xTarget, baseY - 70, 34 - 22 * k, 0, Math.PI * 2);
      ctx.globalAlpha = 0.25 + 0.55 * k;
      ctx.stroke();
      ctx.restore();
    }
    // Chip latar pictogram.
    ctx.save();
    ctx.globalAlpha = judged ? 0.35 : 1;
    ctx.fillStyle = m.kind === "event" ? "rgba(246,197,67,.18)" : "rgba(255,255,255,.08)";
    ctx.beginPath();
    ctx.roundRect(x - 28, baseY - 104, 56, 68, 12);
    ctx.fill();
    ctx.drawImage(sp.canvas, x - 24, baseY - 100, 48, 60);
    ctx.restore();
    if (m.kind === "event") {
      // Ketupat emas untuk swap/bow.
      ctx.fillStyle = GAME_COLORS.gold;
      ctx.save();
      ctx.translate(x, baseY - 104 - 8);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    if (judged) {
      // Titik warna tier — diisi dari verdict terbaru oleh updateJudgedColors.
      const c = judgedTierColor(m.id);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, baseY - 104, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Cache warna tier per mark — diisi runner setelah vonis, dibaca saat gambar.
const tierCache = new Map<string, string>();

export function noteJudgedColor(markId: string, tier: "KELAZ" | "KECE" | "HEBAT"): void {
  tierCache.set(markId, TIER_COLORS[tier]);
}

export function judgedTierColor(markId: string): string {
  return tierCache.get(markId) ?? "rgba(255,255,255,.5)";
}
