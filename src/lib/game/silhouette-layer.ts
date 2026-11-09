// Lapisan siluet persisten.
//
// TUJUAN: siluet user tidak boleh berkedip antar frame. Kamera web 30 fps
// sedangkan loop aplikasi 60 Hz (rAF), jadi ~50% tick tidak punya frame
// kamera baru. Kalau kanvas utama dikosongkan tiap tick dan digambar hanya
// saat frame baru tersedia, siluet hilang sesaat pada separuh tick.
//
// Solusi: siluet digambar ke canvas offscreen yang HANYA digambar ulang saat
// ada frame kamera baru; kanvas utama setiap tick menyalin layer itu.

/**
 * Layer siluet: satu canvas offscreen per runner.
 *
 * Perbedaan penting antara dua kondisi "tidak ada landmark":
 *   - `frame === null`          → tak ada frame kamera BARU → PERTAHANKAN
 *                                  siluet terakhir (jangan kedip)
 *   - `frame.landmarks === null` → kamera terisi tapi tak ada orang → KOSONGKAN
 *                                  siluet (user keluar frame, jangan tampil bayangan)
 */
export interface SilhouetteLayer {
  canvas: HTMLCanvasElement;
  /** Gambar ulang hanya bila ada frame kamera baru. */
  update(frame: { landmarks: Array<{ x: number; y: number }> | null } | null, W: number, H: number, draw: (ctx: CanvasRenderingContext2D) => void): void;
  /** Salin isi layer ke kanvas utama. */
  blitTo(ctx: CanvasRenderingContext2D): void;
}

export function createSilhouetteLayer(): SilhouetteLayer {
  const canvas = document.createElement("canvas");
  return {
    canvas,
    update(frame, W, H, draw) {
      if (frame === null) return; // tak ada frame baru → biarkan layer apa adanya
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      if (frame.landmarks) draw(ctx);
    },
    blitTo(ctx) {
      ctx.drawImage(canvas, 0, 0);
    },
  };
}
