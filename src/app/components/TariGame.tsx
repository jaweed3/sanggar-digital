"use client";

// Orkestrator tipis: fase + lifecycle. Logika frame di lib/game/runner,
// penilaian di lib/game/judge, tampilan di components/game/*.
import { useCallback, useEffect, useRef, useState } from "react";
import { useCamera, useCountdown } from "./game/hooks";
import { StageView } from "./game/StageView";
import { CameraPrompt, ErrorScreen, LoadingScreen, ResultScreen, ScoreCard, VerdictList } from "./game/screens";
import { REF_URL, UI_THROTTLE_CALIB_MS, UI_THROTTLE_SCORE_MS } from "@/lib/game/config";
import { createRunner, drawUserFrame, stepCalibration, stepMain, type Runner } from "@/lib/game/runner";
import { finalFromVerdicts, type Verdict } from "@/lib/game/judge";
import { getBest, saveBest } from "@/lib/game/store";
import { prerenderSprites } from "@/lib/game/timeline";
import { VideoClock } from "@/lib/game/clock";
import { PoseEngine } from "@/lib/pose/PoseEngine";
import { loadReference } from "@/lib/pose/reference";

type Phase = "loading" | "kamera" | "kalibrasi" | "hitung" | "main" | "hasil" | "error";

export default function TariGame({ back }: { back: () => void }) {
  const { attachCam, startCamera } = useCamera();
  const engineRef = useRef<PoseEngine | null>(null);
  const runnerRef = useRef<Runner | null>(null);
  const clockRef = useRef(new VideoClock(null));
  const videoEl = useRef<HTMLVideoElement | null>(null);
  const userCanvasEl = useRef<HTMLCanvasElement | null>(null);
  const laneCanvasEl = useRef<HTMLCanvasElement | null>(null);
  const camVideoEl = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef(0);
  const lastUiRef = useRef(0);
  const verdictsRef = useRef<Verdict[]>([]);

  const [phase, setPhase] = useState<Phase>("loading");
  const [err, setErr] = useState("");
  const [calibProgress, setCalibProgress] = useState(0);
  const [calibHint, setCalibHint] = useState("Masuk ke kotak panduan");
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [markCount, setMarkCount] = useState(0);
  const [liveScore, setLiveScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  const phaseRef = useRef<Phase>("loading");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const finish = useCallback(() => {
    const total = finalFromVerdicts(verdictsRef.current);
    setFinalScore(total);
    const refId = runnerRef.current?.ref.id;
    if (refId) {
      const { best: nb, isNew } = saveBest(refId, total);
      setBest(nb);
      setIsNewBest(isNew);
    }
    cancelAnimationFrame(rafRef.current);
    videoEl.current?.pause();
    setPhase("hasil");
  }, []);

  const startMain = useCallback(() => {
    const v = videoEl.current;
    const r = runnerRef.current;
    if (!v || !r) {
      setErr("Video referensi belum siap.");
      setPhase("error");
      return;
    }
    r.frames = [];
    r.judged = new Set();
    verdictsRef.current = [];
    setVerdicts([]);
    setLiveScore(0);
    setFinalScore(0);
    setIsNewBest(false);
    setPhase("main");
    try {
      v.currentTime = 0;
    } catch { /* abaikan */ }
    void v.play().catch(() => {
      setErr("Video referensi gagal diputar.");
      setPhase("error");
    });
  }, []);

  const { countdown, startCountdown } = useCountdown(startMain);

  // Muat referensi + engine sekali.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await loadReference(REF_URL);
        if (cancelled) return;
        setBest(getBest(r.id));
        const sprites = prerenderSprites(r.poses);
        const eng = new PoseEngine();
        await eng.init();
        if (cancelled) {
          eng.close();
          return;
        }
        engineRef.current = eng;
        const runner = createRunner(eng, r, clockRef.current, sprites);
        runnerRef.current = runner;
        setMarkCount(runner.marks.length);
        setPhase("kamera");
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : String(e));
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      engineRef.current?.close();
      engineRef.current = null;
      runnerRef.current = null;
    };
  }, []);

  // Loop rAF selama kalibrasi/hitung/main.
  useEffect(() => {
    if (phase !== "kalibrasi" && phase !== "hitung" && phase !== "main") return;
    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      const runner = runnerRef.current;
      const uCan = userCanvasEl.current;
      if (!runner || !uCan) return;
      const camEl = camVideoEl.current;
      if (!camEl || camEl.readyState < 2 || camEl.videoWidth === 0) return;

      const lm = drawUserFrame(runner, camEl, uCan, phaseRef.current === "kalibrasi");
      const W = uCan.width;
      const H = uCan.height;
      const ph = phaseRef.current;
      const t = performance.now();
      const uiOk = (ms: number) => t - lastUiRef.current > ms;

      if (ph === "kalibrasi" && lm) {
        const ev = stepCalibration(runner, lm, W, H);
        if ((ev.calibProgress != null && uiOk(UI_THROTTLE_CALIB_MS)) || ev.calibDone) {
          lastUiRef.current = t;
          if (ev.calibProgress != null) setCalibProgress(ev.calibProgress);
          if (ev.calibHint) setCalibHint(ev.calibHint);
        }
        if (ev.calibDone) {
          setPhase("hitung");
          startCountdown();
        }
        return;
      }

      if (ph !== "main" || !laneCanvasEl.current) return;
      const ev = stepMain(runner, lm, laneCanvasEl.current);
      if (ev.liveScore != null && uiOk(UI_THROTTLE_SCORE_MS)) {
        lastUiRef.current = t;
        setLiveScore(ev.liveScore);
      }
      if (ev.newVerdicts) {
        verdictsRef.current = [...verdictsRef.current, ...ev.newVerdicts];
        setVerdicts(verdictsRef.current);
      }
      const v = videoEl.current;
      if (v && v.duration > 0) {
        const now = clockRef.current.now();
        if (now >= v.duration - 0.2 || v.ended) finish();
      }
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, finish, startCountdown]);

  async function onStartCamera() {
    const { ok, error } = await startCamera();
    if (!ok) {
      setErr(error);
      setPhase("error");
      return;
    }
    runnerRef.current?.hold.reset();
    setCalibProgress(0);
    setCalibHint("Masuk ke kotak panduan");
    setPhase("kalibrasi");
  }

  function retry() {
    runnerRef.current?.hold.reset();
    startMain();
  }

  const inGame = phase === "kalibrasi" || phase === "hitung" || phase === "main";

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={back} className="text-sm font-bold text-[#8b1d1d]">← Keluar</button>
        <div className="text-xs font-bold text-[#795b43]">SAMAN · prototipe</div>
      </div>

      <video id="tari-cam" ref={(el) => { attachCam(el); camVideoEl.current = el; }} autoPlay muted playsInline className="hidden" />

      {phase === "loading" && <LoadingScreen />}
      {phase === "error" && <ErrorScreen message={err} back={back} />}
      {phase === "kamera" && <CameraPrompt onStart={onStartCamera} />}

      {inGame && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <StageView
            userCanvas={(el: HTMLCanvasElement | null) => { userCanvasEl.current = el; }}
            laneCanvas={(el: HTMLCanvasElement | null) => { laneCanvasEl.current = el; }}
            attachVideo={(el) => { videoEl.current = el; clockRef.current.attach(el); }}
            phase={phase}
            calibHint={calibHint}
            calibProgress={phase === "kalibrasi" ? calibProgress : 0}
            countdown={countdown}
            verdicts={verdicts}
          />
          <aside className="space-y-3">
            <ScoreCard live={liveScore} best={best} done={verdicts.length} total={markCount} />
            <VerdictList verdicts={verdicts} empty="Ikuti pictogram sampai garis kuning…" />
          </aside>
        </div>
      )}

      {phase === "hasil" && (
        <ResultScreen score={finalScore} best={best} isNewBest={isNewBest} verdicts={verdicts} onRetry={retry} onBack={back} />
      )}
    </section>
  );
}
