"""Tes alat kalibrasi dengan rekaman SINTETIS (bukan data penari nyata)."""
import numpy as np
import pytest

from conftest import POSE_A, POSE_B, kp_array, synth_kp
from tari_extract.calibrate import apply_to_reference, calibrate, window_errors, best_offset
from tari_extract.keypoints import NAMES

import json
from tari_extract.build import build
from test_build import make_raw

SCHED = [(2.0, POSE_A), (2.0, POSE_B), (2.0, POSE_A)]


@pytest.fixture(scope="module")
def ref():
    doc, _ = build(make_raw(SCHED), "ref", "Ref")
    return doc


def attempt(ref, noise_deg=0.0, shift=0.0, seed=0):
    """Rekaman sintetis: track referensi + derau sudut pada lengan + geseran waktu."""
    rng = np.random.default_rng(seed)
    t = np.array(ref["track"]["t"]) + shift
    kp = np.stack([np.array(ref["track"][n]) for n in NAMES], axis=1)
    sh = (kp[:, 1] + kp[:, 2]) / 2
    for j in (3, 4, 5, 6):               # elbow/wrist diputar acak di sekitar bahu
        v = kp[:, j] - sh
        a = np.radians(rng.normal(0, noise_deg, len(t)))
        c, s = np.cos(a), np.sin(a)
        kp[:, j] = sh + np.stack([c * v[:, 0] - s * v[:, 1], s * v[:, 0] + c * v[:, 1]], 1)
    tr = {"fps": ref["track"]["fps"], "t": [float(x) for x in t]}
    for i, n in enumerate(NAMES):
        tr[n] = kp[:, i].tolist()
    return {"track": tr}


def groups(ref, n=6):
    return {
        "penari": [attempt(ref, 4, 0.0, s) for s in range(n)],
        "terlatih": [attempt(ref, 12, 0.1, 100 + s) for s in range(n)],
        "awam": [attempt(ref, 30, 0.3, 200 + s) for s in range(n)],
    }


def test_window_errors_zero_for_identical_track(ref):
    e, _ = window_errors(ref, attempt(ref), 0.0)
    assert len(e) > 20 and e.max() < 3.0


def test_best_offset_recovers_time_shift(ref):
    w = np.array([1.0, 0.6, 1.0, 0.6, 0.3])
    # rekaman tertinggal 0.2 dtk dari referensi -> offset ~ +0.2
    assert abs(best_offset(ref, attempt(ref, 1.0, shift=0.2), w) - 0.2) <= 0.1


def test_groups_ordered_and_tiers_sensible(ref):
    res = calibrate(ref, groups(ref), min_n=5)
    gs = res["groupScores"]
    assert gs["penari"]["median"] > gs["terlatih"]["median"] > gs["awam"]["median"]
    assert res["tiers"]["HEBAT"] > res["tiers"]["KECE"] > 0
    assert res["separationAUC"]["penari_vs_awam"] > 0.9
    assert 10 <= res["sigmaDeg"]["default"] <= 45
    assert res["calibrated"] is True and res["warnings"] == []


def test_not_calibrated_when_too_few_recordings(ref):
    res = calibrate(ref, groups(ref, n=2), min_n=5)
    assert res["calibrated"] is False and any("hanya 2" in w for w in res["warnings"])
    new = apply_to_reference(ref, res)
    assert new["scoring"]["sigmaDeg"]["calibrated"] is False
    assert new["scoring"]["boneWeights"] == ref["scoring"]["boneWeights"]    # bobot tebakan tidak ditimpa


def test_not_calibrated_when_groups_do_not_separate(ref):
    g = {k: [attempt(ref, 10, 0.0, s + off) for s in range(6)] for k, off in (("penari", 0), ("terlatih", 50), ("awam", 99))}
    res = calibrate(ref, g, min_n=5)
    assert res["calibrated"] is False and any("terpisah" in w for w in res["warnings"])


def test_penari_group_is_required(ref):
    with pytest.raises(SystemExit):
        calibrate(ref, {"awam": [attempt(ref)]})


def test_apply_marks_all_scoring_fields_when_calibrated(ref):
    res = calibrate(ref, groups(ref), min_n=5)
    new = apply_to_reference(ref, res)
    for k in ("sigmaDeg", "timing", "tiers"):
        assert new["scoring"][k]["calibrated"] is True
    assert new["poses"] == ref["poses"] and new["segments"] == ref["segments"]
    json.dumps(new, allow_nan=False)
