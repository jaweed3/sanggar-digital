<div align="center">
  <img src="logo.png" alt="Logo Sanggar Digital" width="180" />
  <h1>Sanggar Digital</h1>
  <p>Belajar tari tradisional dengan umpan balik pose real-time.</p>
</div>

Prototipe web belajar tari tradisional di browser. Saat ini latihan yang aktif adalah **Saman**; pemrosesan pose berjalan di perangkat menggunakan kamera dan MediaPipe.

## Cara menggunakan

Prasyarat: [Bun](https://bun.sh) dan browser modern dengan kamera.

```bash
bun install
bun run dev
```

Buka [http://localhost:3000](http://localhost:3000), pilih **Saman → Mulai latihan**, izinkan akses kamera, ikuti kalibrasi, lalu ikuti gerakan referensi. Skor terbaik disimpan di `localStorage` browser.

Perintah lain: `bun run build` untuk build, `bun run start` untuk menjalankan hasil build, `bun run lint` untuk lint, `bun run typecheck` untuk cek tipe, dan `bun run golden` untuk membandingkan scorer TypeScript dengan Python (`python3`).

## Batasan

- Ini prototipe, bukan produk siap produksi. Pendet dan Remo masih berupa katalog; sesi latihan yang tersedia hanya Saman.
- Penilaian masih eksperimental: memakai pose tubuh bagian atas, satu orang, dan ambang tier belum dikalibrasi dengan data penari.
- Skor adalah panduan latihan, bukan penilaian mutlak atas kebenaran gerak atau konteks budaya.
- Belum ada backend, akun, sinkronisasi skor, atau moderasi. Skor terbaik hanya tersimpan di browser yang digunakan.
- Akurasi dan kelancaran dipengaruhi pencahayaan, posisi kamera, perangkat, dan ketersediaan GPU (CPU digunakan sebagai fallback).

## Dokumentasi

- [Struktur proyek dan arsitektur](docs/STRUCTURE.md)
- [Panduan kontribusi](CONTRIBUTING.md)
- [Lisensi GPL-2.0](LICENSE)
