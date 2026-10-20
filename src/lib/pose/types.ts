// Landmark terfilter dalam koordinat ternormalisasi gambar (0..1, y ke bawah).
export type Landmark = { x: number; y: number; visibility?: number };

// Indeks MediaPipe Pose (33 titik). Referensi prototipe hanya pakai tubuh atas.
export const IDX = { nose: 0, L_shoulder: 11, R_shoulder: 12, L_elbow: 13, R_elbow: 14, L_wrist: 15, R_wrist: 16 } as const;

// Titik yang wajib terlihat saat kalibrasi (bahu, siku, pergelangan).
export const CALIBRATION_JOINTS = [11, 12, 13, 14, 15, 16] as const;
export const CALIBRATION_VIS_THRESHOLD = 0.6;
export const CALIBRATION_HOLD_MS = 1500;
