// Renderer siluet tubuh-atas (gaya mockup: putih, garis tebal berujung bulat).
// SATU fungsi gambar dipakai untuk user DAN pictogram referensi.
// Kaki tidak digambar: Saman berlutut, dan kontrak data mengecualikan pinggul/kaki.

export type Pt = { x: number; y: number };
export type UpperBodyPts = {
  nose: Pt;
  L_shoulder: Pt;
  R_shoulder: Pt;
  L_elbow: Pt;
  R_elbow: Pt;
  L_wrist: Pt;
  R_wrist: Pt;
};

/** Landmark user (0..1) → piksel kanvas. */
export function userToPx(lm: Array<{ x: number; y: number }>, W: number, H: number): UpperBodyPts | null {
  const g = (i: number): Pt => ({ x: lm[i].x * W, y: lm[i].y * H });
  if (lm.length < 17) return null;
  return { nose: g(0), L_shoulder: g(11), R_shoulder: g(12), L_elbow: g(13), R_elbow: g(14), L_wrist: g(15), R_wrist: g(16) };
}

/** Gambar siluet. mirror=true untuk display kamera depan (landmark tetap asli). */
export function drawUpperBody(
  ctx: CanvasRenderingContext2D,
  pts: UpperBodyPts,
  opts: { scalePx: number; color?: string; mirror?: boolean; W?: number; glow?: boolean },
): void {
  const color = opts.color ?? "#ffffff";
  const W = opts.W ?? 0;
  ctx.save();
  if (opts.mirror && W > 0) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = opts.glow ? Math.max(8, opts.scalePx * 0.5) : 0;
  const w = Math.max(6, opts.scalePx * 0.3);
  const seg = (a: Pt, b: Pt, lw = w) => {
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  seg(pts.L_shoulder, pts.R_shoulder, w * 1.15);
  seg(pts.L_shoulder, pts.L_elbow);
  seg(pts.L_elbow, pts.L_wrist, w * 0.85);
  seg(pts.R_shoulder, pts.R_elbow);
  seg(pts.R_elbow, pts.R_wrist, w * 0.85);
  // Kepala: lingkaran di hidung.
  ctx.beginPath();
  ctx.arc(pts.nose.x, pts.nose.y, Math.max(10, opts.scalePx * 0.34), 0, Math.PI * 2);
  ctx.fill();
  // Titik sendi: bahu/siku/pergelangan — penanda visual keypoint.
  for (const p of [pts.L_shoulder, pts.R_shoulder, pts.L_elbow, pts.R_elbow, pts.L_wrist, pts.R_wrist]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(3, w * 0.28), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
