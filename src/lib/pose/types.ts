// Landmark terfilter dalam koordinat ternormalisasi gambar (0..1, y ke bawah).
export type Landmark = { x: number; y: number; visibility?: number };

// Konstanta khusus lapisan pose. Konstanta penilaian/kalibrasi (yang
// menentukan perilaku game) ada di src/lib/game/config.ts — pemisahan ini
// menjaga arah dependensi app → game → pose tetap satu arah.
//
// Indeks MediaPipe & pemetaan keypoint tubuh-atas ada di ./keypoints.ts
// (sumber kebenaran tunggal — jangan tulis ulang indeks secara manual).

// Parameter filter One Euro untuk landmark user.
//
// Diukur dari landmark nyata (video referensi Saman, 524 frame, 2026-10-21):
//   mincutoff=1.0 → group delay 138 ms pada gerak tangan, jitter statis 0.09 px
//   mincutoff=2.0 → group delay  71 ms,                    jitter statis 0.15 px
// Jitter 0.15 px jauh di bawah ambang yang terlihat (ekstraksi referensi
// memakai 1.0/0.05 dengan hasil 0.41 px terfilter), jadi menambah respons
// filtering tidak mengorbankan kejelasan gerak.
// Angka lengkap: docs/LATENCY.md
export const POSE_FILTER_MINCUTOFF = 2.0;
export const POSE_FILTER_BETA = 0.05;
export const POSE_FILTER_DCUTOFF = 1.0;
