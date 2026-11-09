"""Tes unit modul murni: geometri, filter, segmentasi. Tanpa video/ML."""
import json
import re
from pathlib import Path

import numpy as np

from conftest import POSE_A, POSE_B, ROOT, kp_array, load_scorer_mirror, synth_kp
from tari_extract import keypoints as KP
from tari_extract.filters import OneEuro, fill_gaps, one_euro_track, resample
from tari_extract.geometry import angle_deg, bone_dict, bones_from_kp, normalize, pose_distance
from tari_extract.segment import Params, beat_candidate, cluster_holds, find_holds, pose_id


# ---------------------------------------------------------------- kontrak
def test_keypoint_indices_match_typescript():
    """Indeks MediaPipe di Python harus sama dengan src/lib/pose/keypoints.ts."""
    ts = (ROOT / "src/lib/pose/keypoints.ts").read_text()
    block = re.search(r"export const IDX = \{(.*?)\} as const", ts, re.S).group(1)
    idx = {m[0]: int(m[1]) for m in re.findall(r"(\w+):\s*(\d+)", block)}
    assert idx == KP.MP_INDEX
    names = re.search(r"UPPER_KP_NAMES = \[(.*?)\] as const", ts, re.S).group(1)
    assert re.findall(r'"(\w+)"', names) == KP.NAMES


def test_bones_identical_to_scorer_mirror():
    m = load_scorer_mirror()
    kp = kp_array(POSE_A)
    mine = bone_dict(bones_from_kp(kp))
    ref = m.bones_from_keypoints({n: list(POSE_A[n]) for n in POSE_A})
    for b, v in ref.items():
        assert np.allclose(mine[b], v, atol=1e-3), b


def test_angle_matches_scorer_mirror():
    m = load_scorer_mirror()
    rng = np.random.default_rng(1)
    for _ in range(50):
        a, b = rng.normal(size=2), rng.normal(size=2)
        a, b = a / np.linalg.norm(a), b / np.linalg.norm(b)
        assert abs(float(angle_deg(a, b)) - m.angle_err_deg(list(a), list(b))) < 1e-9


def test_shoulder_bone_points_to_image_right_for_unmirrored_camera():
    """Regresi: bone `shoulders` = L-R. Penari menghadap kamera tanpa mirror -> L di +x.
    JSON contoh lama menyimpan tanda terbalik sehingga skor diri sendiri maksimal ~91."""
    b = bone_dict(bones_from_kp(kp_array(POSE_A)))
    assert b["shoulders"][0] > 0.99


def test_self_score_is_100_with_app_scorer():
    m = load_scorer_mirror()
    bones = bone_dict(bones_from_kp(kp_array(POSE_B)))
    user = m.bones_from_keypoints({n: list(POSE_B[n]) for n in POSE_B})
    w = {"L_upper": 1.0, "L_fore": 0.6, "R_upper": 1.0, "R_fore": 0.6, "shoulders": 0.3}
    assert m.score_pose(user, bones, w, 25)["score"] > 99.9


# ----------------------------------------------------------------- filter
def test_one_euro_matches_typescript_golden():
    """Vektor dari src/lib/pose/oneEuro.ts dijalankan lewat bun (mincutoff 1, beta .05, dcutoff 1)."""
    t = [0, 0.0167, 0.0333, 0.0667, 0.0833, 0.1333, 0.1667, 0.2, 0.25, 0.3, 0.4, 0.5]
    x = [10, 10.4, 12, 30, 55, 60, 58, 59, 100, 140, 141, 139]
    golden = [10, 10.041853950917993, 10.315599721905297, 21.394995547909655, 40.58429395455746,
              55.6869095062855, 57.191437176363756, 58.31095463580452, 93.0641252395501,
              134.05272289813297, 140.2931742753858, 139.2013644134844]
    f = OneEuro(1.0, 0.05, 1.0)
    got = [f(xi, ti) for xi, ti in zip(x, t)]
    assert np.allclose(got, golden, atol=1e-9)


def test_one_euro_reduces_static_jitter():
    rng = np.random.default_rng(0)
    t = np.arange(200) / 30
    px = np.zeros((200, 1, 2)) + 100 + rng.normal(0, 1.5, (200, 1, 2))
    out = one_euro_track(t, px)
    assert np.std(out[50:]) < 0.5 * np.std(px[50:])


