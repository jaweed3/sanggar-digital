import importlib.util
import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[3]          # akar repo
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def load_scorer_mirror():
    """Mirror Python dari scorer.ts (src/scripts/scorer_mirror.py)."""
    p = ROOT / "src" / "scripts" / "scorer_mirror.py"
    if not p.exists():
        pytest.skip("scorer_mirror.py tidak ada")
    spec = importlib.util.spec_from_file_location("scorer_mirror", p)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


# Pose sintetis (koordinat ternormalisasi: x kanan, y bawah, lebar bahu = 1).
# L_* di sisi +x (penari menghadap kamera, frame tidak dimirror).
POSE_A = {"nose": (0.0, -0.7), "L_shoulder": (0.5, 0.0), "R_shoulder": (-0.5, 0.0),
          "L_elbow": (0.6, 0.8), "R_elbow": (-0.6, 0.8), "L_wrist": (0.6, 1.5), "R_wrist": (-0.6, 1.5)}
POSE_B = {"nose": (0.0, -0.7), "L_shoulder": (0.5, 0.0), "R_shoulder": (-0.5, 0.0),
          "L_elbow": (1.3, 0.1), "R_elbow": (-1.3, 0.1), "L_wrist": (1.9, -0.6), "R_wrist": (-1.9, -0.6)}


def kp_array(pose: dict) -> np.ndarray:
    from tari_extract.keypoints import NAMES
    return np.array([pose[n] for n in NAMES], dtype=float)


def synth_kp(schedule, fps=15, jitter=0.0, seed=0):
    """schedule: [(durasi_dtk, pose_dict)] -> (t, kp (n,7,2)). Transisi = interpolasi linear
    selama 0.4 dtk di awal tiap segmen (kecuali yang pertama)."""
    rng = np.random.default_rng(seed)
    t_all, kp_all, prev, t0 = [], [], None, 0.0
    for dur, pose in schedule:
        tgt = kp_array(pose)
        n = int(round(dur * fps))
        for i in range(n):
            if prev is not None and i / fps < 0.4:
                w = (i / fps) / 0.4
                kp = prev * (1 - w) + tgt * w
            else:
                kp = tgt
            t_all.append(t0 + i / fps)
            kp_all.append(kp + rng.normal(0, jitter, kp.shape))
        prev, t0 = tgt, t0 + n / fps
    return np.array(t_all), np.array(kp_all)
