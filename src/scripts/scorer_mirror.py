"""Mirror Python dari src/lib/pose/scorer.ts — rumus HARUS identik.
Dipakai oleh scripts/golden-check.ts: TS dan Python dijalankan pada
input yang sama, skor harus sama (tol 1e-9). Jika rumus berubah di satu
sisi tanpa sisi lain, golden test gagal — itu disengaja.

Rumus: score_bone = exp(-0.5 * (err/sigma)^2); total = 100 * sum(w*s)/sum(w).
Sudut = |atan2(cross, dot)| dalam derajat.
"""
import json
import math
import sys


def angle_err_deg(a, b):
    dot = a[0] * b[0] + a[1] * b[1]
    cross = a[0] * b[1] - a[1] * b[0]
    return abs(math.atan2(cross, dot)) * 180.0 / math.pi


def _sub(p, q):
    return [p[0] - q[0], p[1] - q[1]]


def _norm(v):
    n = math.hypot(v[0], v[1]) or 1.0
    return [v[0] / n, v[1] / n]


def bones_from_keypoints(kp):
    return {
        "L_upper": _norm(_sub(kp["L_elbow"], kp["L_shoulder"])),
        "L_fore": _norm(_sub(kp["L_wrist"], kp["L_elbow"])),
        "R_upper": _norm(_sub(kp["R_elbow"], kp["R_shoulder"])),
        "R_fore": _norm(_sub(kp["R_wrist"], kp["R_elbow"])),
        "shoulders": _norm(_sub(kp["L_shoulder"], kp["R_shoulder"])),
    }


def score_pose(user_bones, ref_bones, weights, sigma_deg):
    per_bone = {}
    num = 0.0
    den = 0.0
    for bone, r in ref_bones.items():
        u = user_bones.get(bone)
        if u is None:
            continue
        w = weights.get(bone, 1.0)
        err = angle_err_deg(u, r)
        bs = math.exp(-0.5 * (err / sigma_deg) ** 2)
        per_bone[bone] = {"errDeg": err, "boneScore": bs, "weight": w}
        num += w * bs
        den += w
    return {"score": (100.0 * num / den) if den > 0 else 0.0, "perBone": per_bone}


def judge_window(frames, t0, t1):
    inside = [f for f in frames if t0 <= f["t"] <= t1]
    if not inside:
        return 0.0
    return sum(f["score"] for f in inside) / len(inside)


def main():
    path = sys.argv[1]
    with open(path) as f:
        cases = json.load(f)
    out = []
    for c in cases:
        r = score_pose(c["userBones"], c["refBones"], c["weights"], c["sigmaDeg"])
        out.append({"score": r["score"], "perBone": {k: {"errDeg": v["errDeg"], "boneScore": v["boneScore"]} for k, v in r["perBone"].items()}})
    print(json.dumps(out))


if __name__ == "__main__":
    main()
