"""Raw landmark -> dokumen JSON tari-reference/0.1. Murni: tanpa video, tanpa ML."""
from __future__ import annotations

import dataclasses

import numpy as np

from .detect import Raw
from .filters import fill_gaps, one_euro_track, resample
from .geometry import angle_deg, bone_dict, bones_from_kp, normalize, pose_distance, shoulder_width
from .keypoints import BONE_NAMES, JOINTS, K, NAMES
from .segment import (Params, beat_candidate, burst_onsets, cluster_holds, find_holds, pose_id)

SCHEMA = "tari-reference/0.1"
MIN_POSE_COVERAGE = 0.25   # fraksi durasi minimal berupa pose stabil
MAX_SHOULDER_FRAC = 0.45   # lebar bahu maksimum (fraksi tinggi gambar); lebih = terlalu dekat

# Nilai penilaian = placeholder. Detektor TIDAK mengarang kalibrasi; semuanya
# calibrated:false sampai ada uji 3 kelompok (lihat catatan di tiap field).
SCORING = {
    "boneWeights": {"L_upper": 1.0, "L_fore": 0.6, "R_upper": 1.0, "R_fore": 0.6, "shoulders": 0.3},
    "boneWeightsNote": "lengan bawah dibobot lebih kecil karena wrist paling rawan tertukar saat tangan menumpuk. Bobot masih tebakan, belum dikalibrasi.",
    "sigmaDeg": {"default": 25, "calibrated": False,
                 "note": "PLACEHOLDER. Ganti dengan std sudut antar-penari per bone dari uji 3 kelompok."},
    "timing": {"toleranceMs": 300, "calibrated": False,
               "note": "PLACEHOLDER. Tanpa audio, tolerance diukur dari tStart/tOnset video."},
    "tiers": {"calibrated": False,
              "note": "Threshold KELAZ/KECE/HEBAT harus dari distribusi skor tiga kelompok. Belum ada."},
}


def r3(x) -> float:
    return round(float(x), 3)


def quality(raw: Raw) -> dict:
    """Gerbang kualitas video. Peringatan tidak menghentikan ekstraksi, tapi
    `usable:false` berarti video belum layak dijadikan referensi resmi."""
    n = len(raw.t)
    vis = raw.vis[:, JOINTS]
    px = raw.px[:, JOINTS]
    with np.errstate(invalid="ignore"):
        inframe = ((px[..., 0] > -0.02 * raw.width) & (px[..., 0] < 1.02 * raw.width) &
                   (px[..., 1] > -0.02 * raw.height) & (px[..., 1] < 1.02 * raw.height)).all(1) & raw.detected
        sw = shoulder_width(raw.px) / raw.height
    good = raw.detected & (vis.min(1) >= 0.5) & inframe & (np.nan_to_num(sw, nan=9) <= MAX_SHOULDER_FRAC)
    vm = {NAMES[j]: round(float(np.median(raw.vis[raw.detected, j])) if raw.detected.any() else 0.0, 2) for j in JOINTS}
    swv = sw[~np.isnan(sw)]
    q = {
        "detectRate": round(float(raw.detected.mean()), 3),
        "goodRate": round(float(good.mean()), 3),
        "inFrameRate": round(float(inframe.mean()), 3),
        "visMedian": vm,
        "shoulderWidthPctHeight_5_50_95": (np.percentile(swv, [5, 50, 95]).round(2).tolist() if len(swv) else []),
        "frames": n,
        "resolution": [raw.width, raw.height],
    }
    w = []
    if q["detectRate"] < 0.8:
        w.append(f"Deteksi hanya {q['detectRate']:.0%} frame")
    if vm and min(vm.values()) < 0.6:
        w.append("Ada sendi dengan visibilitas median < 0.6")
    if q["inFrameRate"] < 0.9:
        w.append(f"Sendi keluar frame di {1 - q['inFrameRate']:.0%} frame")
    if q["goodRate"] < 0.7:
        w.append(f"Hanya {q['goodRate']:.0%} frame lolos filter kualitas")
    if raw.height < 360:
        w.append(f"Resolusi rendah ({raw.width}x{raw.height}); landmark bisa kurang presisi")
    if raw.t[-1] - raw.t[0] < 2.0:
        w.append("Video kurang dari 2 detik")
    q["warnings"] = w
    q["usable"] = not w
    return q


