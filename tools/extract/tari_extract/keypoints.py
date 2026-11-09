"""Pemetaan keypoint tubuh-atas. Cermin dari src/lib/pose/keypoints.ts.

Indeks MediaPipe hanya ditulis di sini. Jika src/lib/pose/keypoints.ts berubah,
ubah juga file ini (dicek oleh tests/test_contract.py).
"""

# Urutan = UPPER_KP_NAMES di keypoints.ts.
NAMES = ["nose", "L_shoulder", "R_shoulder", "L_elbow", "R_elbow", "L_wrist", "R_wrist"]
MP_INDEX = {
    "nose": 0,
    "L_shoulder": 11,
    "R_shoulder": 12,
    "L_elbow": 13,
    "R_elbow": 14,
    "L_wrist": 15,
    "R_wrist": 16,
}
MP_IDX = [MP_INDEX[n] for n in NAMES]

# Posisi di dalam larik 7 keypoint.
K = {n: i for i, n in enumerate(NAMES)}

# Sendi yang wajib terlihat (tanpa hidung), sama dengan UPPER_BODY_JOINTS.
JOINTS = [K[n] for n in NAMES if n != "nose"]

BONE_NAMES = ["L_upper", "L_fore", "R_upper", "R_fore", "shoulders"]
# (dari, ke) untuk tiap bone, sama dengan bonesFromKeypoints di scorer.ts.
BONE_PAIRS = {
    "L_upper": ("L_shoulder", "L_elbow"),
    "L_fore": ("L_elbow", "L_wrist"),
    "R_upper": ("R_shoulder", "R_elbow"),
    "R_fore": ("R_elbow", "R_wrist"),
    "shoulders": ("R_shoulder", "L_shoulder"),
}
ARM_BONES = ["L_upper", "L_fore", "R_upper", "R_fore"]
