"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Pause, Play, Sparkles } from "lucide-react";

type Movement = { id: string; title: string; region: string; level: string; time: string; color: string; emoji: string };
type Landmark = { x: number; y: number; visibility?: number };

const connections: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32], [0, 11], [0, 12],
];

export default function PosePractice({ selected, back, finish }: { selected: Movement; back: () => void; finish: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<import("@mediapipe/tasks-vision").PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const lastVideoTime = useRef(-1);
  const [cameraOn, setCameraOn] = useState(false);
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("Aktifkan kamera untuk mulai latihan.");

  useEffect(() => () => { streamRef.current?.getTracks().forEach((track) => track.stop()); cancelAnimationFrame(animationRef.current); }, []);

  async function startCamera() {
    try {
      const [{ PoseLandmarker, FilesetResolver }, stream] = await Promise.all([
        import("@mediapipe/tasks-vision"),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 1280, height: 720 }, audio: false }),
      ]);
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm");
      landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task", delegate: "GPU" },
        runningMode: "VIDEO", numPoses: 1, minPoseDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraOn(true); setReady(true); setRunning(true); animationRef.current = requestAnimationFrame(renderFrame);
    } catch (error) {
      console.error(error); setFeedback("Kamera atau model belum bisa dimuat. Cek permission dan koneksi.");
    }
  }

  function renderFrame() {
    const video = videoRef.current; const canvas = canvasRef.current; const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker || video.readyState < 2) { animationRef.current = requestAnimationFrame(renderFrame); return; }
    if (video.currentTime !== lastVideoTime.current) {
      const result = landmarker.detectForVideo(video, performance.now());
      const pose = result.landmarks?.[0] as Landmark[] | undefined;
      const ctx = canvas.getContext("2d");
      if (ctx && pose) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight; ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = Math.max(3, canvas.width / 280); ctx.strokeStyle = "#f6c543"; ctx.fillStyle = "#fff8e7";
        for (const [a, b] of connections) { if (!pose[a] || !pose[b] || (pose[a].visibility ?? 1) < .45 || (pose[b].visibility ?? 1) < .45) continue; ctx.beginPath(); ctx.moveTo(pose[a].x * canvas.width, pose[a].y * canvas.height); ctx.lineTo(pose[b].x * canvas.width, pose[b].y * canvas.height); ctx.stroke(); }
        for (const point of pose) { if ((point.visibility ?? 1) < .45) continue; ctx.beginPath(); ctx.arc(point.x * canvas.width, point.y * canvas.height, Math.max(4, canvas.width / 100), 0, Math.PI * 2); ctx.fill(); }
        const visible = pose.filter((point) => (point.visibility ?? 1) >= .45).length;
        const nextScore = Math.min(99, Math.round((visible / 33) * 100)); setScore(nextScore);
        setFeedback(visible > 25 ? "Pose terdeteksi. Pertahankan posisi tubuh." : "Pastikan seluruh tubuh terlihat kamera.");
      }
      lastVideoTime.current = video.currentTime; setProgress((value) => value >= 100 ? 0 : value + .4);
    }
    animationRef.current = requestAnimationFrame(renderFrame);
  }

  return <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10"><div className="mb-5 flex items-center justify-between"><button onClick={back} className="text-sm font-bold text-[#8b1d1d]">← Keluar latihan</button><div className="text-xs font-bold text-[#795b43]">{ready ? "● MediaPipe aktif" : "○ Menunggu kamera"}</div></div><div className="grid gap-5 lg:grid-cols-[1fr_300px]"><div className="overflow-hidden rounded-[2rem] bg-[#241a16] p-3 shadow-xl"><div className="relative aspect-video overflow-hidden rounded-[1.4rem] bg-gradient-to-br from-[#5a2826] via-[#2c2931] to-[#182d31]"><video ref={videoRef} autoPlay muted playsInline className={`absolute inset-0 h-full w-full object-cover ${cameraOn ? "opacity-80" : "opacity-0"}`} /><canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-contain" />{!cameraOn && <div className="absolute inset-0 grid place-items-center text-center text-white"><Camera className="mx-auto mb-3" size={42}/><p className="font-serif text-2xl">Siap bergerak?</p><p className="mt-2 text-sm text-white/60">Aktifkan kamera untuk mulai latihan</p></div>}<div className="absolute left-5 top-5 rounded-full bg-black/30 px-3 py-1.5 text-xs font-bold text-white">POSE GUIDE · {selected.title}</div>{cameraOn && <div className="absolute right-5 top-5 rounded-full bg-[#5d963d] px-3 py-1.5 text-xs font-bold text-white">● {score}% TERDETEKSI</div>}</div><div className="px-2 pb-1 pt-4"><div className="mb-3 flex items-center justify-between text-xs font-bold text-[#e7cfb5]"><span>Gerakan 01 dari 03</span><span>{(progress / 25).toFixed(1)}s / 04.0s</span></div><div className="h-2 rounded-full bg-white/15"><div className="h-full rounded-full bg-[#f6c543] transition-all" style={{ width: `${progress}%` }}/></div><div className="mt-4 flex justify-center gap-3"><button onClick={cameraOn ? () => setRunning(!running) : startCamera} className="grid h-12 w-12 place-items-center rounded-full bg-[#f6c543] text-[#3b2314]">{cameraOn && running ? <Pause size={19} fill="currentColor"/> : cameraOn ? <Play size={19} fill="currentColor"/> : <Camera size={19}/>}</button><button onClick={finish} className="rounded-full border border-[#f6c543]/40 px-5 text-xs font-bold text-[#f6c543]">Selesai</button></div></div></div><aside className="space-y-4"><div className="rounded-[1.7rem] border border-[#eadcc7] bg-white p-5"><span className="text-xs font-extrabold uppercase tracking-[.15em] text-[#c88739]">Target berikutnya</span><div className="mt-4 flex items-center gap-4 rounded-2xl bg-[#fff5d9] p-4"><span className="text-4xl">🕺</span><div><strong className="block font-serif text-lg">Tangan membuka</strong><span className="text-xs text-[#94785e]">Dalam 0.8 detik</span></div></div></div><div className="rounded-[1.7rem] bg-[#3b2314] p-5 text-[#fff8e7]"><div className="mb-4 flex items-center gap-2 text-sm font-bold"><Sparkles size={16} className="text-[#f6c543]"/> Feedback langsung</div><p className="rounded-xl bg-white/10 p-3 text-sm leading-6">{feedback}</p><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white/10 p-3"><span className="text-[11px] text-[#d8bfa5]">Pose match</span><strong className="block text-xl text-[#f6c543]">{score}%</strong></div><div className="rounded-xl bg-white/10 p-3"><span className="text-[11px] text-[#d8bfa5]">Timing</span><strong className="block text-xl text-[#f6c543]">{Math.round(score * .9)}%</strong></div></div></div><div className="flex items-start gap-3 rounded-2xl border border-[#eadcc7] bg-[#fffdf8] p-4 text-xs leading-5 text-[#94785e]"><span>ⓘ</span> Skor ini membantu latihan, bukan penilaian mutlak atas kualitas tari.</div></aside></div></section>;
}
