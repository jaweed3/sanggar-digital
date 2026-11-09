"""Segmentasi gerak + pose kunci. Semua fungsi murni (numpy), bisa diuji tanpa video.

Logika:
  1. kecepatan = jumlah laju perubahan sudut 4 bone lengan (derajat/detik).
     Tidak bergantung ukuran badan atau jarak kamera.
  2. 'diam' = kecepatan < thresh selama >= min_hold  -> segmen pose (hold).
  3. hold bertetangga yang berjarak <= merge_gap dan pose-nya mirip digabung.
  4. celah antar hold: pendek -> event (swap/bow), panjang -> flow (tak dinilai).
  5. hold di-cluster jadi pose kunci A, B, C ... (centroid berjalan).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy.ndimage import uniform_filter1d
from scipy.signal import find_peaks

from .geometry import angle_deg, bones_from_kp, pose_distance, unit
from .keypoints import ARM_BONES, BONE_NAMES, K


@dataclass
class Params:
    fps: int = 15                 # grid track (sama dengan contoh)
    thresh: float = 120.0         # deg/s di bawah ini = diam
    smooth_sec: float = 0.2       # jendela penghalus kecepatan
    min_hold: float = 0.4         # detik minimal untuk satu pose
    merge_gap: float = 0.5        # detik; hold dekat + mirip digabung
    merge_deg: float = 20.0
    cluster_deg: float = 18.0     # pose dianggap sama bila rata-rata galat <= ini
    flow_gap: float = 1.5         # celah > ini (detik) = flow, bukan event
    bow_scale: float = 1.10       # rasio lebar bahu lokal/global yang dianggap membungkuk
    bow_nose_drop: float = 0.35   # penurunan hidung (lebar bahu) yang dianggap membungkuk
    min_swap_deg: float = 30.0    # perubahan pose minimal agar celah dihitung event
    burst_min: int = 4            # jumlah letupan minimal untuk menaksir beat


def arm_speed(B: np.ndarray, fps: int, smooth_sec: float) -> np.ndarray:
    """B (n,5,2) bone satuan -> kecepatan (n,) deg/s; NaN bila ada bone NaN."""
    idx = [BONE_NAMES.index(n) for n in ARM_BONES]
    d = angle_deg(B[:-1][:, idx], B[1:][:, idx]).sum(axis=1) * fps
    sp = np.r_[d[0] if len(d) else 0.0, d]
    nan = np.isnan(sp)
    if nan.any():
        sp = np.where(nan, 0.0, sp)
    w = max(1, int(round(smooth_sec * fps)))
    sp = uniform_filter1d(sp, size=w, mode="nearest")
    sp[nan] = np.nan
    return sp


def runs(mask: np.ndarray, t: np.ndarray, min_len: float):
    """Indeks (s, e) inklusif untuk deretan True yang durasinya >= min_len."""
    out, s = [], None
    for i, v in enumerate(np.r_[mask, False]):
        if v and s is None:
            s = i
        elif not v and s is not None:
            if t[i - 1] - t[s] >= min_len:
                out.append((s, i - 1))
            s = None
    return out


def seg_bones(kp: np.ndarray, s: int, e: int) -> np.ndarray:
    """Bone dari keypoint median segmen (sama dengan cara poses[] disusun)."""
    return bones_from_kp(np.nanmedian(kp[s:e + 1], axis=0))


@dataclass
class Hold:
    s: int
    e: int
    t0: float
    t1: float
    bones: np.ndarray
    pose: str = ""


@dataclass
class Result:
    holds: list[Hold]
    speed: np.ndarray
    gaps: list[tuple[int, int]]            # indeks celah antar hold (i, i+1) atau tepi
    cluster_of: list[int]
    centroids: list[np.ndarray]
    members: list[list[int]]


def find_holds(kp: np.ndarray, t: np.ndarray, bad: np.ndarray, p: Params):
    B = bones_from_kp(kp)
    sp = arm_speed(B, p.fps, p.smooth_sec)
    still = (sp < p.thresh) & ~bad & ~np.isnan(sp)
    segs = runs(still, t, p.min_hold)
    merged: list[tuple[int, int]] = []
    for s, e in segs:
        if merged:
            ps, pe = merged[-1]
            if t[s] - t[pe] <= p.merge_gap and pose_distance(seg_bones(kp, s, e), seg_bones(kp, ps, pe)) <= p.merge_deg:
                merged[-1] = (ps, e)
                continue
        merged.append((s, e))
    holds = [Hold(s, e, float(t[s]), float(t[e]), seg_bones(kp, s, e)) for s, e in merged]
    return holds, sp


def cluster_holds(holds: list[Hold], scale_ratio: list[float], p: Params):
    """Centroid berjalan. Hold dengan lebar bahu jauh beda (membungkuk) tidak digabung."""
    cent: list[np.ndarray] = []
    sr: list[float] = []
    members: list[list[int]] = []
    assign: list[int] = []
    for i, h in enumerate(holds):
        best, bd = None, p.cluster_deg
        for j, c in enumerate(cent):
            if max(scale_ratio[i], sr[j]) / min(scale_ratio[i], sr[j]) > p.bow_scale:
                continue
            d = pose_distance(h.bones, c)
            if d <= bd:
                best, bd = j, d
        if best is None:
            cent.append(h.bones.copy())
            sr.append(scale_ratio[i])
            members.append([i])
            assign.append(len(cent) - 1)
        else:
            members[best].append(i)
            cent[best] = unit(np.mean([holds[m].bones for m in members[best]], axis=0))
            assign.append(best)
    return cent, members, assign


def pose_id(j: int) -> str:
    """A..Z, lalu P27, P28 ... (jarang terjadi)."""
    return chr(ord("A") + j) if j < 26 else f"P{j + 1}"


def burst_onsets(sp: np.ndarray, t: np.ndarray, t0: float, t1: float, p: Params) -> list[float]:
    """Puncak kecepatan di jendela [t0,t1]; dipakai menaksir kandidat beat."""
    m = (t >= t0) & (t <= t1)
    if m.sum() < 5:
        return []
    seg = np.nan_to_num(sp[m])
    pk, _ = find_peaks(seg, distance=max(1, int(0.5 * p.fps)), prominence=max(60.0, 0.25 * np.nanmax(seg)))
    return [float(t[m][i]) for i in pk]


def beat_candidate(onsets: list[float], p: Params):
    """(interval_dtk, bpm) bila letupan cukup periodik (CV < 0.15), selain itu None."""
    if len(onsets) < p.burst_min:
        return None
    iv = np.diff(onsets)
    if iv.mean() <= 0 or iv.std() / iv.mean() > 0.15:
        return None
    m = float(np.median(iv))
    return m, 60.0 / m
