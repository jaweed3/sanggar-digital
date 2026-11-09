# Struktur proyek

## Stack

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4.
- Bun untuk instalasi, pengembangan, dan build.
- MediaPipe Tasks Vision untuk estimasi pose di perangkat; WASM dan model tersedia lokal di `public/`.

## Direktori utama

```text
src/app/                 Halaman dan komponen UI
  page.tsx               Navigasi home → detail → latihan
  components/home/       Beranda, katalog, dan detail tarian
  components/game/       Tampilan latihan, layar status, kamera/countdown
  components/TariGame.tsx Orkestrasi sesi latihan
src/lib/game/            Clock, kalibrasi, runner, penilaian hasil, penyimpanan skor
  config.ts              Semua konstanta game (URL, tempo, ambang kalibrasi, offset jam)
src/lib/pose/            PoseEngine, filter landmark, referensi, dan scorer
  keypoints.ts           Sumber tunggal indeks MediaPipe + pemetaan keypoint tubuh-atas
  types.ts               Landmark & parameter filter (khusus lapisan pose)
tests/                   Unit test (bun test) untuk modul murni
public/models/           Model pose MediaPipe
public/wasm/             Runtime WASM MediaPipe
public/references/saman/ Video dan data referensi Saman
scripts/                 Golden check TypeScript/Python dan scorer mirror
brand/                   Aset dan arahan identitas visual
diagrams/                Diagram Mermaid dan hasil PNG
docs/                    Dokumentasi dan proposal
videos/                  Rekaman/data sumber prototipe
```

## Aturan lapisan

Arah import satu arah, tanpa siklus:

```text
app/components/  →  lib/game/  →  lib/pose/
```

- `lib/pose/` tidak boleh mengimpor dari `lib/game/`.
- Konstanta **game** (URL, ambang kalibrasi, offset jam penilaian) ada di
  `lib/game/config.ts`. Konstanta **pose** (parameter filter) ada di
  `lib/pose/types.ts`.
- Indeks MediaPipe & pemetaan keypoint hanya boleh ditulis di
  `lib/pose/keypoints.ts` — jangan tulis ulang indeks secara manual.
- Modul yang bisa diuji (tanpa DOM) sebaiknya tetap murni agar bisa masuk
  `tests/`.

## Menjalankan pemeriksaan

```bash
bun run typecheck   # tsc --noEmit
bun run lint        # eslint
bun test            # unit test modul murni
bun run golden      # scorer TS ≡ Python
bun run build       # build produksi
```

`bun test` mengunci beberapa nilai penting — terutama parameter filter
One Euro dan perilaku layer siluet (anti-flicker). Jangan mengubahnya
tanpa mengukur ulang; lihat [`LATENCY.md`](./LATENCY.md).

## Alur latihan

1. Aplikasi memuat referensi tari dari `public/references/saman/`.
2. `PoseEngine` memuat MediaPipe lokal, mencoba GPU, lalu fallback ke CPU.
3. Landmark kamera difilter dan dibandingkan dengan pose referensi.
4. Sesi dikalibrasi, lalu diputar mengikuti video referensi; hasil tiap segmen diringkas menjadi skor.
5. Skor terbaik disimpan lokal di browser (`localStorage`), tanpa dikirim ke server.

Scorer berada di `src/lib/pose/scorer.ts`; `scripts/scorer_mirror.py` adalah mirror Python-nya. Jalankan `bun run golden` untuk memeriksa keduanya tetap konsisten.

## Latensi

Pipeline pose (kamera → MediaPipe → filter One Euro → kanvas → penilaian) punya beberapa tahap yang menambah keterlambatan. Pengukuran dan trade-off tiap parameter ada di [`LATENCY.md`](./LATENCY.md): group delay filter One Euro, kedipan siluet (flicker) antara frame kamera, dan kompensasi jam penilaian.

## Data dan arsitektur

Data tari mengikuti skema `tari-reference/0.1` dan saat ini mencakup pose, segmen, bobot tulang, serta parameter penilaian yang belum sepenuhnya terkalibrasi. Lihat contoh di `public/references/saman/`.

Diagram konseptual tersedia di [`diagrams/architecture.png`](../diagrams/architecture.png) dan [`diagrams/stakeholders.png`](../diagrams/stakeholders.png). Komponen backend, akun, penyimpanan terpusat, serta moderasi pada diagram adalah arah arsitektur, **belum diimplementasikan**.
