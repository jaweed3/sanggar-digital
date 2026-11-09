// Pemeriksa kontrak: JSON hasil detektor dijalankan lewat kode app yang ASLI
// (reference.ts, lane.ts, judge.ts, scorer.ts) — bukan mirror Python.
//
//   bun run check_contract.ts <referensi.json> [...]
//
// Lolos bila: skema dikenali, semua pose yang dirujuk ada, lane terbentuk,
// dan track pose-nya sendiri dinilai >= 85 oleh scorer app di setiap segmen pose.
// (Pose yang muncul berulang adalah median beberapa pengulangan, jadi skor diri sendiri
// per segmen bisa turun ke 90-an; itu variasi penari, tercatat di validation.repeatConsistencyDeg.)
import { readFileSync } from "node:fs";
import { getPose, isEventSegment, isPoseSegment, type TariReference } from "../../src/lib/pose/reference";
import { buildLane } from "../../src/lib/game/lane";
import { activePoseId, scoreFrame } from "../../src/lib/game/judge";
import { UPPER_KP_NAMES, type UpperKp } from "../../src/lib/pose/keypoints";

let failed = 0;
const fail = (m: string) => { failed++; console.log(`  GAGAL  ${m}`); };

for (const path of process.argv.slice(2)) {
  console.log(`\n${path}`);
  const ref = JSON.parse(readFileSync(path, "utf8")) as TariReference;
  if (ref.schema !== "tari-reference/0.1") { fail(`skema ${ref.schema}`); continue; }

  const ids = new Set<string>();
  for (const s of ref.segments) {
    if (ids.has(s.id)) fail(`id segmen ganda ${s.id}`);
    ids.add(s.id);
    if (isPoseSegment(s)) { try { getPose(ref, s.pose); } catch { fail(`pose ${s.pose} tidak ada`); } }
    if (isEventSegment(s)) for (const p of [s.from, s.to]) { try { getPose(ref, p); } catch { fail(`pose ${p} tidak ada`); } }
  }
  const lane = buildLane(ref.segments);
  console.log(`  ${ref.poses.length} pose, ${ref.segments.length} segmen, ${lane.length} tanda lane`);
  if (ref.poses.length > 0 && lane.length === 0) fail("lane kosong");

  const tr = ref.track as unknown as Record<string, number[][]> & { t: number[] };
  const tol = ref.scoring.timing.toleranceMs / 1000;
  for (const s of ref.segments) {
    if (isPoseSegment(s)) {
      const mid = (s.tStart + s.tEnd) / 2;
      // Jendela event (tOnset ± tol) sengaja diprioritaskan app; lewati bila titik tengah jatuh di sana.
      const inEventWindow = ref.segments.some((e) => isEventSegment(e) && Math.abs(mid - e.tOnset) <= tol);
      if (!inEventWindow && activePoseId(ref, mid, tol) !== s.pose) fail(`${s.id}: activePoseId di ${mid.toFixed(2)} != ${s.pose}`);
      const scores: number[] = [];
      tr.t.forEach((t, i) => {
        if (t < s.tStart + 0.2 || t > s.tEnd - 0.2) return;
        const ukp: UpperKp = {};
        for (const n of UPPER_KP_NAMES) ukp[n] = tr[n][i] as [number, number];
        const sc = scoreFrame(ref, ukp, s.pose);
        if (sc !== null) scores.push(sc);
      });
      const mean = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
      const ok = scores.length > 0 && mean >= 85;
      const repeated = ref.segments.filter((x) => isPoseSegment(x) && x.pose === s.pose).length > 1;
      console.log(`  ${ok ? "ok    " : "GAGAL "} ${s.id} pose ${s.pose} ${s.tStart.toFixed(2)}-${s.tEnd.toFixed(2)}  skor diri sendiri ${mean.toFixed(1)}${repeated && mean < 97 ? "  (pose berulang: variasi antar pengulangan)" : ""}`);
      if (!ok) failed++;
    } else if (isEventSegment(s)) {
      const got = activePoseId(ref, s.tOnset, tol);
      if (got !== s.to) fail(`${s.id}: activePoseId di tOnset = ${got}, harusnya ${s.to}`);
    }
  }
}
console.log(failed ? `\n${failed} pemeriksaan GAGAL` : "\nsemua pemeriksaan lolos");
process.exit(failed ? 1 : 0);
