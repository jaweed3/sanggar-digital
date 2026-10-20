// Lane pictogram: x_i = x_target + (t_i - now) * v.
// Pose dinilai sepanjang [tStart,tEnd]; event (swap/bow) di tOnset±tol.
// Pictogram di-spawn saat x_i masuk layar; tier muncul ~0.3 dtk setelah beat.

import type { Segment } from "../pose/reference";
import { isEventSegment, isPoseSegment } from "../pose/reference";

export interface LaneMark {
  id: string;
  t: number;
  poseId: string | null;
  kind: "pose" | "event";
}

/** Waktu target tiap segmen scored (flow diskip — f1 tidak dinilai di v1). */
export function buildLane(segments: Segment[]): LaneMark[] {
  const out: LaneMark[] = [];
  for (const s of segments) {
    if (!s.scored) continue;
    if (isPoseSegment(s)) out.push({ id: s.id, t: s.tStart, poseId: s.pose, kind: "pose" });
    else if (isEventSegment(s)) out.push({ id: `${s.id}:${s.to}`, t: s.tOnset, poseId: s.to, kind: "event" });
  }
  return out.sort((a, b) => a.t - b.t);
}

export function laneX(t: number, now: number, xTarget: number, vPxPerSec: number): number {
  return xTarget + (t - now) * vPxPerSec;
}
