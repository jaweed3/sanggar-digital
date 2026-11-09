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

export function StageView({
  userCanvas,
  laneCanvas,
  attachVideo,
  phase,
  calibHint,
  calibProgress,
  countdown,
  verdicts,
}: Props) {
  return (
    <div className="space-y-3">
      {/* Kanvas user — tempat siluet digambar */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface p-2 sm:p-2.5">
        <div className="relative overflow-hidden rounded-xl bg-[#16222f]">
          <canvas ref={userCanvas} className="block aspect-video w-full object-contain" />

          {phase === "kalibrasi" && (
            <div className="pointer-events-none absolute inset-x-3 top-3 sm:inset-x-4 sm:top-4">
              <div className="inline-block max-w-full truncate rounded-full bg-black/55 px-3.5 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
                {calibHint}
              </div>
              <div
                className="mt-2 h-1.5 w-52 max-w-[60%] overflow-hidden rounded-full bg-white/20"
                role="progressbar"
                aria-label="Kemajuan kalibrasi"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(calibProgress * 100)}
              >
                <div
                  className="h-full rounded-full bg-gold transition-[width] duration-150"
                  style={{ width: `${Math.round(calibProgress * 100)}%` }}
                />
              </div>
            </div>
          )}

          {phase === "hitung" && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <span
                key={countdown}
                role="status"
                aria-live="assertive"
                aria-label={`Mulai dalam ${countdown}`}
                className="count-pop font-display text-7xl font-extrabold text-white drop-shadow-[0_2px_18px_rgba(217,154,43,.6)] sm:text-8xl"
              >
                {countdown}
              </span>
            </div>
          )}

          {phase === "main" && verdicts.length > 0 && (
            <div aria-live="polite" className="pointer-events-none absolute right-3 top-3 flex max-w-[45%] flex-col items-end gap-2 sm:right-4 sm:top-4">
              {verdicts.slice(-3).map((v) => (
                <span
                  key={v.id}
                  className="verdict-pop rounded-full bg-black/55 px-3 py-1 text-xs font-bold backdrop-blur-sm"
                  style={{ color: TIER_COLORS[v.tier] }}
                >
                  {v.tier} {Math.round(v.score)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lane pictogram */}
      {phase === "main" && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface p-2 sm:p-2.5">
          <canvas
            ref={laneCanvas}
            aria-label="Alur gerakan"
            className="block w-full rounded-xl bg-[#1c2b3a]"
            style={{ height: LANE_HEIGHT }}
          />
        </div>
      )}

      {/* Video referensi */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-2 sm:p-2.5">
        <video
          ref={attachVideo}
          src={VIDEO_URL}
          muted
          playsInline
          preload="auto"
          className="block aspect-video w-full rounded-xl bg-black"
        />
        <span className="pointer-events-none absolute left-5 top-5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white/85 backdrop-blur-sm">
          Referensi
        </span>
      </div>
    </div>
  );
}
