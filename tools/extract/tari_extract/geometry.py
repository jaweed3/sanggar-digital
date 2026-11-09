"""Bone, jarak sudut, dan normalisasi. Rumus bone identik dengan scorer.ts."""
from __future__ import annotations

import numpy as np

from .keypoints import ARM_BONES, BONE_NAMES, BONE_PAIRS, K, NAMES


def unit(v: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / np.where(n == 0, 1.0, n)


def bones_from_kp(kp: np.ndarray) -> np.ndarray:
    """kp (...,7,2) -> bone (...,5,2) satuan, urutan BONE_NAMES.
    Sama dengan bonesFromKeypoints (scorer.ts): hitung vektor, normalisasi."""
    out = []
    for b in BONE_NAMES:
        a, c = BONE_PAIRS[b]
        out.append(unit(kp[..., K[c], :] - kp[..., K[a], :]))
    return np.stack(out, axis=-2)


def bone_dict(bones: np.ndarray) -> dict:
    return {n: [round(float(bones[i, 0]), 3), round(float(bones[i, 1]), 3)] for i, n in enumerate(BONE_NAMES)}


def angle_deg(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Sudut |atan2(cross, dot)| (derajat), sama dengan angleErrDeg di scorer.ts."""
    dot = (a * b).sum(-1)
    cross = a[..., 0] * b[..., 1] - a[..., 1] * b[..., 0]
    return np.degrees(np.abs(np.arctan2(cross, dot)))


def pose_distance(A: np.ndarray, B: np.ndarray) -> float:
    """Rata-rata galat sudut 4 bone lengan (derajat); bahu tidak ikut."""
    idx = [BONE_NAMES.index(n) for n in ARM_BONES]
    return float(np.mean(angle_deg(A[idx], B[idx])))


def shoulder_width(px: np.ndarray) -> np.ndarray:
    return np.linalg.norm(px[..., K["L_shoulder"], :] - px[..., K["R_shoulder"], :], axis=-1)


def normalize(px: np.ndarray, scale: float) -> np.ndarray:
    """Origin = titik tengah bahu, dibagi scale. x kanan, y bawah (koordinat gambar)."""
    mid = (px[..., K["L_shoulder"], :] + px[..., K["R_shoulder"], :]) / 2
    return (px - mid[..., None, :]) / scale
