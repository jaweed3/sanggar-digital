// Test lapis game: kalibrasi, penilaian segmen, dan lane.
//
// Modul-modul ini murni (tanpa DOM/rAF) — sengaja dibuat pure supaya
// bisa diuji di sini. Kalau suatu modul game ikut memakai DOM, pindahkan
// logikanya ke lib/pose atau lib/game/file-murni supaya tetap teruji.
import { describe, expect, test } from "bun:test";
import { CalibrationHold, checkFrame, type GuideBox } from "../lib/game/calibration";
import { activePoseId, dueVerdicts, finalFromVerdicts, normalizeKp, scoreFrame } from "../lib/game/judge";
import { buildLane, laneX, type LaneMark } from "../lib/game/lane";
import { CALIBRATION_VIS_THRESHOLD, SCORE_TIME_OFFSET_SEC } from "../lib/game/config";
import { IDX, upperKpFromLandmarks } from "../lib/pose/keypoints";
import type { TariReference } from "../lib/pose/reference";

/** Landmark tiruan 33 titik yang seluruh sendinya terlihat. */
function fakeLandmarks(visibility = 0.9): Array<{ x: number; y: number; visibility: number }> {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility }));
  lm[IDX.nose] = { x: 0.5, y: 0.2, visibility };
  lm[IDX.L_shoulder] = { x: 0.4, y: 0.3, visibility };
  lm[IDX.R_shoulder] = { x: 0.6, y: 0.3, visibility };
  lm[IDX.L_elbow] = { x: 0.4, y: 0.45, visibility };
  lm[IDX.R_elbow] = { x: 0.6, y: 0.45, visibility };
  lm[IDX.L_wrist] = { x: 0.4, y: 0.6, visibility };
  lm[IDX.R_wrist] = { x: 0.6, y: 0.6, visibility };
  return lm;
}

const GUIDE: GuideBox = { x: 100, y: 50, w: 800, h: 600 };

describe("kalibrasi", () => {
  test("landmark null → tubuh keluar frame", () => {
    const cf = checkFrame(null, 1000, 800, GUIDE);
    expect(cf.ok).toBe(false);
    expect(cf.reasons).toContain("tubuh-keluar-frame");
  });

  test("landmark kurang dari 17 titik → tubuh keluar frame", () => {
    const cf = checkFrame(fakeLandmarks().slice(0, 10), 1000, 800, GUIDE);
    expect(cf.ok).toBe(false);
    expect(cf.reasons).toContain("tubuh-keluar-frame");
  });

  test("visibilitas di bawah ambang ditolak", () => {
    const lm = fakeLandmarks();
    lm[IDX.L_wrist].visibility = CALIBRATION_VIS_THRESHOLD - 0.1;
    const cf = checkFrame(lm, 1000, 800, GUIDE);
    expect(cf.ok).toBe(false);
    expect(cf.reasons[0]).toStartWith("visibilitas-rendah:");
  });

  test("di luar kotak panduan ditolak", () => {
    const lm = fakeLandmarks();
    // Bahu (x=0.4) dipindah ke luar guide (guide mulai di x=100/1000=0.1).
    lm[IDX.L_shoulder] = { x: 0.02, y: 0.3, visibility: 0.9 };
    const cf = checkFrame(lm, 1000, 800, GUIDE);
    expect(cf.ok).toBe(false);
    expect(cf.reasons).toContain("di-luar-panduan");
  });

  test("landmark baik → ok, lebar bahu terukur", () => {
    const cf = checkFrame(fakeLandmarks(), 1000, 800, GUIDE);
    expect(cf.ok).toBe(true);
    expect(cf.reasons).toHaveLength(0);
    expect(cf.shoulderWidthPx).toBeCloseTo(200, 6);
  });
});

