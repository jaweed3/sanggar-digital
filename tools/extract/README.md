# tari-extract — detektor pose

Video gerakan tari → JSON referensi `tari-reference/0.1` (format yang dibaca app di
`src/lib/pose/reference.ts`). Memakai MediaPipe Pose; **tidak ada model baru**.

## Pakai

```bash
cd tools/extract
uv sync                       # sekali; Python 3.12 + mediapipe 0.10.14
uv run python -m tari_extract VIDEO.mp4 -o out/saman.json --id saman-dasar --title "Saman" --plot --sheet
```

| Opsi | Fungsi |
|---|---|
| `--start/--end` | potong klip (detik); semua waktu di JSON relatif terhadap awal klip |
| `--reuse` | pakai cache landmark `<out>.landmarks.npz`, tanpa deteksi ulang (cepat untuk menyetel ambang) |
| `--plot` | `<out>_poses.png` (stickman tiap pose) + `<out>_timeline.png` (kecepatan, hold, flow) |
| `--sheet` | `<out>_sheet.png`: satu frame per segmen, untuk memeriksa hasil dengan mata |
| `--strict` | keluar dengan kode 2 bila gerbang kualitas tidak lolos |
| `--thresh --min-hold --cluster --flow-gap` | ambang segmentasi (default dari video Saman) |
| `--pretty` | JSON berindentasi |

Kecepatan: ±10 detik untuk klip 16 detik (CPU).

## Cara kerja

1. **Deteksi** per frame dengan timestamp asli (video VFR; bukan nomor frame). 7 titik tubuh-atas.
2. **Isi celah** deteksi ≤ 0,2 dtk, lalu **One Euro** pada piksel (port `oneEuro.ts`).
3. **Normalisasi**: origin tengah bahu, skala median lebar bahu pada frame tegak, resample 15 fps.
4. **Segmentasi** dari kecepatan sudut 4 bone lengan (°/s; tak bergantung ukuran badan/jarak kamera):
   diam ≥ 0,4 dtk → `pose`; celah pendek → `swap`/`bow`; celah > 1,5 dtk atau gerak terus-menerus → `flow` (tidak dinilai).
5. **Pose kunci**: hold di-cluster (rata-rata galat sudut ≤ 18°; lebar bahu beda > 10% dipisah = membungkuk).
6. **Validasi**: konsistensi antar pengulangan, jarak antar pose, jitter statis, **gerbang kualitas**.

## Gerbang kualitas (`validation.quality`)

`usable:false` + `warnings` bila: deteksi < 80%, visibilitas median sendi < 0,6, sendi keluar frame > 10%,
< 70% frame lolos, resolusi < 360 px, klip < 2 dtk, tidak ada pose stabil, pose stabil < 25% durasi, atau track berlubang.
Video seperti itu tetap diproses (untuk uji), tapi jangan dijadikan referensi resmi.

## Kalibrasi (setelah ada data penari)

```bash
# 1) ekstrak tiap rekaman orang yang menirukan referensi
uv run python -m tari_extract rekaman.mp4 -o attempts/penari1.json
# 2) hitung sigma/bobot/toleransi/tier dari tiga kelompok
uv run python -m tari_extract.calibrate --ref ref.json \
  --group penari=attempts/p1.json,attempts/p2.json,... \
  --group terlatih=... --group awam=... -o kalibrasi.json --apply ref_terkalibrasi.json
```

`sigmaDeg` = RMS galat sudut penari per bone (setelah menyelaraskan geseran waktu), bobot = kebalikan sebarannya,
`toleranceMs` = persentil-90 geseran waktu, tier `HEBAT` = persentil-25 skor penari, `KECE` = persentil-75 skor awam.
`calibrated:true` hanya bila tiap kelompok ≥ `--min-n` (default 5) rekaman **dan** kelompok terpisah (AUC ≥ 0,70).
Di bawah itu angka tetap dilaporkan tapi referensi tetap `calibrated:false` dan bobot tebakan tidak ditimpa.
Tes alat ini memakai rekaman sintetis; belum pernah dijalankan pada data penari nyata.

## Yang sengaja TIDAK dibuat otomatis

`scoring.*` (bobot, `sigmaDeg`, toleransi waktu, tier) memakai nilai placeholder dengan `calibrated:false`.
Kalibrasi butuh data penari nyata (lihat bagian Kalibrasi). BPM tidak diturunkan; letupan periodik hanya dicatat di `note` pada `flow`.
Pose bernama A, B, C… menurut urutan kemunculan — bukan nama gerak Saman. **Validasi budaya oleh praktisi/sanggar tetap wajib.**

## Tes

```bash
uv run pytest                          # 41 tes: unit, perakitan dokumen, regresi video nyata (~10 dtk)
bun run check_contract.ts out/saman.json   # JSON dijalankan lewat kode app yang asli (judge/lane/scorer)
```

`test_core.py` mengunci kesamaan dengan app: indeks keypoint = `keypoints.ts`, bone & sudut = `scorer_mirror.py`,
One Euro = vektor golden dari `oneEuro.ts` (dijalankan lewat bun).
