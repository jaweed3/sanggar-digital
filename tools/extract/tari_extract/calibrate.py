"""Kalibrasi scoring dari rekaman penari NYATA (tiga kelompok: penari / terlatih / awam).

Alur kerja:
  1. Tiap orang menirukan video referensi; rekaman diekstrak dengan detektor ini
     (`python -m tari_extract rekaman.mp4 -o attempts/penari1.json`).
  2. `python -m tari_extract.calibrate --ref ref.json --group penari=a.json,b.json ... -o hasil.json`
  3. Hasil: sigmaDeg per bone, bobot bone, toleransi waktu, ambang tier, plus ukuran
     keterpisahan antar kelompok. `--apply` menulis salinan referensi dengan scoring baru.

Aturan kejujuran: `calibrated:true` HANYA bila tiap kelompok punya >= --min-n rekaman.
Di bawah itu angka tetap dihitung (untuk dilihat) tapi referensi tidak ditandai terkalibrasi.
Skor memakai rumus yang sama dengan app (gaussian per bone, rata-rata berbobot; scorer.ts).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

from .geometry import angle_deg, bones_from_kp
from .keypoints import ARM_BONES, BONE_NAMES, NAMES

GROUPS = ("penari", "terlatih", "awam")
SIGMA_RANGE = (10.0, 45.0)
OFFSET_MAX = 1.0           # detik, pencarian geser waktu rekaman terhadap referensi


def load_track(doc: dict):
    tr = doc["track"]
    t = np.array(tr["t"], float)
    kp = np.stack([np.array(tr[n], float) for n in NAMES], axis=1)      # (n,7,2)
    return t, bones_from_kp(kp)                                         # (n,5,2)


def score_frames(err: np.ndarray, w: np.ndarray, sigma) -> np.ndarray:
    """err (n,5) derajat -> skor (n,) 0..100, rumus scorer.ts."""
    s = np.exp(-0.5 * (err / np.asarray(sigma)) ** 2)
    return 100.0 * (s * w).sum(1) / w.sum()


def _segments(ref: dict):
    bones = {p["id"]: np.array([p["bones"][b] for b in BONE_NAMES], float) for p in ref["poses"]}
    return [(s["tStart"], s["tEnd"], bones[s["pose"]]) for s in ref["segments"]
            if s["type"] == "pose" and s.get("scored")]


def window_errors(ref: dict, att: dict, offset: float, trim: float = 0.2):
    """Galat sudut per frame (n,5) dari semua segmen pose pada geseran waktu `offset`,
    dan indeks segmen tiap frame. offset>0: rekaman tertinggal dari referensi."""
    t, B = load_track(att)
    errs, seg_id = [], []
    for k, (a, b, rb) in enumerate(_segments(ref)):
        m = (t - offset >= a + trim) & (t - offset <= b - trim)
        if m.any():
            errs.append(angle_deg(B[m], rb[None]))
            seg_id += [k] * int(m.sum())
    if not errs:
        return np.zeros((0, len(BONE_NAMES))), np.zeros(0, int)
    return np.concatenate(errs), np.array(seg_id)


def best_offset(ref: dict, att: dict, w: np.ndarray, sigma0: float = 25.0) -> float:
    fps = ref["track"]["fps"]
    cands = np.arange(-OFFSET_MAX, OFFSET_MAX + 1e-9, 1 / fps)
    best, bo = -1.0, 0.0
    for o in cands:
        e, _ = window_errors(ref, att, float(o))
        if len(e) < 5:
            continue
        s = score_frames(e, w, sigma0).mean()
        if s > best:
            best, bo = s, float(o)
    return bo


def attempt_score(ref: dict, att: dict, offset: float, w: np.ndarray, sigma) -> float:
    """Skor akhir rekaman: rata-rata skor tiap segmen pose (seperti finalFromVerdicts)."""
    e, sid = window_errors(ref, att, offset)
    if not len(e):
        return 0.0
    sc = score_frames(e, w, sigma)
    return float(np.mean([sc[sid == k].mean() for k in np.unique(sid)]))


def calibrate(ref: dict, groups: dict[str, list[dict]], min_n: int = 5) -> dict:
    w = np.array([ref["scoring"]["boneWeights"].get(b, 1.0) for b in BONE_NAMES], float)
    arm = [BONE_NAMES.index(b) for b in ARM_BONES]
    sh = BONE_NAMES.index("shoulders")
    n = {g: len(v) for g, v in groups.items()}
    out: dict = {"n": n, "minNPerGroup": min_n}
    if not groups.get("penari"):
        raise SystemExit("Kelompok 'penari' wajib ada: sigma dihitung dari sebaran penari.")

    # geseran waktu per rekaman
    offs = {g: [best_offset(ref, a, w) for a in v] for g, v in groups.items()}
    allabs = np.abs(np.concatenate([o for o in offs.values()])) if offs else np.zeros(1)
    # sigma: RMS galat sudut per bone pada kelompok penari (setelah penyelarasan waktu)
    errs = np.concatenate([window_errors(ref, a, o)[0] for a, o in zip(groups["penari"], offs["penari"])])
    if not len(errs):
        raise SystemExit("Rekaman penari tidak punya frame di dalam segmen pose referensi.")
    rms = np.sqrt((errs ** 2).mean(0))
    sigma_bone = np.clip(rms, *SIGMA_RANGE)
    sigma_default = float(np.clip(np.sqrt((errs[:, arm] ** 2).mean()), *SIGMA_RANGE))
    # bobot: bone yang sebarannya kecil lebih informatif; dinormalkan ke maks 1, lantai 0.3
    inv = 1.0 / np.maximum(rms, 1.0)
    bw = np.clip(inv / inv[arm].max(), 0.3, 1.0)
    bw[sh] = min(bw[sh], 0.3)
    weights = {b: round(float(bw[i]), 2) for i, b in enumerate(BONE_NAMES)}
    wv = np.array([weights[b] for b in BONE_NAMES])

    scores = {g: [attempt_score(ref, a, o, wv, sigma_default) for a, o in zip(v, offs[g])] for g, v in groups.items()}
    pct = lambda x, q: float(np.percentile(x, q)) if len(x) else float("nan")
    hebat = pct(scores["penari"], 25)
    kece = pct(scores.get("awam", []), 75) if scores.get("awam") else float("nan")
    if np.isnan(kece) or kece >= hebat:
        kece = hebat * 0.75 if not np.isnan(hebat) else float("nan")
    sep = {}
    if scores.get("awam"):
        sep["penari_vs_awam"] = _auc(scores["penari"], scores["awam"])
    if scores.get("terlatih"):
        sep["penari_vs_terlatih"] = _auc(scores["penari"], scores["terlatih"])
        if scores.get("awam"):
            sep["terlatih_vs_awam"] = _auc(scores["terlatih"], scores["awam"])

    tol = max(150, int(np.ceil(np.percentile(allabs, 90) * 1000 / 50.0) * 50))
    ok_n = all(n.get(g, 0) >= min_n for g in GROUPS)
    warnings = [f"Kelompok '{g}' hanya {n.get(g, 0)} rekaman (< {min_n}); angka belum layak dipakai"
                for g in GROUPS if n.get(g, 0) < min_n]
    if sep and min(sep.values()) < 0.7:
        warnings.append(f"Kelompok kurang terpisah (AUC {min(sep.values()):.2f} < 0.70); ambang tier kurang bermakna")
    out.update({
        "sigmaDeg": {"default": round(sigma_default, 1), "perBone": {b: round(float(sigma_bone[i]), 1) for i, b in enumerate(BONE_NAMES)}},
        "boneWeights": weights,
        "timing": {"toleranceMs": tol, "offsetSecP90": round(float(np.percentile(allabs, 90)), 3)},
        "tiers": {"HEBAT": round(hebat, 1), "KECE": round(float(kece), 1)},
        "groupScores": {g: {"n": len(s), "median": round(float(np.median(s)), 1) if s else None,
                            "p25": round(pct(s, 25), 1) if s else None, "p75": round(pct(s, 75), 1) if s else None}
                        for g, s in scores.items()},
        "separationAUC": {k: round(v, 3) for k, v in sep.items()},
        "calibrated": bool(ok_n and not (sep and min(sep.values()) < 0.7)),
        "warnings": warnings,
    })
    return out


def _auc(hi, lo) -> float:
    """P(skor hi > skor lo): 0.5 = tak terpisah, 1.0 = terpisah sempurna."""
    hi, lo = np.asarray(hi), np.asarray(lo)
    return float(((hi[:, None] > lo[None]).sum() + 0.5 * (hi[:, None] == lo[None]).sum()) / (len(hi) * len(lo)))


def apply_to_reference(ref: dict, res: dict) -> dict:
    """Salinan referensi dengan scoring dari hasil kalibrasi. `calibrated` mengikuti res."""
    out = json.loads(json.dumps(ref))
    cal = res["calibrated"]
    n = res["n"]
    note = f"Dikalibrasi dari {n} rekaman (kelompok)." if cal else \
        f"SEMENTARA, belum layak ({n}): " + "; ".join(res["warnings"])
    out["scoring"]["boneWeights"] = res["boneWeights"]
    out["scoring"]["boneWeightsNote"] = "Dari kebalikan sebaran sudut penari per bone." if cal else out["scoring"]["boneWeightsNote"]
    out["scoring"]["sigmaDeg"] = {"default": res["sigmaDeg"]["default"], "calibrated": cal, "note": note}
    out["scoring"]["timing"] = {"toleranceMs": res["timing"]["toleranceMs"], "calibrated": cal, "note": note}
    out["scoring"]["tiers"] = {"calibrated": cal, "HEBAT": res["tiers"]["HEBAT"], "KECE": res["tiers"]["KECE"], "note": note}
    if not cal:  # jangan menimpa bobot tebakan dengan angka dari sampel kecil
        out["scoring"]["boneWeights"] = ref["scoring"]["boneWeights"]
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="tari_extract.calibrate")
    ap.add_argument("--ref", required=True, help="referensi tari-reference/0.1")
    ap.add_argument("--group", action="append", required=True, metavar="NAMA=a.json,b.json",
                    help="penari|terlatih|awam = daftar hasil ekstraksi rekaman (boleh diulang)")
    ap.add_argument("-o", "--out", required=True, help="laporan kalibrasi (JSON)")
    ap.add_argument("--apply", metavar="REF_BARU.json", help="tulis salinan referensi dengan scoring baru")
    ap.add_argument("--min-n", type=int, default=5, help="rekaman minimal per kelompok untuk calibrated:true")
    a = ap.parse_args(argv)
    ref = json.load(open(a.ref))
    groups: dict[str, list[dict]] = {}
    for spec in a.group:
        name, _, files = spec.partition("=")
        if name not in GROUPS or not files:
            print(f"--group tidak valid: {spec} (nama harus salah satu dari {GROUPS})", file=sys.stderr)
            return 1
        groups[name] = [json.load(open(f)) for f in files.split(",")]
    res = calibrate(ref, groups, a.min_n)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    json.dump(res, open(a.out, "w"), indent=1, ensure_ascii=False)
    print(f"sigma default {res['sigmaDeg']['default']}° · toleransi {res['timing']['toleranceMs']} ms · tier {res['tiers']}")
    print(f"AUC {res['separationAUC']}  n {res['n']}")
    for w in res["warnings"]:
        print(f"  [!] {w}")
    print("TERKALIBRASI" if res["calibrated"] else "BELUM terkalibrasi (lihat peringatan)")
    if a.apply:
        json.dump(apply_to_reference(ref, res), open(a.apply, "w"), separators=(",", ":"), ensure_ascii=False)
        print(f"Tersimpan: {a.apply}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