describe("CalibrationHold", () => {
  test("gagal satu frame mereset timer", () => {
    const hold = new CalibrationHold(1500);
    const good = { ok: true, shoulderWidthPx: 200, reasons: [] };
    const bad = { ok: false, shoulderWidthPx: 0, reasons: ["x"] };
    hold.update(good, 0);
    expect(hold.update(bad, 500)).toBe(0);
    // Setelah reset, progres kembali ke 0 bukan dilanjutkan.
    expect(hold.update(good, 600)).toBe(0);
  });

  test("progres naik 0..1 lalu selesai setelah holdMs", () => {
    const hold = new CalibrationHold(1500);
    const good = { ok: true, shoulderWidthPx: 200, reasons: [] };
    expect(hold.update(good, 0)).toBe(0);
    expect(hold.update(good, 750)).toBeCloseTo(0.5, 5);
    hold.update(good, 1500);
    expect(hold.done).toBe(true);
    expect(hold.update(good, 1600)).toBe(1);
  });

  test("median lebar bahu dipakai sebagai skala user", () => {
    const hold = new CalibrationHold(1500);
    // Median dari sampel genap = elemen tengah setelah sort.
    for (const w of [100, 200, 300, 400]) {
      hold.update({ ok: true, shoulderWidthPx: w, reasons: [] }, 0);
    }
    expect(hold.medianShoulder()).toBe(300);
  });

  test("reset() menghapus progres dan sampel", () => {
    const hold = new CalibrationHold(1500);
    hold.update({ ok: true, shoulderWidthPx: 200, reasons: [] }, 0);
    hold.reset();
    expect(hold.done).toBe(false);
    expect(hold.medianShoulder()).toBe(0);
  });
});

