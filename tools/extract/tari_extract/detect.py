"""Video -> landmark mentah per frame (satu-satunya modul yang menyentuh ML/video).

- Waktu memakai timestamp asli frame (POS_MSEC), bukan nomor frame: video
  referensi bersifat VFR.
- Satu orang, tanpa mirror. Koordinat disimpan dalam piksel.
- smooth_landmarks=False: penghalusan dilakukan sekali oleh One Euro di
  filters.py, bukan dobel dengan filter internal MediaPipe.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .keypoints import MP_IDX


@dataclass
class Raw:
    t: np.ndarray            # (n,) detik, monotonik naik
    px: np.ndarray           # (n,7,2) piksel; NaN bila tidak terdeteksi
    vis: np.ndarray          # (n,7) visibilitas MediaPipe; 0 bila tidak terdeteksi
    detected: np.ndarray     # (n,) bool
    width: int
    height: int
    meta: dict

    def save(self, path: str | Path) -> None:
        np.savez_compressed(
            path, t=self.t, px=self.px, vis=self.vis, detected=self.detected,
            width=self.width, height=self.height, meta=np.array([repr(self.meta)]),
        )

    @staticmethod
    def load(path: str | Path) -> "Raw":
        d = np.load(path, allow_pickle=False)
        import ast
        return Raw(d["t"], d["px"], d["vis"], d["detected"], int(d["width"]), int(d["height"]),
                   ast.literal_eval(str(d["meta"][0])))


def detect_video(video: str, start: float = 0.0, end: float | None = None,
                 complexity: int = 1, progress: bool = True) -> Raw:
    import cv2
    import mediapipe as mp

    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        raise SystemExit(f"Tidak bisa membuka video: {video}")
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    nominal_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0

    ts, pxs, viss, det = [], [], [], []
    nan_px = np.full((7, 2), np.nan)
    last_t = -1.0
    i = 0
    pose = mp.solutions.pose.Pose(
        static_image_mode=False, model_complexity=complexity, smooth_landmarks=False,
        enable_segmentation=False, min_detection_confidence=0.5, min_tracking_confidence=0.5,
    )
    try:
        while True:
            ok, bgr = cap.read()
            if not ok:
                break
            ms = cap.get(cv2.CAP_PROP_POS_MSEC)
            t = ms / 1000.0 if ms and ms > 0 else i / nominal_fps
            i += 1
            if t <= last_t:                      # jaga monotonik
                t = last_t + 1e-3
            last_t = t
            if t < start:
                continue
            if end is not None and t > end:
                break
            res = pose.process(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
            ts.append(t)
            if res.pose_landmarks:
                lm = res.pose_landmarks.landmark
                pxs.append(np.array([[lm[j].x * W, lm[j].y * H] for j in MP_IDX]))
                viss.append([lm[j].visibility for j in MP_IDX])
                det.append(True)
            else:
                pxs.append(nan_px)
                viss.append([0.0] * 7)
                det.append(False)
            if progress and total and len(ts) % 100 == 0:
                print(f"  deteksi {len(ts)}/{total} frame", flush=True)
    finally:
        pose.close()
        cap.release()

    if not ts:
        raise SystemExit("Tidak ada frame yang terbaca.")
    meta = {
        "file": Path(video).name,
        "nominalFps": round(float(nominal_fps), 3),
        "model": f"MediaPipe Pose, model_complexity={complexity}, mediapipe {mp.__version__}",
        "frames": len(ts),
        "durationSec": round(float(ts[-1]), 3),
    }
    return Raw(np.array(ts), np.array(pxs), np.array(viss), np.array(det), W, H, meta)
