// Tipe kontrak data tari-reference/0.1 (lihat public/references/saman/*.json).
// Catatan prototipe: clock.type masih "video" (audio: null, bpm: null).
// GameClock sudah siap ganti ke audio begitu rekaman final + beat grid ada.

export type Vec2 = [number, number];

export interface ReferencePose {
  id: string;
  keypoints: Record<string, Vec2>;
  bones: Record<string, Vec2>;
  scaleRatio: number;
  medianMinVisibility: number;
}

export interface SegmentPose {
  id: string;
  type: "pose";
  pose: string;
  tStart: number;
  tEnd: number;
  scored: boolean;
}

export interface SegmentEvent {
  id: string;
  type: "swap" | "bow";
  from: string;
  to: string;
  tOnset: number;
  scored: boolean;
}

export interface SegmentFlow {
  id: string;
  type: "flow";
  tStart: number;
  tEnd: number;
  scored: boolean;
}

export type Segment = SegmentPose | SegmentEvent | SegmentFlow;

export interface TariReference {
  schema: string;
  id: string;
  title: string;
  source: { file: string; durationSec: number; note: string };
  clock: { type: "video" | "audio"; audio: string | null; bpm: number | null; note: string };
  extraction: {
    model: string;
    filter: string;
    frameRate: string;
    normalization: { origin: string; scalePx: number; scaleDef: string; axes: string; sides: string };
    excludedLandmarks: string;
  };
  poses: ReferencePose[];
  segments: Segment[];
  scoring: {
    boneWeights: Record<string, number>;
    boneWeightsNote: string;
    sigmaDeg: { default: number; calibrated: boolean; note: string };
    timing: { toleranceMs: number; calibrated: boolean; note: string };
    tiers: { calibrated: boolean; note: string };
  };
  validation: Record<string, unknown>;
  track: Record<string, number[] | number[][] | number>;
}

export function isPoseSegment(s: Segment): s is SegmentPose {
  return s.type === "pose";
}

export function isEventSegment(s: Segment): s is SegmentEvent {
  return s.type === "swap" || s.type === "bow";
}

/** Waktu penilaian segmen: pose dinilai sepanjang [tStart,tEnd], event di tOnset±tol. */
export function scoreWindow(seg: Segment, tolSec: number): [number, number] {
  if (isPoseSegment(seg)) return [seg.tStart, seg.tEnd];
  if (isEventSegment(seg)) return [seg.tOnset - tolSec, seg.tOnset + tolSec];
  return [0, 0];
}

export async function loadReference(url: string): Promise<TariReference> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal memuat referensi: ${res.status}`);
  const data = (await res.json()) as TariReference;
  if (data.schema !== "tari-reference/0.1") throw new Error(`Skema tak dikenal: ${data.schema}`);
  return data;
}

export function getPose(ref: TariReference, id: string): ReferencePose {
  const p = ref.poses.find((q) => q.id === id);
  if (!p) throw new Error(`Pose ${id} tidak ada di referensi`);
  return p;
}
