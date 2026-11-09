# Latensi pipeline pose

Dokumen ini merangkum pengukuran latensi pada pipeline
kamera → MediaPipe → filter One Euro → kanvas → penilaian, beserta
perubahan yang sudah diterapkan. Semua angka diukur, bukan estimasi.

Tanggal pengukuran: 2026-10-21.

## Ringkasan

Gejala yang dilaporkan: *"model tracking geraknya kurang real time"*.
Penyebabnya bukan satu, tapi tiga hal yang saling menumpuk:

| Penyebab | Kontribusi | Status |
|---|---|---|
| Filter One Euro terlalu agresif (`mincutoff=1.0`) | group delay **138 ms** | Diperbaiki → `mincutoff=2.0` (71 ms) |
| Siluet berkedip (flicker) antar frame | **~52%** tick kanvas kosong | Diperbaiki → layer siluet persisten (3.3%) |
| Penilaian memakai jam yang terlalu maju | landmark tertinggal **~100 ms** vs video referensi | Diperbaiki → `SCORE_TIME_OFFSET_SEC = -0.1` |

## Metodologi

Data diambil dari landmark **nyata**, bukan simulasi:

1. Video penari `public/references/saman/short-1.mp4` (416×620, 60 fps) dipakai
   sebagai sumber pose.
2. `PoseLandmarker` (model `pose_landmarker_lite.task`, delegate GPU,
   `runningMode: "VIDEO"`) mendeteksi landmark langsung dari video →
   **524 frame landmark mentah** dibuang ke disk.
3. Analisis dilakukan offline dengan reimplementasi Python dari filter One Euro
   yang identik dengan `src/lib/pose/oneEuro.ts`, dan rumus skor yang identik
   dengan `src/lib/pose/scorer.ts`.

Pengukuran di browser (biaya deteksi, laju rAF, flicker) memakai halaman
ukur sementara yang memanggil **fungsi produksi apa adanya**
(`PoseEngine`, `createRunner`, `drawUserFrame`) — bukan replika.

## 1. Group delay filter One Euro

Group delay = keterlambatan output filter terhadap sinyal masukan.
Dihitung dengan cross-correlation terhadap proxy gerak lambat (moving
average 7 frame) dari seri landmark yang sama.

| mincutoff | beta | group delay | jitter statis (d2-std, px @1280) |
|---|---|---|---|
| — (tanpa filter) | — | 0 ms | **1.12 px** |
| 1.0 (sebelumnya) | 0.05 | **138 ms** | 0.09 px |
| 1.5 | 0.05 | 96 ms | 0.12 px |
| **2.0 (dipakai)** | **0.05** | **71 ms** | **0.15 px** |
| 3.0 | 0.02 | 50 ms | 0.20 px |
| 5.0 | 0.01 | 29 ms | 0.27 px |

Jitter diukur pada window statis (5.43–7.0 dtk video, saat pose A dipegang).

**Keputusan:** `mincutoff=2.0, beta=0.05, dcutoff=1.0`.

Alasannya: group delay turun dari 138 ms ke 71 ms (potong ~50%), sementara
jitter statis naik dari 0.09 px ke 0.15 px — masih ~3× di bawah jitter
referensi yang dipakai saat ekstraksi data tari (0.41 px terfilter), jadi
tidak ada penurunan kejelasan gerak. Menarik ke `3.0/0.02` (50 ms) memberi
hemat 21 ms lagi dengan jitter 0.20 px, tapi kehilangan hampir seluruh
margin jitter; 2.0 adalah titik seimbang yang aman untuk perangkat
low-end yang bisa jatuh ke delegate CPU.

> Parameter runtime ada di `src/lib/pose/types.ts`
> (`POSE_FILTER_MINCUTOFF`, `POSE_FILTER_BETA`, `POSE_FILTER_DCUTOFF`).
> Nilainya dikunci unit test (`tests/pose.test.ts`) agar tidak berubah
> diam-diam tanpa pengukuran ulang.

## 2. Flicker siluet (kedip)

Kamera web berjalan 30 fps, sedangkan loop aplikasi berjalan di rAF
(60 Hz). Jadi **~50% tick rAF tidak punya frame kamera baru**.

Kode lama di `drawUserFrame()`:
- mengosongkan kanvas **setiap tick** (`clearRect`)
- menggambar siluet **hanya** kalau ada landmark baru

Akibatnya siluet hilang pada separuh tick. Diuji deterministik dengan
sekuens frame yang dikontrol (30 frame baru per 60 tick), memakai
`drawUserFrame()` produksi apa adanya:

| Algoritma | Tick kanvas kosong |
|---|---|
| Lama (`clearRect` tiap tick) | **51.7%** |
| Baru (layer siluet persisten) | **3.3%** |

Sisa 3.3% = tick pertama (belum ada landmark) dan satu tick saat user
keluar frame — yang memang harus kosong.

