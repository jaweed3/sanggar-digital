// Layar presentasional: tanpa logika ML. Props saja.
import type { Verdict } from "@/lib/game/judge";
import { TIER_COLORS } from "@/lib/game/theme";
import { tierFor } from "@/lib/pose/scorer";

export function LoadingScreen() {
  return <p className="py-16 text-center text-[#795b43]">Memuat referensi + model...</p>;
}

export function ErrorScreen({ message, back }: { message: string; back: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[#eadcc7] bg-white p-8 text-center">
      <p className="font-bold text-[#8b1d1d]">Tidak bisa mulai</p>
      <p className="mt-2 text-sm text-[#795b43]">{message}</p>
      <button onClick={back} className="mt-6 rounded-full bg-[#8b1d1d] px-6 py-3 text-sm font-bold text-white">
        Kembali
      </button>
    </div>
  );
}

export function CameraPrompt({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[#eadcc7] bg-white p-8 text-center">
      <p className="font-serif text-2xl">Siap bergerak?</p>
      <p className="mt-2 text-sm text-[#795b43]">Kamera + model sudah siap. Video tidak keluar dari perangkat.</p>
      <button onClick={onStart} className="mt-6 rounded-full bg-[#8b1d1d] px-6 py-3.5 font-bold text-white">
        Aktifkan kamera
      </button>
    </div>
  );
}

export function ScoreCard({ live, best, done, total }: { live: number; best: number | null; done: number; total: number }) {
  const rounded = Math.round(live);
  const tier = tierFor(rounded);
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-[#eadcc7] bg-white p-5">
      <p className="text-xs font-extrabold uppercase tracking-widest text-[#c88739]">Skor</p>
      <p className="font-serif text-5xl font-bold tabular-nums" style={{ color: TIER_COLORS[tier] }}>
        {rounded}
      </p>
      <p className="mt-1 text-xs text-[#94785e]">
        Skor terbaik: {best ?? "—"} · <span className="font-bold" style={{ color: TIER_COLORS[tier] }}>{tier}</span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eadcc7]">
        <div className="h-full rounded-full bg-[#8b1d1d] transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-[#94785e]">
        Segmen {done}/{total} · f1 tidak dinilai di v1
      </p>
    </div>
  );
}

export function VerdictList({ verdicts, empty }: { verdicts: Verdict[]; empty: string }) {
  return (
    <div className="rounded-2xl bg-[#3b2314] p-5 text-[#fff8e7]">
      <p className="mb-3 text-sm font-bold">Vonis</p>
      {verdicts.length === 0 && <p className="text-xs text-white/60">{empty}</p>}
      {[...verdicts].slice(-6).reverse().map((v) => (
        <div key={v.id} className="verdict-pop mb-2 flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm">
          <span className="font-bold" style={{ color: TIER_COLORS[v.tier] }}>{v.tier}</span>
          <span className="text-xs text-white/70">
            {v.id} · {v.t.toFixed(2)}s · {Math.round(v.score)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ResultScreen({
  score, best, isNewBest, verdicts, onRetry, onBack,
}: {
  score: number; best: number | null; isNewBest: boolean; verdicts: Verdict[]; onRetry: () => void; onBack: () => void;
}) {
  const counts = { HEBAT: 0, KECE: 0, KELAZ: 0 } as Record<string, number>;
  for (const v of verdicts) counts[v.tier] = (counts[v.tier] ?? 0) + 1;
  const n = Math.max(1, verdicts.length);
  return (
    <div className="mx-auto max-w-lg rounded-[2rem] bg-[#8b1d1d] p-10 text-center text-white">
      <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#f6c543]">Latihan selesai</p>
      <p className="mt-2 font-serif text-8xl font-bold tabular-nums text-[#f6c543]">{Math.round(score)}</p>
      {isNewBest && <p className="mt-2 text-sm font-bold text-[#f6c543]">SKOR TERBAIK BARU</p>}
      <p className="mt-2 text-sm text-white/70">Skor terbaik: {best ?? "—"}</p>
      <div className="mt-4 flex gap-2">
        {(["HEBAT", "KECE", "KELAZ"] as const).map((t) => (
          <div key={t} className="flex-1 rounded-xl bg-white/10 px-2 py-2">
            <p className="text-sm font-extrabold" style={{ color: TIER_COLORS[t] }}>{counts[t]}</p>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full" style={{ width: `${(counts[t] / n) * 100}%`, background: TIER_COLORS[t] }} />
            </div>
            <p className="mt-1 text-[10px] font-bold text-white/70">{t}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-1 text-left">
        {verdicts.map((v) => (
          <div key={v.id} className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-1.5 text-sm">
            <span className="font-bold" style={{ color: TIER_COLORS[v.tier] }}>{v.tier}</span>
            <span className="text-xs text-white/70">
              {v.id} · {v.t.toFixed(2)}s · {Math.round(v.score)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={onRetry} className="rounded-full bg-[#f6c543] px-6 py-3 font-bold text-[#3b2314]">
          Ulangi
        </button>
        <button onClick={onBack} className="rounded-full border border-white/40 px-6 py-3 font-bold">
          Pilih tarian lain
        </button>
      </div>
    </div>
  );
}
