"use client";

import { ArrowRight, Clock3, Info, Target } from "lucide-react";
import type { Movement } from "./movements";
import { BrandMark } from "./SiteShell";

export function DetailScreen({
  selected,
  back,
  start,
}: {
  selected: Movement;
  back: () => void;
  start: () => void;
}) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-12 lg:px-10 lg:py-16">
      <button onClick={back} className="mb-8 text-sm font-bold text-teal hover:text-teal-dark">
        ← Kembali ke koleksi
      </button>

      <div className="grid gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
        <div
          className={`relative flex aspect-square max-h-[460px] items-center justify-center overflow-hidden rounded-[2rem] bg-gradient-to-br ${selected.color} shadow-[0_24px_60px_-24px_rgba(23,50,77,.4)]`}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />
          <span className="relative text-[8rem] leading-none text-white drop-shadow-lg">
            {selected.emoji}
          </span>
          <span className="absolute bottom-5 left-5 rounded-full bg-black/25 px-3.5 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
            {selected.region}
          </span>
        </div>

        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold-soft/40 px-3.5 py-1.5 text-xs font-bold text-indigo">
            <Info size={13} className="text-gold" />
            {selected.available ? "Referensi terkurasi" : "Segera hadir"}
          </span>

          <h1 className="heading mt-5 text-5xl sm:text-6xl">{selected.title}</h1>

          <p className="mt-5 max-w-xl text-lg leading-8 text-ink-muted">
            {selected.available ? (
              <>Kenali pola gerak dasar {selected.title} melalui referensi penari dan latihan
              bertahap. Kamera akan membantu membaca keselarasan tubuh dan timing kamu.</>
            ) : (
              <>Gerak {selected.title} sedang kami siapkan bersama penari — mulai dari pola dasar,
              atribusi, dan konteksnya. Latihan interaktifnya menyusul setelah referensi terverifikasi.</>
            )}
          </p>

          <div className="my-8 grid grid-cols-2 gap-4">
            <div className="card p-5">
              <Clock3 className="mb-3 text-teal" size={20} />
              <strong className="block font-display text-lg font-extrabold text-indigo">
                {selected.time}
              </strong>
              <span className="text-xs text-ink-muted">Durasi latihan</span>
            </div>
            <div className="card p-5">
              <Target className="mb-3 text-teal" size={20} />
              <strong className="block font-display text-lg font-extrabold text-indigo">
                {selected.level}
              </strong>
              <span className="text-xs text-ink-muted">Tingkat kesulitan</span>
            </div>
          </div>

          {selected.available ? (
            <button onClick={start} className="btn-primary hover:bg-teal-dark">
              Mulai latihan <ArrowRight size={18} />
            </button>
          ) : (
            <div>
              <button
                disabled
                aria-disabled="true"
                title="Referensi latihan masih disiapkan"
                className="btn-primary cursor-not-allowed opacity-50"
              >
                Segera hadir <ArrowRight size={18} aria-hidden />
              </button>
              <p className="mt-3 text-sm text-ink-muted">
                Sambil menunggu, coba latihan <strong className="text-indigo">Saman</strong> yang sudah siap.
              </p>
            </div>
          )}

          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center">
              <BrandMark size={28} />
            </span>
            <p className="text-sm leading-6 text-ink-muted">
              Yang kamu butuh: ruang kosong, kamera depan, dan sekitar{" "}
              <strong className="text-indigo">{selected.time}</strong>. Video diproses di perangkat.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