**Perbaikan:** dua lapis (lihat `src/lib/game/silhouette-layer.ts`):

1. **Layer siluet** (offscreen, persisten di `Runner.silhouette`) — digambar
   ulang hanya ketika ada frame kamera baru.
2. **Kanvas utama** — tiap tick: salin layer siluet, lalu gambar kotak
   panduan di atasnya (panduan harus digambar ulang tiap tick, jadi tidak
   bisa ikut "persisten").

Dua kasus dibedakan secara eksplisit:
- `frame === null` → **tak ada frame kamera baru** → pertahankan siluet (jangan kedip).
- `frame.landmarks === null` → **kamera terisi tapi tak ada orang** → kosongkan
  siluet (user keluar frame, jangan tampil bayangan).

Perilaku ini dikunci unit test (`tests/silhouette-layer.test.ts`).

## 3. Kompensasi jam penilaian

 landmark user menggambarkan keadaan user **sekitar 100 ms yang lalu**
(penangkapan kamera ~1 frame + group delay filter 71 ms + deteksi ~10 ms).
Karena itu pose user dibandingkan dengan segmen referensi yang terlalu maju:
user harus bergerak lebih cepat dari video agar dianggap cocok.

Diuji dengan sweep offset jam menggunakan landmark nyata + rumus scorer
asli, dengan user "meniru sempurna" (kamera = video yang sama dengan
video referensi):

| Offset jam | Skor rata-rata per segmen pose |
|---|---|
| 0.000 s (tanpa kompensasi) | 86.27 |
| **−0.100 s (dipakai)** | **87.49** |
| −0.160 s (optimum untuk filter 1.0/0.05) | 87.18 |

Offset optimum untuk `mincutoff=2.0` adalah **−0.10 s**, sesuai prediksi
(group delay 71 ms + capture ~1 frame + deteksi ~10 ms).

**Perubahan:** `stepMain()` memakai `t = clock.now() + SCORE_TIME_OFFSET_SEC`
dengan `SCORE_TIME_OFFSET_SEC = -0.1` (di `src/lib/game/config.ts` — ini
keputusan penilaian game, bukan parameter pose).
Offset yang sama dipakai untuk lane agar garis target dan penilaian
konsisten.

## 4. Yang TIDAK diubah (dan alasannya)

| Kandidat | Hasil pengukuran | Keputusan |
|---|---|---|
| Turunkan resolusi kamera (1280×720 → 640×480) | biaya deteksi hampir sama: 10.61 ms (1280×720) vs 9.43 ms (640×480) vs 9.31 ms (416×620). Selisih ~1 ms, bukan bottleneck. | **Tidak diubah** — kualitas pose turun, hematnya hampir nol. |
| Turunkan `minPoseDetectionConfidence` / `minTrackingConfidence` (0.5) | dropout di video nyata = **0.0%** (499/499 frame terdeteksi). Tidak ada cacat untuk diperbaiki. | **Tidak diubah** — menurunkan batas hanya menambah false positive. |
| Ubah delegate GPU → CPU | GPU ~9.4 ms/frame, jauh di bawah 16.7 ms (60 fps). | **Tidak diubah** — fallback CPU di `PoseEngine.init()` tetap dipertahankan untuk perangkat tanpa WebGL. |
| Ubah rumus skor / ambang tier | Rumus scorer ter-mirror di Python dan dijaga `bun run golden`. | **Tidak diubah** — perubahan latensi tidak boleh menggeser penilaian. |

## 5. Biaya pipeline saat ini

Diukur di browser, model `pose_landmarker_lite.task`, delegate GPU:

| Tahap | Biaya |
|---|---|
| `detectForVideo` (MediaPipe) | mean 9.4–10.6 ms, p50 ~9.1 ms, p90 ~11 ms |
| `drawUserFrame()` total (deteksi + filter + gambar) | mean 10.1 ms, p50 9.3 ms, p90 11.6 ms |
| `stepMain()` (skor + lane) | mean 0.1 ms |
| rAF loop | 44–59 Hz |

Total ~10 ms per frame → masih ada ~6 ms headroom dalam frame 16.7 ms.

## 6. Ringkasan residual

Dengan tiga perbaikan di atas, keterlambatan yang tersisa:

- ~33 ms penangkapan kamera (1 frame @30 fps) — inherent pada webcam 30 fps
- ~10 ms deteksi MediaPipe
- **~71 ms group delay filter One Euro** — masih kontributor terbesar

Menghilangkan sisa 71 ms berarti melemahkan filter lebih jauh, yang
menukar real-time dengan jitter (lihat tabel di bagian 1). Jika latensi
masih terasa di perangkat tertentu, langkah berikutnya yang masuk akal
adalah menggeser grup delay ke level `3.0/0.02` (50 ms) **khusus** untuk
perangkat yang terdeteksi cepat, atau memindahkan penilaian ke server.