describe("penilaian segmen", () => {
  const ref: TariReference = {
    schema: "tari-reference/0.1",
    id: "test",
    title: "Test",
    source: { file: "x.mp4", durationSec: 10, note: "" },
    clock: { type: "video", audio: null, bpm: null, note: "" },
    extraction: {
      model: "m", filter: "f", frameRate: "15",
      normalization: { origin: "", scalePx: 0, scaleDef: "", axes: "", sides: "" },
      excludedLandmarks: "",
    },
    poses: [
      {
        id: "A",
        keypoints: { nose: [0, -0.5], L_shoulder: [-0.5, 0], R_shoulder: [0.5, 0], L_elbow: [-0.4, 0.5], R_elbow: [0.4, 0.5], L_wrist: [-0.3, 1], R_wrist: [0.3, 1] },
        bones: {},
        scaleRatio: 1,
        medianMinVisibility: 0.9,
      },
    ],
    segments: [
      { id: "s1", type: "pose", pose: "A", tStart: 1, tEnd: 2, scored: true },
      { id: "s2", type: "swap", from: "A", to: "A", tOnset: 5, scored: true },
      { id: "s3", type: "flow", tStart: 6, tEnd: 7, scored: true },
    ],
    scoring: {
      boneWeights: { L_upper: 1, L_fore: 0.6, R_upper: 1, R_fore: 0.6, shoulders: 0.3 },
      boneWeightsNote: "",
      sigmaDeg: { default: 25, calibrated: false, note: "" },
      timing: { toleranceMs: 300, calibrated: false, note: "" },
      tiers: { calibrated: false, note: "" },
    },
    validation: {},
    track: {},
  };

  test("activePoseId menunjuk segmen pose yang sedang berjalan", () => {
    expect(activePoseId(ref, 1.5, 0.3)).toBe("A");
    expect(activePoseId(ref, 2.5, 0.3)).toBeNull();
  });

  test("activePoseId menunjuk event hanya dalam toleransi", () => {
    expect(activePoseId(ref, 5.1, 0.3)).toBe("A");
    expect(activePoseId(ref, 5.5, 0.3)).toBeNull();
  });

  test("normalizeKp memusatkan bahu dan menormalkan skala", () => {
    const ukp = upperKpFromLandmarks(fakeLandmarks())!;
    const n = normalizeKp(ukp);
    // Titik tengah bahu jadi origin.
    expect((n.L_shoulder[0] + n.R_shoulder[0]) / 2).toBeCloseTo(0, 10);
    expect((n.L_shoulder[1] + n.R_shoulder[1]) / 2).toBeCloseTo(0, 10);
    // Lebar bahu ternormalisasi jadi 1.
    expect(Math.hypot(n.L_shoulder[0] - n.R_shoulder[0], n.L_shoulder[1] - n.R_shoulder[1])).toBeCloseTo(1, 10);
  });

  test("scoreFrame-null bila pose tak dikenal", () => {
    const ukp = upperKpFromLandmarks(fakeLandmarks())!;
    expect(scoreFrame(ref, ukp, "TIDAK_ADA")).toBeNull();
  });

  test("dueVerdicts hanya vonis segmen yang jatuh tempo, sekali saja", () => {
    const marks = buildLane(ref.segments);
    const frames = [{ t: 1.5, score: 80 }];
    const judged = new Set<string>();
    // Sebelum tEnd + delay → belum jatuh tempo.
    expect(dueVerdicts(ref, marks, frames, judged, 2.0, { tolSec: 0.3, delayEvent: 0.3, delayPoseEnd: 0.15 })).toHaveLength(0);
    // Setelah jatuh tempo → satu vonis.
    const v1 = dueVerdicts(ref, marks, frames, judged, 2.5, { tolSec: 0.3, delayEvent: 0.3, delayPoseEnd: 0.15 });
    expect(v1).toHaveLength(1);
    expect(v1[0].id).toBe("s1");
    expect(v1[0].score).toBe(80);
    // Vonis yang sama tidak diulang.
    expect(dueVerdicts(ref, marks, frames, judged, 3.0, { tolSec: 0.3, delayEvent: 0.3, delayPoseEnd: 0.15 })).toHaveLength(0);
  });

  test("segmen flow tidak pernah dinilai", () => {
    const marks = buildLane(ref.segments);
    expect(marks.find((m: LaneMark) => m.id === "s3")).toBeUndefined();
  });

  test("finalFromVerdicts = rata-rata, 0 bila kosong", () => {
    expect(finalFromVerdicts([])).toBe(0);
    expect(finalFromVerdicts([{ id: "a", t: 0, score: 60, tier: "KECE" }, { id: "b", t: 0, score: 80, tier: "HEBAT" }])).toBe(70);
  });
});

describe("lane", () => {
  test("hanya segmen scored yang masuk lane", () => {
    const marks = buildLane([
      { id: "s1", type: "pose", pose: "A", tStart: 1, tEnd: 2, scored: true },
      { id: "s2", type: "pose", pose: "A", tStart: 3, tEnd: 4, scored: false },
      { id: "s3", type: "flow", tStart: 5, tEnd: 6, scored: true },
    ]);
    expect(marks).toHaveLength(1);
    expect(marks[0].id).toBe("s1");
  });

  test("laneX = target + (t - now) * v", () => {
    expect(laneX(3, 1, 500, 100)).toBe(700);
    expect(laneX(1, 1, 500, 100)).toBe(500);
  });

  test("mark diurutkan berdasarkan waktu", () => {
    const marks = buildLane([
      { id: "b", type: "pose", pose: "A", tStart: 5, tEnd: 6, scored: true },
      { id: "a", type: "pose", pose: "A", tStart: 1, tEnd: 2, scored: true },
    ]);
    expect(marks.map((m: LaneMark) => m.id)).toEqual(["a", "b"]);
  });
});

describe("kompensasi jam penilaian", () => {
  test("offset -0.1 s menggeser penilaian ke belakang 100 ms", () => {
    // Landmark user menggambarkan keadaan ~100 ms lalu, jadi penilaian
    // harus membandingkan dengan posisi video yang 100 ms lebih awal.
    expect(SCORE_TIME_OFFSET_SEC).toBe(-0.1);
  });
});
