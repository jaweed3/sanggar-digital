"""Pemeriksaan visual: contact sheet frame video, stickman pose, grafik kecepatan."""
from __future__ import annotations

import numpy as np

from .geometry import unit
from .keypoints import BONE_NAMES


def contact_sheet(video: str, doc: dict, offset: float, out: str, cols: int = 4, width: int = 260) -> None:
    """Satu tile per segmen (frame di titik tengah), diberi label id/tipe/waktu."""
    import cv2
    cap = cv2.VideoCapture(video)
    tiles = []
    for s in doc["segments"]:
        t = (s["tStart"] + s["tEnd"]) / 2 if "tStart" in s else s["tOnset"]
        cap.set(cv2.CAP_PROP_POS_MSEC, (t + offset) * 1000)
        ok, fr = cap.read()
        if not ok:
            continue
        h, w = fr.shape[:2]
        fr = cv2.resize(fr, (width, int(width * h / w)))
        who = s.get("pose") or (f"{s['from']}>{s['to']}" if "from" in s else "")
        label = " ".join(x for x in (s["id"], who, s["type"], f"@{t:.2f}s") if x)
        cv2.rectangle(fr, (0, 0), (width, 22), (0, 0, 0), -1)
        cv2.putText(fr, label, (6, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
        tiles.append(fr)
    cap.release()
    if not tiles:
        return
    H, W = tiles[0].shape[:2]
    tiles = [cv2.resize(x, (W, H)) for x in tiles]
    while len(tiles) % cols:
        tiles.append(np.zeros((H, W, 3), np.uint8))
    cv2.imwrite(out, np.vstack([np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)]))


def _stick(ax, kp: dict, lw=3):
    def P(n):
        return np.array(kp[n])
    for a, b in [("L_shoulder", "R_shoulder"), ("L_shoulder", "L_elbow"), ("L_elbow", "L_wrist"),
                 ("R_shoulder", "R_elbow"), ("R_elbow", "R_wrist")]:
        ax.plot([P(a)[0], P(b)[0]], [P(a)[1], P(b)[1]], "k-", lw=lw, solid_capstyle="round")
    n = P("nose")
    ax.add_patch(__import__("matplotlib.pyplot").pyplot.Circle(n, 0.25, fill=False, lw=lw))
    ax.set_aspect("equal")
    ax.invert_yaxis()        # y gambar ke bawah
    ax.axis("off")


def save_plots(doc: dict, dbg: dict, prefix: str) -> list[str]:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    outs = []
    poses = doc["poses"]
    if poses:
        cols = min(4, len(poses))
        rows = int(np.ceil(len(poses) / cols))
        fig, axs = plt.subplots(rows, cols, figsize=(3 * cols, 3.4 * rows), squeeze=False)
        for ax in axs.flat:
            ax.axis("off")
        for ax, pz in zip(axs.flat, poses):
            _stick(ax, pz["keypoints"])
            ax.set_title(f"{pz['id']}  scale {pz['scaleRatio']}", fontsize=9)
        fig.tight_layout()
        fig.savefig(f"{prefix}_poses.png", dpi=110)
        plt.close(fig)
        outs.append(f"{prefix}_poses.png")

    g, sp = dbg["grid"] - dbg["grid"][0], dbg["speed"]
    fig, ax = plt.subplots(figsize=(12, 3.5))
    ax.plot(g, sp, color="gray", lw=1)
    ax.axhline(doc["validation"]["params"]["thresh"], color="orange", ls=":", lw=1)
    for h in dbg["holds"]:
        ax.axvspan(h.t0, h.t1, alpha=0.25, color="green")
        ax.text(h.t0, np.nanmax(sp) * 0.95, h.pose, fontsize=9, va="top")
    for s in doc["segments"]:
        if s["type"] == "flow":
            ax.axvspan(s["tStart"], s["tEnd"], alpha=0.12, color="blue")
        elif "tOnset" in s:
            ax.axvline(s["tOnset"], color="k", ls="--", lw=0.8)
    for i in np.where(dbg["bad"])[0]:
        ax.axvspan(g[i] - 0.03, g[i] + 0.03, alpha=0.2, color="red", lw=0)
    ax.set_xlabel("detik"); ax.set_ylabel("kecepatan bone lengan (°/s)")
    ax.set_title("hijau = pose ditahan, biru = flow, garis putus = event, merah = frame buruk")
    fig.tight_layout()
    fig.savefig(f"{prefix}_timeline.png", dpi=110)
    plt.close(fig)
    outs.append(f"{prefix}_timeline.png")
    return outs