def test_fill_gaps_short_filled_long_kept():
    t = np.arange(30) / 30
    px = np.tile(np.arange(30, dtype=float)[:, None, None], (1, 2, 2))
    px[5:8] = np.nan           # 0.1 dtk -> diisi
    px[15:25] = np.nan         # 0.33 dtk -> tetap NaN
    out, filled, unres = fill_gaps(t, px, max_gap=0.2)
    assert np.allclose(out[5:8, 0, 0], [5, 6, 7]) and filled[5:8].all()
    assert np.isnan(out[15:25]).all() and unres[15:25].all() and not unres[:15].any()


def test_resample_does_not_bridge_long_gap():
    t = np.arange(0, 3, 1 / 30)
    a = np.sin(t)[:, None]
    a[30:70] = np.nan
    g = np.arange(0, 2.9, 1 / 15)
    out = resample(t, a, g)
    mid = (g > 1.1) & (g < 2.2)
    assert np.isnan(out[mid]).all() and not np.isnan(out[g < 0.9]).any()


def test_normalize_origin_and_scale():
    px = kp_array(POSE_A)[None] * 100 + np.array([300.0, 200.0])
    n = normalize(px, 100.0)[0]
    assert np.allclose((n[1] + n[2]) / 2, 0, atol=1e-9)
    assert np.allclose(n, kp_array(POSE_A), atol=1e-9)


# ------------------------------------------------------------ segmentasi
def _holds(schedule, jitter=0.002):
    p = Params()
    t, kp = synth_kp(schedule, p.fps, jitter=jitter)
    holds, sp = find_holds(kp, t, np.zeros(len(t), bool), p)
    return p, t, kp, holds, sp


def test_holds_found_with_transition_between():
    p, t, kp, holds, _ = _holds([(2.0, POSE_A), (2.0, POSE_B), (2.0, POSE_A)])
    assert len(holds) == 3
    assert holds[0].t0 == 0.0 and 1.8 < holds[0].t1 < 2.1
    assert holds[1].t0 > 2.0 and holds[1].t1 > 3.9


def test_clusters_repeat_poses_and_separates_different_ones():
    p, t, kp, holds, _ = _holds([(2.0, POSE_A), (2.0, POSE_B), (2.0, POSE_A)])
    cent, members, assign = cluster_holds(holds, [1.0] * len(holds), p)
    assert assign == [0, 1, 0] and len(cent) == 2
    assert pose_distance(cent[0], cent[1]) > 40


def test_wider_shoulders_split_otherwise_identical_pose():
    """Membungkuk memperbesar lebar bahu; pose bone-nya mirip tapi harus tetap terpisah."""
    p, t, kp, holds, _ = _holds([(2.0, POSE_A), (2.0, POSE_B), (2.0, POSE_A)])
    cent, members, assign = cluster_holds(holds, [1.0, 1.0, 1.25], p)
    assert assign == [0, 1, 2]


def test_noise_does_not_create_spurious_holds():
    p, t, kp, holds, sp = _holds([(3.0, POSE_A)], jitter=0.01)
    assert len(holds) == 1 and holds[0].t1 - holds[0].t0 > 2.8


def test_continuous_motion_yields_no_holds():
    p = Params()
    t = np.arange(0, 4, 1 / p.fps)
    base = kp_array(POSE_A)
    kp = np.array([base + np.array([0, 0.5 * np.sin(2 * np.pi * 2 * x)]) * np.array([[0], [0], [0], [1], [1], [1], [1]]) for x in t])
    holds, _ = find_holds(kp, t, np.zeros(len(t), bool), p)
    assert holds == []


def test_nan_frames_never_become_holds():
    p = Params()
    t, kp = synth_kp([(3.0, POSE_A)], p.fps)
    kp[10:25] = np.nan
    holds, _ = find_holds(kp, t, np.isnan(kp).any(axis=(1, 2)), p)
    for h in holds:
        assert not (h.s <= 17 <= h.e)


def test_beat_candidate_only_when_periodic():
    p = Params()
    assert beat_candidate([0, 1.0, 2.0, 3.0, 4.0], p)[1] == 60.0
    assert beat_candidate([0, 0.4, 1.9, 2.0, 4.0], p) is None
    assert beat_candidate([0, 1.0], p) is None


def test_pose_id_sequence():
    assert [pose_id(i) for i in (0, 1, 2, 25, 26)] == ["A", "B", "C", "Z", "P27"]
