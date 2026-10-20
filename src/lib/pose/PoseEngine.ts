// PoseEngine: landmarker + OneEuro. Satu-satunya tempat yang menyentuh ML.
// - WASM + model di-host sendiri (/wasm, /models) — jangan CDN saat demo.
// - Filter OneEuro di koordinat ternormalisasi, timestamp detik (VFR-safe).
// - Timestamp detectForVideo monotonik (performance.now).
// - close() WAJIB dipanggil saat unmount (bocor WASM kalau lupa).
// - Frame kamera TIDAK di-mirror untuk landmark; mirror hanya saat menggambar.

import { OneEuroBank } from "./oneEuro";
import type { Landmark } from "./types";

export interface EngineFrame {
  landmarks: Landmark[] | null;
  tSec: number;
}

type Landmarker = {
  detectForVideo: (video: HTMLVideoElement, ts: number) => { landmarks?: Array<Array<{ x?: number; y?: number; visibility?: number }>> };
  close: () => void;
};

export class PoseEngine {
  private landmarker: Landmarker | null = null;
  private bank = new OneEuroBank(1.0, 0.05, 1.0);
  private lastVideoTime = -1;
  ready = false;

  async init(): Promise<void> {
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks("/wasm");
    const base = { modelAssetPath: "/models/pose_landmarker_lite.task" };
    try {
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { ...base, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    } catch {
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { ...base, delegate: "CPU" },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    }
    this.ready = true;
  }

  /** null = frame belum baru / video belum siap. Panggil tiap rAF. */
  detect(video: HTMLVideoElement): EngineFrame | null {
    if (!this.landmarker || video.readyState < 2) return null;
    if (video.currentTime === this.lastVideoTime) return null;
    this.lastVideoTime = video.currentTime;
    const tSec = performance.now() / 1000;
    const res = this.landmarker.detectForVideo(video, performance.now());
    const raw = res.landmarks?.[0];
    if (!raw) return { landmarks: null, tSec };
    const landmarks: Landmark[] = raw.map((p, i) => ({
      x: this.bank.filter(`x${i}`, p.x ?? 0, tSec),
      y: this.bank.filter(`y${i}`, p.y ?? 0, tSec),
      visibility: p.visibility,
    }));
    return { landmarks, tSec };
  }

  close(): void {
    try {
      this.landmarker?.close();
    } catch {
      /* abaikan */
    }
    this.landmarker = null;
    this.bank.reset();
    this.ready = false;
    this.lastVideoTime = -1;
  }
}
