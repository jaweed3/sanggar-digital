// Skor terbaik di localStorage — tanpa backend, video tak keluar device.
const KEY = (id: string) => `sanggar-best:${id}`;

export function getBest(refId: string): number | null {
  try {
    const v = localStorage.getItem(KEY(refId));
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function saveBest(refId: string, score: number): { best: number; isNew: boolean } {
  const rounded = Math.round(score);
  const prev = getBest(refId);
  const best = Math.max(prev ?? 0, rounded);
  const isNew = prev == null ? rounded > 0 : rounded > prev;
  try {
    localStorage.setItem(KEY(refId), String(best));
  } catch {
    /* abaikan */
  }
  return { best, isNew };
}
