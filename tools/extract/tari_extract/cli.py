"""CLI: uv run python -m tari_extract <video> -o out.json"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .build import build
from .detect import Raw, detect_video
from .segment import Params


def main(argv=None) -> int:
    d = Params()
    ap = argparse.ArgumentParser(prog="tari_extract", description="Video tari -> JSON tari-reference/0.1")
    ap.add_argument("video")
    ap.add_argument("-o", "--out", help="berkas JSON keluaran (default: <video>.reference.json)")
    ap.add_argument("--id", dest="ref_id", help="id referensi (default: nama berkas)")
    ap.add_argument("--title", help="judul (default: id)")
    ap.add_argument("--note", default="", help="catatan sumber/hak pakai untuk source.note")
    ap.add_argument("--start", type=float, default=0.0, help="detik awal klip")
    ap.add_argument("--end", type=float, default=None, help="detik akhir klip")
    ap.add_argument("--complexity", type=int, default=1, choices=[0, 1, 2], help="model_complexity MediaPipe")
    ap.add_argument("--reuse", action="store_true", help="pakai cache landmark (<out>.landmarks.npz) bila ada")
    ap.add_argument("--sheet", action="store_true", help="simpan contact sheet frame per segmen")
    ap.add_argument("--plot", action="store_true", help="simpan PNG stickman pose + grafik kecepatan")
    ap.add_argument("--pretty", action="store_true", help="JSON berindentasi (default ringkas)")
    ap.add_argument("--strict", action="store_true", help="keluar kode 2 bila gerbang kualitas tidak lolos")
    ap.add_argument("--thresh", type=float, default=d.thresh, help="deg/s di bawah ini = diam")
    ap.add_argument("--min-hold", type=float, default=d.min_hold)
    ap.add_argument("--cluster", type=float, default=d.cluster_deg, dest="cluster_deg")
    ap.add_argument("--flow-gap", type=float, default=d.flow_gap)
    a = ap.parse_args(argv)

    vp = Path(a.video)
    if not vp.exists():
        print(f"Video tidak ditemukan: {vp}", file=sys.stderr)
        return 1
    out = Path(a.out) if a.out else vp.with_suffix(".reference.json")
    ref_id = a.ref_id or vp.stem
    p = Params(thresh=a.thresh, min_hold=a.min_hold, cluster_deg=a.cluster_deg, flow_gap=a.flow_gap)

    out.parent.mkdir(parents=True, exist_ok=True)
    cache = out.with_suffix(".landmarks.npz")
    if a.reuse and cache.exists():
        raw = Raw.load(cache)
        print(f"cache dipakai: {cache} ({len(raw.t)} frame)")
    else:
        print(f"Mendeteksi pose: {vp.name}")
        raw = detect_video(str(vp), a.start, a.end, a.complexity)
        raw.save(cache)
    doc, dbg = build(raw, ref_id, a.title or ref_id, p, a.note)

    with open(out, "w") as f:
        json.dump(doc, f, indent=1 if a.pretty else None, separators=None if a.pretty else (",", ":"), ensure_ascii=False)

    q = doc["validation"]["quality"]
    print(f"\n== KUALITAS ==  deteksi {q['detectRate']:.0%} · lolos {q['goodRate']:.0%} · dalam frame {q['inFrameRate']:.0%}")
    for w in q["warnings"]:
        print(f"  [!] {w}")
    if not q["usable"]:
        print("  >>> BELUM LAYAK jadi referensi resmi (lihat peringatan). Hasil hanya untuk uji pipeline.")
    print(f"\n== {len(doc['poses'])} pose, {len(doc['segments'])} segmen ==")
    for s in doc["segments"]:
        if s["type"] == "pose":
            print(f"  {s['id']:>3}  pose {s['pose']}  {s['tStart']:.2f}-{s['tEnd']:.2f}s")
        elif s["type"] == "flow":
            print(f"  {s['id']:>3}  flow       {s['tStart']:.2f}-{s['tEnd']:.2f}s  (tidak dinilai)")
        else:
            print(f"  {s['id']:>3}  {s['type']:<4} {s['from']}>{s['to']}  @{s['tOnset']:.2f}s")
    if not doc["poses"]:
        print("  [!] Tidak ada pose stabil terdeteksi. Coba --thresh lebih tinggi atau --min-hold lebih pendek.")
    print(f"\nTersimpan: {out}")
    prefix = str(out.with_suffix(""))
    if a.plot:
        from .viz import save_plots
        for o in save_plots(doc, dbg, prefix):
            print(f"Tersimpan: {o}")
    if a.sheet:
        from .viz import contact_sheet
        contact_sheet(str(vp), doc, dbg["offset"], f"{prefix}_sheet.png")
        print(f"Tersimpan: {prefix}_sheet.png")
    if a.strict and not q["usable"]:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
