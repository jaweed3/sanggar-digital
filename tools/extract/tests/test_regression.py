"""Regresi pada video nyata (lambat, ~10 dtk). Lewati bila video/contoh tidak ada.

Membandingkan hasil ekstraksi ulang dengan public/videos/reference-short-1.json
(yang disetel tangan): jumlah & urutan segmen, onset event, dan bone tiap pose.
"""
import json

import numpy as np
import pytest

from conftest import ROOT
from tari_extract.build import build
from tari_extract.detect import detect_video
from tari_extract.geometry import angle_deg

VIDEO = ROOT / "public/videos/saman/short-1-saman.mp4"
REF = ROOT / "public/videos/reference-short-1.json"
pytestmark = pytest.mark.skipif(not (VIDEO.exists() and REF.exists()), reason="video/contoh tidak ada")


@pytest.fixture(scope="module")
def doc():
    raw = detect_video(str(VIDEO), progress=False)
    d, _ = build(raw, "saman-dasar-prototipe", "Saman (gerak dasar), prototipe")
    return d


@pytest.fixture(scope="module")
def ref():
    return json.load(open(REF))


def test_same_segment_structure(doc, ref):
    assert [(s["type"], s.get("pose"), s.get("from"), s.get("to")) for s in doc["segments"]] == \
           [(s["type"], s.get("pose"), s.get("from"), s.get("to")) for s in ref["segments"]]


def test_times_within_tolerance(doc, ref):
    for a, b in zip(doc["segments"], ref["segments"]):
        for k in ("tStart", "tEnd", "tOnset"):
            if k in b:
                assert abs(a[k] - b[k]) <= 0.2, (a["id"], k, a[k], b[k])


def test_pose_bones_close_to_reference(doc, ref):
    for a, b in zip(doc["poses"], ref["poses"]):
        assert a["id"] == b["id"] and abs(a["scaleRatio"] - b["scaleRatio"]) < 0.05
        for bone in ("L_upper", "L_fore", "R_upper", "R_fore"):
            err = float(angle_deg(np.array(a["bones"][bone]), np.array(b["bones"][bone])))
            assert err < 5, (a["id"], bone, err)


def test_track_close_to_reference(doc, ref):
    assert doc["track"]["fps"] == ref["track"]["fps"]
    n = min(len(doc["track"]["t"]), len(ref["track"]["t"]))
    for name in ("L_wrist", "R_wrist", "L_elbow", "R_elbow", "nose"):
        d = np.linalg.norm(np.array(doc["track"][name][:n]) - np.array(ref["track"][name][:n]), axis=1)
        assert np.median(d) < 0.03 and np.percentile(d, 95) < 0.12, name


def test_quality_gate_passes_and_scale_matches(doc, ref):
    assert doc["validation"]["quality"]["usable"] is True
    assert abs(doc["extraction"]["normalization"]["scalePx"] - ref["extraction"]["normalization"]["scalePx"]) < 1.0


def test_known_sign_difference_of_shoulder_bone(doc, ref):
    """CATATAN: contoh lama menyimpan bone `shoulders` = R-L (tanda terbalik terhadap scorer.ts = L-R).
    Detektor mengikuti scorer.ts, sehingga skor diri sendiri ~100, bukan ~91."""
    a, b = doc["poses"][0]["bones"]["shoulders"], ref["poses"][0]["bones"]["shoulders"]
    assert a[0] > 0.9 and b[0] < -0.9