def _round_kp(kp: np.ndarray) -> dict:
    return {NAMES[i]: [r3(kp[i, 0]), r3(kp[i, 1])] for i in range(len(NAMES))}


def _ffill(a: np.ndarray) -> tuple[np.ndarray, list]:
    """Isi NaN di track dengan nilai terdekat (maju lalu mundur); kembalikan rentang yang diisi."""
    out = a.copy()
    miss = np.isnan(out).any(axis=(1, 2))
    if not miss.any():
        return out, []
    idx = np.where(~miss)[0]
    for i in np.where(miss)[0]:
        out[i] = out[idx[np.argmin(np.abs(idx - i))]]
    return out, miss


def _spans(mask: np.ndarray, t: np.ndarray) -> list:
    out, s = [], None
    for i, v in enumerate(np.r_[mask, False]):
        if v and s is None:
            s = i
        elif not v and s is not None:
            out.append([round(float(t[s]), 2), round(float(t[i - 1]), 2)])
            s = None
    return out


def build(raw: Raw, ref_id: str, title: str, p: Params | None = None, note: str = "",
          clip: tuple[float, float | None] = (0.0, None)) -> tuple[dict, dict]:
    """Return (dokumen, debug). debug berisi larik untuk plot/contact sheet."""
    p = p or Params()
    q = quality(raw)
    # Semua waktu di dokumen relatif terhadap awal klip (0 = frame pertama yang dianalisis).
    off = float(raw.t[0])
    raw = dataclasses.replace(raw, t=raw.t - off)

    # 1) isi celah pendek, filter One Euro pada piksel dengan timestamp asli
    px, _filled, _unres = fill_gaps(raw.t, raw.px, 0.2)
    filt = one_euro_track(raw.t, px)

    # 2) skala = median lebar bahu pada frame tegak (lebar bahu membesar saat membungkuk)
    sw = shoulder_width(filt)
    ok = ~np.isnan(sw)
    if ok.sum() < 15:
        raise SystemExit("Terlalu sedikit frame dengan bahu terdeteksi; video tidak bisa dianalisis.")
    p25 = float(np.percentile(sw[ok], 25))
    upright = ok & (sw < 1.10 * p25)
    scale = float(np.median(sw[upright]))
    nrm = normalize(filt, scale)

    # 3) resample ke grid p.fps. Frame tanpa deteksi tetap NaN (tidak dikarang)
    t0 = float(raw.t[0])
    grid = t0 + np.arange(0, int(np.floor((raw.t[-1] - t0) * p.fps)) + 1) / p.fps
    kp = resample(raw.t, nrm, grid)
    vis_min = resample(raw.t, raw.vis[:, JOINTS].min(axis=1), grid)
    bad = np.isnan(kp).any(axis=(1, 2)) | (np.nan_to_num(vis_min, nan=0.0) < 0.5)
    k = int(0.1 * p.fps)
    bad = np.convolve(bad.astype(float), np.ones(2 * k + 1), "same") > 0

    # 4) hold -> cluster -> pose kunci
    holds, speed = find_holds(kp, grid, bad, p)
    sw_n = shoulder_width(kp)
    ratio = [float(np.nanmedian(sw_n[h.s:h.e + 1])) for h in holds]
    cent, members, assign = cluster_holds(holds, ratio, p)
    for h, a in zip(holds, assign):
        h.pose = pose_id(a)

    poses = []
    for j, ms in enumerate(members):
        frames = np.concatenate([kp[holds[m].s:holds[m].e + 1] for m in ms])
        med = np.nanmedian(frames, axis=0)
        wins = [(holds[m].t0, holds[m].t1) for m in ms]
        vmask = np.zeros(len(raw.t), bool)
        for a, b in wins:
            vmask |= (raw.t >= a) & (raw.t <= b)
        mv = float(np.median(raw.vis[vmask][:, JOINTS].min(axis=1))) if vmask.any() else 0.0
        poses.append({
            "id": pose_id(j),
            "keypoints": _round_kp(med),
            "bones": bone_dict(bones_from_kp(med)),
            "scaleRatio": round(float(np.nanmedian(shoulder_width(frames))), 2),
            "medianMinVisibility": round(mv, 2),
        })
    pose_by_id = {x["id"]: x for x in poses}

    # 5) segmen: pose / event / flow
    segs, nid = [], {"s": 0, "e": 0, "f": 0}

    def add(kind, **kw):
        nid[kind] += 1
        segs.append({"id": f"{kind}{nid[kind]}", **kw})

    def flow(a, b, why):
        onsets = burst_onsets(speed, grid, a, b, p)
        bc = beat_candidate(onsets, p)
        msg = why
        if bc:
            msg += (f" Letupan gerak periodik tiap ~{bc[0]:.2f} dtk (onset {', '.join(f'{o:.2f}' for o in onsets)}), "
                    f"kandidat beat ~{bc[1]:.0f} BPM, belum diverifikasi.")
        add("f", type="flow", tStart=round(a, 2), tEnd=round(b, 2), scored=False, note=msg)

    end_t = float(grid[-1])
    if not holds:
        flow(float(grid[0]), end_t, "tidak ada pose stabil di klip ini; tidak dinilai.")
    if holds and holds[0].t0 - grid[0] > p.flow_gap:
        flow(float(grid[0]), holds[0].t0, "gerak sebelum pose stabil pertama; tidak dinilai.")
    for i, h in enumerate(holds):
        add("s", type="pose", pose=h.pose, tStart=round(h.t0, 2), tEnd=round(h.t1, 2), scored=True)
        if i + 1 < len(holds):
            nx = holds[i + 1]
            gap = nx.t0 - h.t1
            if gap > p.flow_gap:
                flow(h.t1, nx.t0, "gerak cepat tanpa pose stabil; tidak dinilai.")
                continue
            A, Bn = pose_by_id[h.pose], pose_by_id[nx.pose]
            if pose_distance(h.bones, nx.bones) < p.min_swap_deg and A["id"] == Bn["id"]:
                continue
            bow = (max(A["scaleRatio"], Bn["scaleRatio"]) / min(A["scaleRatio"], Bn["scaleRatio"]) >= p.bow_scale
                   or Bn["keypoints"]["nose"][1] - A["keypoints"]["nose"][1] >= p.bow_nose_drop)
            add("e", type="bow" if bow else "swap", **{"from": h.pose, "to": nx.pose},
                tOnset=round(h.t1, 2), scored=True)
        elif end_t - h.t1 > p.flow_gap:
            flow(h.t1, end_t, "gerak cepat di akhir tanpa pose stabil; tidak dinilai.")

    # cakupan: berapa persen durasi berupa pose stabil. Video yang didominasi gerak cepat
    # tidak cocok jadi referensi latihan pose, jadi gerbang kualitas ikut menandainya.
    span = max(end_t - float(grid[0]), 1e-6)
    cover = sum(h.t1 - h.t0 for h in holds) / span
    q["poseCoverage"] = round(float(cover), 3)
    if not holds:
        q["warnings"].append("Tidak ada pose stabil terdeteksi (gerak terus-menerus atau klip terlalu pendek)")
    elif cover < MIN_POSE_COVERAGE:
        q["warnings"].append(f"Pose stabil hanya {cover:.0%} dari durasi; video didominasi gerak cepat dan kurang cocok sebagai referensi pose")
    q["usable"] = not q["warnings"]

    # 6) validasi
    validation = {
        "sampleSize": "1 video, 1 penari",
        "repeatConsistencyDeg": {},
    }
    for j, ms in enumerate(members):
        for a, b in zip(ms[:-1], ms[1:]):
            ha, hb = holds[a], holds[b]
            err = angle_deg(ha.bones, hb.bones)
            key = f"pose{pose_id(j)}_t{ha.t0:.1f}-{ha.t1:.1f}_vs_{hb.t0:.1f}-{hb.t1:.1f}"
            validation["repeatConsistencyDeg"][key] = {BONE_NAMES[i]: round(float(err[i]), 1) for i in range(len(BONE_NAMES))}
    if len(cent) >= 2:
        mat = {f"{pose_id(a)}-{pose_id(b)}": round(pose_distance(cent[a], cent[b]), 1)
               for a in range(len(cent)) for b in range(a + 1, len(cent))}
        validation["poseDistanceMatrixDeg"] = mat
        validation[f"pose{pose_id(0)}_vs_{pose_id(1)}_meanArmErrDeg"] = mat[f"{pose_id(0)}-{pose_id(1)}"]
    if holds:
        L = max(holds, key=lambda h: h.t1 - h.t0)
        m = (raw.t >= L.t0) & (raw.t <= L.t1)
        arm = [K["L_elbow"], K["R_elbow"], K["L_wrist"], K["R_wrist"]]

        def d2std(a):
            a = a[m][:, arm]
            d = a[2:] - 2 * a[1:-1] + a[:-2]
            return float(np.nanstd(d)) if len(d) > 3 else float("nan")
        validation["staticJitterPx"] = {
            "raw": round(d2std(px), 2), "filtered": round(d2std(filt), 2),
            "note": f"d2-std koordinat pergelangan/siku di jendela statis terpanjang ({L.t0:.1f}-{L.t1:.1f} dtk)"}
    validation["quality"] = q
    validation["params"] = {k_: v for k_, v in vars(p).items()}
    validation["caveat"] = ("Konsistensi diukur dari pengulangan pose dalam satu video satu penari. "
                            "Ini bukti awal, bukan kalibrasi toleransi.")

    # 7) track (grid p.fps). NaN diisi nilai terdekat; rentang yang diisi dicatat di gaps.
    tr, miss = _ffill(kp)
    track = {"fps": p.fps, "t": [round(float(x - t0), 3) for x in grid]}
    for name in NAMES:
        track[name] = [[r3(v[0]), r3(v[1])] for v in tr[:, K[name]]]
    if np.any(miss):
        track["gaps"] = _spans(miss, grid - t0)
        q["warnings"].append(f"{len(track['gaps'])} rentang track tanpa deteksi diisi nilai terdekat: {track['gaps']}")
        q["usable"] = False

    dur = round(float(raw.t[-1] - t0), 2)
    doc = {
        "schema": SCHEMA,
        "id": ref_id,
        "title": title,
        "source": {"file": raw.meta["file"], "durationSec": dur,
                   **({"clipStartSec": round(off, 2)} if off > 0.01 else {}),
                   "note": note or "Video untuk prototipe. Referensi final harus direkam bersama sanggar/penari dengan consent."},
        "clock": {"type": "video", "audio": None, "bpm": None,
                  "note": "Tanpa audio/beat grid, BPM tidak diturunkan. Semua waktu dalam detik video."},
        "extraction": {
            "model": raw.meta["model"],
            "filter": "One Euro (mincutoff=1.0, beta=0.05, dcutoff=1.0), dipasang pada piksel dengan timestamp frame asli (VFR)",
            "frameRate": f"variable ({np.diff(raw.t).min() * 1000:.1f} ms sampai {np.diff(raw.t).max() * 1000:.0f} ms antar frame); jangan pakai nomor frame; track di-resample {p.fps} fps",
            "normalization": {"origin": "titik tengah bahu", "scalePx": round(scale, 1),
                              "scaleDef": "median lebar bahu pada frame tegak (< 1,1x persentil-25 lebar bahu)",
                              "axes": "x ke kanan, y ke bawah, koordinat gambar",
                              "sides": "L/R anatomis (label MediaPipe), frame kamera tidak dimirror"},
            "excludedLandmarks": "pinggul, lutut, kaki, wajah detail: tidak andal (berlutut, pinggul tertutup saat membungkuk)",
        },
        "poses": poses,
        "segments": segs,
        "scoring": SCORING,
        "validation": validation,
        "track": track,
    }
    debug = {"offset": off, "grid": grid, "speed": speed, "bad": bad, "holds": holds, "kp": kp, "assign": assign,
             "centroids": cent, "scale": scale}
    return doc, debug
