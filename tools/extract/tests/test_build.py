"""Tes perakit dokumen (tanpa video) + kontrak terhadap loader/scorer app."""
import json

import numpy as np
import pytest

from conftest import POSE_A, POSE_B, ROOT, load_scorer_mirror, synth_kp
from tari_extract.build import build, quality
from tari_extract.detect import Raw
from tari_extract.keypoints import MP_IDX, NAMES
from tari_extract.segment import Params

W, H = 416, 620


def make_raw(schedule, fps=30, jitter=0.002, vis=0.95, drop=None):
    t, kp = synth_kp(schedule, fps, jitter)
    px = kp * 113.0 + np.array([W / 2, 250.0])
    det = np.ones(len(t), bool)
    visa = np.full((len(t), 7), vis)
    if drop:
        a, b = drop
        px[a:b] = np.nan
        det[a:b] = False
        visa[a:b] = 0
    return Raw(t, px, visa, det, W, H, {"file": "sintetis.mp4", "model": "tes", "nominalFps": fps,
                                        "frames": len(t), "durationSec": float(t[-1])})


SCHED = [(2.0, POSE_A), (2.0, POSE_B), (2.0, POSE_A)]


def test_document_has_all_contract_fields():
    doc, _ = build(make_raw(SCHED), "t1", "Tes")
    for k in ["schema", "id", "title", "source", "clock", "extraction", "poses", "segments", "scoring", "validation", "track"]:
        assert k in doc
    assert doc["schema"] == "tari-reference/0.1"
    assert doc["clock"]["bpm"] is None and doc["clock"]["audio"] is None
    p = doc["poses"][0]
    assert set(p) == {"id", "keypoints", "bones", "scaleRatio", "medianMinVisibility"}
    assert set(p["keypoints"]) == set(NAMES)
    assert set(p["bones"]) == {"L_upper", "L_fore", "R_upper", "R_fore", "shoulders"}
    assert all(doc["scoring"][k].get("calibrated") is False for k in ["sigmaDeg", "timing", "tiers"])


def test_matches_reference_sample_field_shapes():
    ref_path = ROOT / "public/videos/reference-short-1.json"
    if not ref_path.exists():
        pytest.skip("reference-short-1.json tidak ada")
    ref = json.load(open(ref_path))
    doc, _ = build(make_raw(SCHED), "t1", "Tes")
    assert list(ref.keys()) == list(doc.keys())
    assert list(ref["poses"][0].keys()) == list(doc["poses"][0].keys())
    assert list(ref["track"].keys())[:9] == list(doc["track"].keys())[:9]
    assert list(ref["extraction"]["normalization"]) == list(doc["extraction"]["normalization"])
    for key in ("pose", "tStart", "tEnd", "scored"):
        assert key in doc["segments"][0]
    ev = next(s for s in doc["segments"] if s["type"] in ("swap", "bow"))
    assert set(ev) >= {"id", "type", "from", "to", "tOnset", "scored"}


def test_segments_sequence_and_times_consistent():
    doc, _ = build(make_raw(SCHED), "t1", "Tes")
    types = [s["type"] for s in doc["segments"]]
    assert types == ["pose", "swap", "pose", "swap", "pose"]
    assert [s.get("pose") for s in doc["segments"] if s["type"] == "pose"] == ["A", "B", "A"]
    segs = doc["segments"]
    for s in segs:
        a = s.get("tStart", s.get("tOnset"))
        assert 0 <= a <= doc["source"]["durationSec"]
    assert len({s["id"] for s in segs}) == len(segs)
    assert segs[0]["id"] == "s1" and segs[1]["id"] == "e1"


def test_track_shape_and_time_base():
    doc, _ = build(make_raw(SCHED), "t1", "Tes")
    tr, n = doc["track"], len(doc["track"]["t"])
    assert tr["fps"] == 15 and tr["t"][0] == 0.0
    assert all(len(tr[k]) == n and len(tr[k][0]) == 2 for k in NAMES)
    assert np.all(np.diff(tr["t"]) > 0)


def test_self_score_with_app_scorer_is_near_100():
    """Track hasil ekstraksi, dinilai dengan scorer app terhadap pose-nya sendiri."""
    m = load_scorer_mirror()
    doc, _ = build(make_raw(SCHED), "t1", "Tes")
    tr, t = doc["track"], np.array(doc["track"]["t"])
    W_ = doc["scoring"]["boneWeights"]
    bones = {p["id"]: p["bones"] for p in doc["poses"]}
    for s in doc["segments"]:
        if s["type"] != "pose":
            continue
        idx = np.where((t >= s["tStart"] + 0.2) & (t <= s["tEnd"] - 0.2))[0]
        scores = [m.score_pose(m.bones_from_keypoints({n: tr[n][i] for n in NAMES}), bones[s["pose"]], W_, 25)["score"] for i in idx]
        assert np.mean(scores) > 97


def test_clip_start_offset_makes_times_relative():
    raw = make_raw(SCHED)
    shifted = Raw(raw.t + 10.0, raw.px, raw.vis, raw.detected, raw.width, raw.height, raw.meta)
    a, _ = build(raw, "t1", "Tes")
    b, dbg = build(shifted, "t1", "Tes")
    assert [s.get("tStart", s.get("tOnset")) for s in a["segments"]] == [s.get("tStart", s.get("tOnset")) for s in b["segments"]]
    assert b["source"]["clipStartSec"] == 10.0 and dbg["offset"] == 10.0


def test_no_stable_pose_gives_single_flow_and_not_usable():
    t = np.arange(0, 4, 1 / 30)
    raw = make_raw([(4.0, POSE_A)])
    raw.px[:, 3:] += (60 * np.sin(2 * np.pi * 2 * t))[:, None, None] * np.array([0, 1.0])
    doc, _ = build(raw, "t1", "Tes")
    assert [s["type"] for s in doc["segments"]] == ["flow"] and doc["segments"][0]["scored"] is False
    q = doc["validation"]["quality"]
    assert q["usable"] is False and any("pose stabil" in w for w in q["warnings"])


def test_detection_gap_flagged_and_not_invented():
    raw = make_raw(SCHED, drop=(60, 150))          # 3 dtk tanpa deteksi
    doc, _ = build(raw, "t1", "Tes")
    q = doc["validation"]["quality"]
    assert q["usable"] is False and doc["track"].get("gaps")
    assert all(s["scored"] is False or s["type"] != "pose" or s["tEnd"] <= 2.0 or s["tStart"] >= 5.0 for s in doc["segments"])


def test_quality_gate_low_visibility_and_out_of_frame():
    q = quality(make_raw(SCHED, vis=0.3))
    assert q["usable"] is False and any("visibilitas" in w for w in q["warnings"])
    raw = make_raw(SCHED)
    raw.px[:, 5:, 0] = W + 50                       # pergelangan keluar frame
    assert any("keluar frame" in w for w in quality(raw)["warnings"])
    assert quality(make_raw(SCHED))["usable"] is True


def test_json_serializable_without_nan():
    doc, _ = build(make_raw(SCHED, drop=(60, 150)), "t1", "Tes")
    s = json.dumps(doc, allow_nan=False)            # NaN akan melempar ValueError
    assert "NaN" not in s
