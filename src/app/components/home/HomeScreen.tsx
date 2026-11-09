"use client";

import dynamic from "next/dynamic";
import { ArrowRight, Clock3, Scan, Sparkles, TrendingUp } from "lucide-react";
import { movements, type Movement } from "./movements";
import { BrandMark } from "./SiteShell";

// Three.js lazy-load (client-only): chunk ~150-200 KB, tidak ikut first paint.
const HeroBackdrop = dynamic(
  () => import("./hero-3d/HeroBackdrop").then((m) => m.HeroBackdrop),
  { ssr: false }
);

export function HomeScreen({ choose }: { choose: (m: Movement) => void }) {
  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden border-b border-line/70">
        {/* Pola ornamen tipis di latar — satu aksen motif saja (saran brand). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--indigo) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-10 lg:pb-28 lg:pt-24">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold-soft/40 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-indigo">
              <Sparkles size={13} className="text-gold" />
              Belajar gerak, jaga warisan
            </div>

            <h1 className="heading max-w-xl text-5xl sm:text-6xl lg:text-7xl">
              Gerak tradisi,
              <br />
              <span className="text-teal">hidup kembali.</span>
            </h1>

            <p className="mt-7 max-w-lg text-lg leading-8 text-ink-muted">
              Latihan tari tradisional dengan panduan kamera dan feedback yang membantu.
              Belajar dari gerak yang terverifikasi, bukan sekadar meniru video.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <a
                href="#jelajahi"
                className="btn-primary hover:bg-teal-dark"
              >
                Mulai latihan <ArrowRight size={18} />
              </a>
              <a
                href="#cara-kerja"
                className="btn-ghost hover:bg-indigo hover:text-white hover:border-indigo"
              >
                Lihat cara kerja
              </a>
            </div>

            <dl className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-line pt-7">
              {[
                { n: "01", l: "Pilih gerak" },
                { n: "02", l: "Ikuti panduan" },
                { n: "03", l: "Dapat feedback" },
              ].map((s) => (
                <div key={s.n}>
                  <dt className="font-display text-2xl font-extrabold text-teal">{s.n}</dt>
                  <dd className="mt-1 text-sm font-semibold text-ink-muted">{s.l}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Mockup perangkat — 3D ambient di atas gradien indigo,
              fallback = cincin statis bila WebGL mati / reduced-motion. */}
          <div className="relative mx-auto w-full max-w-[520px]">
            <div className="relative overflow-hidden rounded-[2rem] border border-line bg-surface shadow-[0_24px_60px_-24px_rgba(23,50,77,.35)]">
              <div className="relative flex aspect-[.92] flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo via-indigo-soft to-teal p-7 text-white">
                <HeroBackdrop className="absolute inset-0" />
                <div className="relative flex items-center justify-between text-[11px] font-bold uppercase tracking-[.18em] text-white/70">
                  <span>Sanggar Digital</span>
                  <span>01 / 03</span>
                </div>

                <div className="relative flex flex-1 items-center justify-center">
                  <div className="absolute h-64 w-64 rounded-full border border-white/15" />
                  <div className="absolute h-48 w-48 rounded-full border border-white/15" />
                  <div className="absolute h-32 w-32 rounded-full border border-gold/40" />
                  <div className="relative text-center">
                    <div className="mx-auto mb-4 grid h-28 w-28 place-items-center rounded-full bg-white/10 backdrop-blur-sm">
                      <BrandMark size={72} variant="dark" className="drop-shadow-lg" />
                    </div>
                    <span className="inline-block rounded-full bg-white/15 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[.14em] backdrop-blur">
                      Pose Guide
                    </span>
                  </div>
                </div>

                <div>
                  <div className="relative mb-3 flex items-end justify-between">
                    <span className="font-display text-2xl font-extrabold">Tari Pendet</span>
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Bali</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full w-2/3 rounded-full bg-gold" />
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-5 -left-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-lg sm:-left-8">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal/10 text-teal">
                <TrendingUp size={19} />
              </span>
              <div>
                <strong className="block text-sm text-indigo">Gerak tepat!</strong>
                <span className="text-xs text-ink-muted">Skor pose 86%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Cara kerja ---------- */}
      <section id="cara-kerja" className="border-b border-line/70 bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <div className="max-w-2xl">
            <p className="eyebrow">Cara kerja</p>
            <h2 className="heading mt-3 text-4xl">Tiga langkah, tanpa alat khusus</h2>
            <p className="mt-4 text-lg leading-8 text-ink-muted">
              Kamu tidak perlu paham detail teknis apa pun. Kamera membaca gerak tubuhmu, lalu
              membandingkannya dengan gerak penari acuan.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Scan,
                n: "01",
                t: "Kamera membaca posemu",
                d: "Model pose di perangkat membaca titik sendi tubuh secara langsung. Video tidak pernah dikirim ke server.",
              },
              {
                icon: Sparkles,
                n: "02",
                t: "Gerak dibandingkan",
                d: "Tiap pose dinilai dengan sudut tulang yang sama, berbobot, memakai ambang toleransi yang terukur.",
              },
              {
                icon: TrendingUp,
                n: "03",
                t: "Skor &vonis per segmen",
                d: "Hasil per segmen muncul saat waktunya tiba, jadi kamu tahu bagian mana yang perlu diulang.",
              },
            ].map((c) => (
              <div key={c.n} className="card p-7">
                <span className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-teal/10 text-teal">
                  <c.icon size={22} />
                </span>
                <span className="font-display text-sm font-extrabold text-gold">{c.n}</span>
                <h3 className="mt-2 font-display text-xl font-extrabold text-indigo">{c.t}</h3>
                <p className="mt-3 leading-7 text-ink-muted">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Koleksi ---------- */}
      <section id="jelajahi" className="border-b border-line/70">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Koleksi gerak</p>
              <h2 className="heading mt-3 text-4xl">Mulai dari sini</h2>
            </div>
            <span className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold text-ink-muted">
              {movements.length} referensi terkurasi
            </span>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {movements.map((m) => (
              <button
                key={m.id}
                onClick={() => choose(m)}
                aria-label={m.available ? `Pelajari gerak ${m.title}` : `${m.title} — segera hadir`}
                className="group overflow-hidden rounded-3xl border border-line bg-surface text-left hover:-translate-y-1 hover:border-teal/40 hover:shadow-[0_20px_40px_-20px_rgba(23,50,77,.35)]"
              >
                <div className={`relative flex h-52 items-center justify-center bg-gradient-to-br ${m.color}`}>
                  <span aria-hidden className="text-7xl text-white/90 transition-transform duration-300 group-hover:scale-110">
                    {m.emoji}
                  </span>
                  <div className="absolute left-4 top-4 flex gap-2">
                    <span className="rounded-full bg-black/25 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                      {m.level}
                    </span>
                    {!m.available && (
                      <span className="rounded-full bg-gold px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-indigo backdrop-blur-sm">
                        Segera hadir
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-6">
                  <div className="mb-3 flex items-center justify-between text-xs text-ink-muted">
                    <span className="font-semibold uppercase tracking-[.12em] text-terracotta">
                      {m.region}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock3 size={13} /> {m.time}
                    </span>
                  </div>
                  <h3 className="font-display text-2xl font-extrabold text-indigo">{m.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">
                    {m.available
                      ? "Referensi penari terkurasi, latihan bertahap dengan feedback per segmen."
                      : "Sedang disiapkan bersama penari — intip dulu pola geraknya, latihan menyusul."}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-teal">
                    {m.available ? "Pelajari gerak" : "Lihat detail"}
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Tentang ---------- */}
      <section id="tentang" className="bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <div className="grid gap-10 rounded-[2rem] bg-indigo p-10 text-white md:grid-cols-3 md:p-14">
            <div className="md:col-span-2">
              <p className="eyebrow">Bukan pengganti sanggar</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-4xl">
                Teknologi sebagai teman latihan, budaya tetap punya pemilik.
              </h2>
            </div>
            <div className="space-y-4 text-sm leading-7 text-white/75">
              <p>
                Setiap referensi memiliki atribusi dan konteks. Skor adalah indikator belajar —
                bukan hakim atas benar-salahnya sebuah tradisi.
              </p>
              <p>
                Video dan gambar tubuh diproses di perangkat. Yang tersimpan di peramban hanya
                skor terbaikmu.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
