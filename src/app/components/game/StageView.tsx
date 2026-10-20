// Stage: kanvas siluet + lane + video referensi. Tanpa logika skor.
import type { RefCallback } from "react";
import type { Verdict } from "@/lib/game/judge";
import { TIER_COLORS } from "@/lib/game/theme";
import { LANE_HEIGHT, VIDEO_URL } from "@/lib/game/config";

interface Props {
  userCanvas: RefCallback<HTMLCanvasElement>;
  laneCanvas: RefCallback<HTMLCanvasElement>;
  attachVideo: (el: HTMLVideoElement | null) => void;
  phase: "kalibrasi" | "hitung" | "main";
  calibHint: string;
  calibProgress: number;
  countdown: number;
  verdicts: Verdict[];
}

export function StageView({ userCanvas, laneCanvas, attachVideo, phase, calibHint, calibProgress, countdown, verdicts }: Props) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] bg-[#1d2733] p-3">
      <div className="relative overflow-hidden rounded-[1rem] bg-[#1d2733]">
        <canvas ref={userCanvas} className="block aspect-video w-full object-contain" />
        {phase === "kalibrasi" && (
          <div className="pointer-events-none absolute inset-x-4 top-4">
            <div className="inline-block rounded-full bg-black/50 px-3 py-1.5 text-xs font-bold text-white">
              {calibHint}
            </div>
            <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-[#f6c543] transition-[width] duration-150"
                style={{ width: `${Math.round(calibProgress * 100)}%` }}
              />
            </div>
          </div>
        )}
        {phase === "hitung" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span key={countdown} className="count-pop font-serif text-8xl font-bold text-white drop-shadow-[0_2px_18px_rgba(246,197,67,.5)]">
              {countdown}
            </span>
          </div>
        )}
        {phase === "main" && (
          <div className="pointer-events-none absolute right-4 top-4 flex gap-2">
            {verdicts.slice(-3).map((v) => (
              <span
                key={v.id}
                className="verdict-pop rounded-full bg-black/50 px-3 py-1 text-xs font-bold"
                style={{ color: TIER_COLORS[v.tier] }}
              >
                {v.tier} {Math.round(v.score)}
              </span>
            ))}
          </div>
        )}
      </div>
      {phase === "main" && (
        <canvas ref={laneCanvas} className="mt-2 block w-full rounded-[1rem] bg-[#24313f]" style={{ height: LANE_HEIGHT }} />
      )}
      <div className="relative mt-2">
        <video ref={attachVideo} src={VIDEO_URL} muted playsInline preload="auto" className="block aspect-video w-full rounded-[1rem] bg-black" />
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white/80">
          Referensi
        </span>
      </div>
    </div>
  );
}
