// Golden test: Scorer TS vs mirror Python harus identik (tol 1e-9).
// Jalankan: bun run golden  (atau: bun run scripts/golden-check.ts)
// Keluar non-zero bila ada selisih — itu berarti validasi Python
// tidak lagi berlaku untuk app yang dinilai juri.

import { scorePose, type BoneMap } from "../src/lib/pose/scorer";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface Case {
  name: string;
  userBones: BoneMap;
  refBones: BoneMap;
  weights: Record<string, number>;
  sigmaDeg: number;
}

const REF_A: BoneMap = {
  L_upper: [0.185, 0.983],
  L_fore: [-0.175, 0.985],
  R_upper: [0.114, 0.994],
  R_fore: [0.679, -0.734],
  shoulders: [-0.999, 0.036],
};
const REF_B: BoneMap = {
  L_upper: [-0.311, 0.95],
  L_fore: [-0.71, -0.705],
  R_upper: [-0.183, 0.983],
  R_fore: [0.163, 0.987],
  shoulders: [-0.996, -0.088],
};
const WEIGHTS = { L_upper: 1.0, L_fore: 0.6, R_upper: 1.0, R_fore: 0.6, shoulders: 0.3 };

function rot(v: [number, number], deg: number): [number, number] {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
}

const cases: Case[] = [
  { name: "identik-A", userBones: REF_A, refBones: REF_A, weights: WEIGHTS, sigmaDeg: 25 },
  { name: "A-vs-B", userBones: REF_A, refBones: REF_B, weights: WEIGHTS, sigmaDeg: 25 },
  {
    name: "A-rot10",
    userBones: { ...REF_A, L_upper: rot(REF_A.L_upper, 10), R_fore: rot(REF_A.R_fore, -10) },
    refBones: REF_A,
    weights: WEIGHTS,
    sigmaDeg: 25,
  },
  {
    name: "A-rot45-sigma15",
    userBones: { ...REF_A, L_fore: rot(REF_A.L_fore, 45) },
    refBones: REF_A,
    weights: WEIGHTS,
    sigmaDeg: 15,
  },
];

const tsResults = cases.map((c) => scorePose(c.userBones, c.refBones, c.weights, c.sigmaDeg));

const tmp = join(tmpdir(), `golden-cases-${Date.now()}.json`);
writeFileSync(tmp, JSON.stringify(cases));

const proc = Bun.spawnSync(["python3", "scripts/scorer_mirror.py", tmp], { cwd: process.cwd() });
const stderr = proc.stderr.toString();
if (proc.exitCode !== 0) {
  console.error("scorer_mirror.py gagal:\n" + stderr);
  process.exit(1);
}
const pyResults = JSON.parse(proc.stdout.toString()) as Array<{
  score: number;
  perBone: Record<string, { errDeg: number; boneScore: number }>;
}>;

let fail = 0;
for (let i = 0; i < cases.length; i++) {
  const dScore = Math.abs(tsResults[i].score - pyResults[i].score);
  let dBone = 0;
  for (const k of Object.keys(tsResults[i].perBone)) {
    dBone = Math.max(
      dBone,
      Math.abs(tsResults[i].perBone[k].errDeg - pyResults[i].perBone[k].errDeg),
      Math.abs(tsResults[i].perBone[k].boneScore - pyResults[i].perBone[k].boneScore),
    );
  }
  const ok = dScore < 1e-9 && dBone < 1e-9;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${cases[i].name}: ts=${tsResults[i].score.toFixed(6)} py=${pyResults[i].score.toFixed(6)} dScore=${dScore.toExponential(1)} dBone=${dBone.toExponential(1)}`,
  );
  if (!ok) fail++;
}
try {
  const { unlinkSync } = await import("node:fs");
  unlinkSync(tmp);
} catch { /* abaikan */ }
if (fail > 0) {
  console.error(`\n${fail} kasus DIVERGEN — sinkronkan scorer.ts dengan scorer_mirror.py`);
  process.exit(1);
}
console.log("\nGolden OK: TS ≡ Python pada semua kasus.");
void readFileSync;
