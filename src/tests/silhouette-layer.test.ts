// Test anti-flicker: layer siluet harus PERSISTEN antar tick.
//
// Ini test yang menjaga fix kedipan siluet. Bugs ini nyata: kamera web
// 30 fps vs rAF 60 Hz berarti ~50% tick tanpa frame kamera baru. Kalau
// kanvas dikosongkan tiap tick, siluet hilang sesaat pada separuh tick
// (terukur 51,7% tick kosong sebelum fix, 3,3% sesudahnya).
//
// Lihat docs/LATENCY.md bagian 2.
import { describe, expect, test } from "bun:test";
import { createSilhouetteLayer } from "../lib/game/silhouette-layer";
import { IDX, upperKpFromLandmarks, upperKpToPx, shoulderWidthPx } from "../lib/pose/keypoints";

function fakeLandmarks(): Array<{ x: number; y: number; visibility: number }> {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  lm[IDX.nose] = { x: 0.5, y: 0.2, visibility: 0.9 };
  lm[IDX.L_shoulder] = { x: 0.4, y: 0.3, visibility: 0.9 };
  lm[IDX.R_shoulder] = { x: 0.6, y: 0.3, visibility: 0.9 };
  lm[IDX.L_elbow] = { x: 0.4, y: 0.45, visibility: 0.9 };
  lm[IDX.R_elbow] = { x: 0.6, y: 0.45, visibility: 0.9 };
  lm[IDX.L_wrist] = { x: 0.4, y: 0.6, visibility: 0.9 };
  lm[IDX.R_wrist] = { x: 0.6, y: 0.6, visibility: 0.9 };
  return lm;
}

/**
 * Kanvas minimal untuk test: hanya butuh context 2d dengan clearRect,
 * drawImage, dan ability dibaca pikselnya. Pakai canvas sungguhan —
 * bun tidak punya DOM, jadi kita pakai stub yang mencatat operasi.
 */
function stubCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; ink: number } {
  const state = { ink: 0 };
  const ctx = {
    clearRect: () => { state.ink = 0; },
    drawImage: () => { state.ink = 1; },
    strokeRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    setLineDash: () => {},
    fillRect: () => {},
    roundRect: () => {},
    fillStyle: "", strokeStyle: "", lineWidth: 0, lineCap: "", lineJoin: "",
    shadowColor: "", shadowBlur: 0, globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
  const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
  return { canvas, ctx, get ink() { return state.ink; } };
}

/** Stub document.createElement("canvas") untuk createSilhouetteLayer. */
function withStubCanvas<T>(fn: () => T): T {
  const original = globalThis.document;
  (globalThis as { document?: unknown }).document = {
    createElement: (tag: string) => (tag === "canvas" ? stubCanvas().canvas : ({} as HTMLElement)),
  };
  try {
    return fn();
  } finally {
    if (original) (globalThis as { document?: unknown }).document = original;
    else delete (globalThis as { document?: unknown }).document;
  }
}

describe("layer siluet persisten", () => {
  test("frame null (tak ada frame kamera baru) → siluet TIDAK dihapus", () => {
    withStubCanvas(() => {
      const layer = createSilhouetteLayer();
      const lm = fakeLandmarks();
      const ukp = upperKpFromLandmarks(lm)!;
      // Frame pertama: ada orang → layer digambar.
      layer.update({ landmarks: lm }, 640, 480, (ctx: CanvasRenderingContext2D) => {
        ctx.strokeStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(1, 1);
        ctx.stroke();
      });
      const drew = layer.canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      expect(drew).toBeDefined();

      // Tik tanpa frame baru → layer harus TIDAK di-clear.
      let cleared = false;
      const origClear = (layer.canvas.getContext("2d") as unknown as { clearRect: () => void }).clearRect;
      (layer.canvas.getContext("2d") as unknown as { clearRect: () => void }).clearRect = () => { cleared = true; };
      layer.update(null, 640, 480, () => { throw new Error("tidak boleh digambar tanpa frame baru"); });
      expect(cleared).toBe(false);
      (layer.canvas.getContext("2d") as unknown as { clearRect: () => void }).clearRect = origClear;
      expect(ukp).toBeDefined();
    });
  });

  test("landmarks null (user keluar frame) → siluet DIKOSONGKAN", () => {
    withStubCanvas(() => {
      const layer = createSilhouetteLayer();
      let cleared = false;
      const ctx = layer.canvas.getContext("2d") as unknown as { clearRect: () => void };
      const orig = ctx.clearRect;
      ctx.clearRect = () => { cleared = true; };
      layer.update({ landmarks: null }, 640, 480, () => {});
      expect(cleared).toBe(true);
      ctx.clearRect = orig;
    });
  });

  test("blitTo menyalin layer ke kanvas utama", () => {
    withStubCanvas(() => {
      const layer = createSilhouetteLayer();
      let blitted = false;
      const main = {
        drawImage: () => { blitted = true; },
        clearRect: () => {},
      } as unknown as CanvasRenderingContext2D;
      layer.blitTo(main);
      expect(blitted).toBe(true);
    });
  });

  test("resolusi berubah → layer ikut di-resize", () => {
    withStubCanvas(() => {
      const layer = createSilhouetteLayer();
      layer.update({ landmarks: fakeLandmarks() }, 640, 480, () => {});
      expect(layer.canvas.width).toBe(640);
      expect(layer.canvas.height).toBe(480);
      layer.update({ landmarks: fakeLandmarks() }, 1280, 720, () => {});
      expect(layer.canvas.width).toBe(1280);
      expect(layer.canvas.height).toBe(720);
    });
  });
});

describe("hitungan siluet", () => {
  test("skala gambar mengikuti lebar bahu user", () => {
    const lm = fakeLandmarks();
    const ukp = upperKpFromLandmarks(lm)!;
    // Bahu x=0.4..0.6 pada W=1000 → lebar 200 px.
    expect(shoulderWidthPx(ukp, 1000, 800)).toBeCloseTo(200, 6);
    // Konversi ke piksel memakai W/H yang sama.
    const px = upperKpToPx(ukp, 1000, 800);
    expect(px.L_shoulder.x).toBeCloseTo(400, 6);
    expect(px.R_shoulder.x).toBeCloseTo(600, 6);
  });
});
