// Layar presentasional: tanpa logika ML. Props saja.
import { Camera, ChevronRight, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { tierFor, type Verdict } from "@/lib/game/judge";
import { TIER_COLORS, TIER_COLORS_INK } from "@/lib/game/theme";
import { BrandMark } from "../home/SiteShell";

export function LoadingScreen() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="float-soft mb-6 grid h-20 w-20 place-items-center">
        <BrandMark size={52} />
      </span>
      <p className="font-display text-xl font-extrabold text-indigo">Memuat referensi + model…</p>
      <p className="mt-2 text-sm text-ink-muted">
        Model pose diunduh sekali, lalu berjalan penuh di perangkat.
      </p>
      <div className="mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-line">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-teal" />
      </div>
    </div>
  );
}

export function ErrorScreen({ message, back }: { message: string; back: () => void }) {
  return (
    <div className="mx-auto my-10 max-w-md rounded-3xl border border-line bg-surface p-8 text-center">
      <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-terracotta/10 text-terracotta">
        <TriangleAlert size={26} />
      </span>
      <p className="font-display text-xl font-extrabold text-indigo">Tidak bisa mulai</p>
      <p className="mt-2 text-sm leading-6 text-ink-muted">{message}</p>
      <button onClick={back} className="btn-primary mt-7 w-full justify-center">
        Kembali
      </button>
    </div>
  );
}

export function CameraPrompt({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto my-6 w-full max-w-lg px-1">
      <div className="rounded-3xl border border-line bg-surface p-6 text-center sm:p-9">
        <span className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-teal/10 text-teal">
          <Camera size={28} />
        </span>
        <h2 className="font-display text-2xl font-extrabold text-indigo sm:text-3xl">Siap bergerak?</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-ink-muted">
          Kamera dan model sudah siap. Video tidak keluar dari perangkat — semua diproses
          langsung di browser kamu.
        </p>
        <button onClick={onStart} className="btn-primary mt-8 w-full justify-center text-base">
          Aktifkan kamera <ChevronRight size={18} aria-hidden />
        </button>
      </div>

      <ul className="mt-6 grid gap-3 text-sm text-ink-muted">
        {[
          "Pastikan bahu, siku, dan pergelangan terlihat kamera.",
          "Berdiri dengan ruang kosong di sekitarmu.",
          "Mulai dari posisi netral, lalu biarkan aplikasi memandu.",
        ].map((t) => (
          <li key={t} className="flex items-start gap-2.5">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-teal" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScoreCard({
  live,
  best,
  done,
  total,
}: {
  live: number;
  best: number | null;
  done: number;
  total: number;
}) {
  const rounded = Math.round(live);
  const tier = tierFor(rounded);
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-gold">Skor</p>
      <p
        className="mt-1 font-display text-6xl font-extrabold tabular-nums"
        style={{ color: TIER_COLORS_INK[tier] }}
      >
        {rounded}
      </p>
      <p className="mt-1 text-sm text-ink-muted">
        Skor terbaik: <strong className="text-indigo">{best ?? "—"}</strong> ·{" "}
        <strong style={{ color: TIER_COLORS_INK[tier] }}>{tier}</strong>
      </p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-teal transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Segmen {done}/{total}{total > 0 ? " · f1 tidak dinilai di v1" : ""}
      </p>
    </div>
  );
}

export function VerdictList({ verdicts, empty }: { verdicts: Verdict[]; empty: string }) {
  return (
    <div className="flex-1 rounded-2xl bg-indigo p-5 text-white">
      <p className="mb-3 text-sm font-extrabold uppercase tracking-[.14em] text-gold-soft">Vonis</p>
      {verdicts.length === 0 && <p className="text-sm text-white/60">{empty}</p>}
      {[...verdicts].slice(-6).reverse().map((v) => (
        <div
          key={v.id}
          className="verdict-pop mb-2 flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm"
        >
          <span className="font-bold" style={{ color: TIER_COLORS[v.tier] }}>
            {v.tier}
          </span>
          <span className="text-xs text-white/70">
            {v.id} · {v.t.toFixed(2)}s · {Math.round(v.score)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ResultScreen({
  score,
  best,
  isNewBest,
  verdicts,
  onRetry,
  onBack,
}: {
  score: number;
  best: number | null;
  isNewBest: boolean;
  verdicts: Verdict[];
  onRetry: () => void;
  onBack: () => void;
}) {
  const counts = { HEBAT: 0, KECE: 0, KELAZ: 0 } as Record<string, number>;
  for (const v of verdicts) counts[v.tier] = (counts[v.tier] ?? 0) + 1;
  const n = Math.max(1, verdicts.length);
  const tier = tierFor(Math.round(score));
  return (
    <div className="mx-auto my-8 w-full max-w-lg rounded-[2rem] border border-line bg-surface p-6 text-center sm:p-10">
      <span className="mx-auto mb-5 grid h-16 w-16 place-items-center">
        <BrandMark size={44} />
      </span>
      <p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-teal">Latihan selesai</p>
      <p className="mt-2 font-display text-7xl font-extrabold tabular-nums text-indigo sm:text-8xl">
        {Math.round(score)}
      </p>
      <p className="mt-1 text-sm font-bold" style={{ color: TIER_COLORS_INK[tier] }}>
        {tier}
      </p>
      {isNewBest && (
        <p className="mt-3 inline-block rounded-full bg-gold-soft/50 px-4 py-1.5 text-sm font-extrabold text-indigo">
          Skor terbaik baru
        </p>
      )}
      <p className="mt-3 text-sm text-ink-muted">Skor terbaik: {best ?? "—"}</p>

      <div className="mt-7 grid grid-cols-3 gap-3">
        {(["HEBAT", "KECE", "KELAZ"] as const).map((t) => (
          <div key={t} className="rounded-xl bg-ivory p-3">
            <p className="font-display text-2xl font-extrabold" style={{ color: TIER_COLORS_INK[t] }}>
              {counts[t]}
            </p>
            <p className="mt-0.5 text-[10px] font-extrabold tracking-wider text-ink-muted">{t}</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full"
                style={{ width: `${(counts[t] / n) * 100}%`, background: TIER_COLORS_INK[t] }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 max-h-56 space-y-1 overflow-y-auto text-left">
        {verdicts.map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between rounded-xl bg-ivory px-3 py-1.5 text-sm"
          >
            <span className="font-bold" style={{ color: TIER_COLORS_INK[v.tier] }}>
              {v.tier}
            </span>
            <span className="text-xs text-ink-muted">
              {v.id} · {v.t.toFixed(2)}s · {Math.round(v.score)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <button onClick={onRetry} className="btn-primary justify-center">
          <RefreshCw size={16} aria-hidden /> Ulangi
        </button>
        <button onClick={onBack} className="btn-ghost justify-center hover:bg-indigo hover:text-white hover:border-indigo">
          Pilih tarian lain
        </button>
      </div>
    </div>
  );
}
