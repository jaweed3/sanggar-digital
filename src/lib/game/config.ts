// Satu tempat untuk semua konstanta game. Ganti URL/tempo tanpa bedah loop.
//
// Lapisan: game. Modul pose TIDAK boleh mengimpor dari sini — kalau
// sebuah modul butuh konstanta game, berarti konstanta itu salah tempat.
import { UPPER_BODY_JOINTS } from "../pose/keypoints";

export const REF_URL = "/videos/saman/saman-dasar-prototipe.json";
export const VIDEO_URL = "/videos/saman/short-1-saman.mp4";
export const JUDGE_DELAY_EVENT = 0.3;
export const JUDGE_DELAY_POSE_END = 0.15;
export const LANE_VELOCITY = 220;
export const LANE_HEIGHT = 140;
export const UI_THROTTLE_CALIB_MS = 120;
export const UI_THROTTLE_SCORE_MS = 200;

// --- Kalibrasi ---
// Titik yang wajib terlihat saat kalibrasi (bahu, siku, pergelangan).
// Diambil dari sumber tunggal indeks MediaPipe (lib/pose/keypoints.ts).
export const CALIBRATION_JOINTS = UPPER_BODY_JOINTS;
export const CALIBRATION_VIS_THRESHOLD = 0.6;
export const CALIBRATION_HOLD_MS = 1500;

// --- Kompensasi jam penilaian ---
// Pipeline (penangkapan kamera ~1 frame + group delay filter ~71 ms + deteksi
// ~10 ms) membuat landmark user menggambarkan keadaan ~100 ms yang lalu.
// Saat user meniru video referensi persis, skor per segmen maksimum pada
// offset -0.10 s (diukur dengan sweep clock pada data landmark yang sama).
// Tanpa kompensasi ini, user harus bergerak "lebih cepat" dari video untuk
// terlihat cocok. Offset yang sama dipakai untuk lane supaya garis target
// dan penilaian konsisten.
export const SCORE_TIME_OFFSET_SEC = -0.1;
