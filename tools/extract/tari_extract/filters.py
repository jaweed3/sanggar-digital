"""One Euro (port dari src/lib/pose/oneEuro.ts) + isi celah + resample.

Parameter ekstraksi referensi: mincutoff=1.0, beta=0.05, dcutoff=1.0 (sama dengan
metadata contoh). Parameter runtime app memakai mincutoff=2.0 (lihat types.ts).
"""
from __future__ import annotations

import math

import numpy as np

MINCUTOFF, BETA, DCUTOFF = 1.0, 0.05, 1.0


def _alpha(cutoff: float, dt: float) -> float:
    tau = 1.0 / (2.0 * math.pi * cutoff)
    return 1.0 / (1.0 + tau / max(dt, 1e-6))


class OneEuro:
    def __init__(self, mincutoff=MINCUTOFF, beta=BETA, dcutoff=DCUTOFF):
        self.m, self.b, self.d = mincutoff, beta, dcutoff
        self.started = False
        self.last_x = self.x_hat = self.dx_hat = self.last_t = 0.0

    def __call__(self, x: float, t: float) -> float:
        if not self.started:
            self.started = True
            self.last_x = self.x_hat = x
            self.dx_hat = 0.0
            self.last_t = t
            return x
        dt = max(t - self.last_t, 1e-3)
        dx = (x - self.last_x) / dt
        ad = _alpha(self.d, dt)
        self.dx_hat = ad * dx + (1 - ad) * self.dx_hat
        a = _alpha(self.m + self.b * abs(self.dx_hat), dt)
        self.x_hat = a * x + (1 - a) * self.x_hat
        self.last_x, self.last_t = x, t
        return self.x_hat


def fill_gaps(t: np.ndarray, px: np.ndarray, max_gap: float = 0.2):
    """Interpolasi linear celah NaN yang lebih pendek dari max_gap detik.

    Return (px_terisi, filled_mask, unresolved_mask). Celah panjang tetap NaN
    dan ditandai unresolved supaya segmentasi tidak mengarang gerak.
    """
    out = px.copy()
    valid = ~np.isnan(px).any(axis=(1, 2))
    filled = np.zeros(len(t), bool)
    if valid.sum() < 2:
        return out, filled, ~valid
    idx = np.where(valid)[0]
    for a, b in zip(idx[:-1], idx[1:]):
        if b - a > 1 and t[b] - t[a] <= max_gap:
            w = ((t[a + 1:b] - t[a]) / (t[b] - t[a]))[:, None, None]
            out[a + 1:b] = px[a] * (1 - w) + px[b] * w
            filled[a + 1:b] = True
    unresolved = np.isnan(out).any(axis=(1, 2))
    return out, filled, unresolved


def one_euro_track(t: np.ndarray, px: np.ndarray, **kw) -> np.ndarray:
    """One Euro per keypoint per sumbu pada piksel, timestamp asli. NaN dilewati
    dan filter di-reset setelah celah (tidak menarik nilai lama lintas celah)."""
    out = np.full_like(px, np.nan)
    n, k, _ = px.shape
    for j in range(k):
        for c in range(2):
            f, prev_ok = OneEuro(**kw), True
            for i in range(n):
                v = px[i, j, c]
                if np.isnan(v):
                    f, prev_ok = OneEuro(**kw), False
                    continue
                out[i, j, c] = f(float(v), float(t[i]))
    return out


def resample(t: np.ndarray, arr: np.ndarray, grid: np.ndarray) -> np.ndarray:
    """Interpolasi linear arr (n, ...) ke grid; NaN dijaga (tidak diisi lintas celah)."""
    flat = arr.reshape(len(t), -1)
    out = np.full((len(grid), flat.shape[1]), np.nan)
    for c in range(flat.shape[1]):
        v = flat[:, c]
        ok = ~np.isnan(v)
        if ok.sum() < 2:
            continue
        out[:, c] = np.interp(grid, t[ok], v[ok])
        # mask grid yang jatuh di dalam celah NaN yang tidak terisi
        nxt = np.searchsorted(t[ok], grid)
        lo = t[ok][np.clip(nxt - 1, 0, ok.sum() - 1)]
        hi = t[ok][np.clip(nxt, 0, ok.sum() - 1)]
        out[(grid < t[ok][0]) | (grid > t[ok][-1]), c] = np.nan
        gap = (hi - lo) > 0.25
        out[gap & (grid > lo) & (grid < hi), c] = np.nan
    return out.reshape((len(grid),) + arr.shape[1:])
