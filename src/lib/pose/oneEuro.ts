// One Euro filter — menahan jitter landmark tanpa lag berat.
// Parameter default dari kontrak data: mincutoff=1.0, beta=0.05, dcutoff=1.0.
// Dipasang pada koordinat ternormalisasi dengan timestamp detik (VFR-safe).

function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  const te = Math.max(dt, 1e-6);
  return 1 / (1 + tau / te);
}

export class OneEuroFilter {
  private lastX = 0;
  private xHat = 0;
  private dxHat = 0;
  private lastT = 0;
  private started = false;

  constructor(
    private mincutoff = 1.0,
    private beta = 0.05,
    private dcutoff = 1.0,
  ) {}

  filter(x: number, t: number): number {
    if (!this.started) {
      this.started = true;
      this.lastX = x;
      this.xHat = x;
      this.dxHat = 0;
      this.lastT = t;
      return x;
    }
    const dt = Math.max(t - this.lastT, 1e-3);
    const dx = (x - this.lastX) / dt;
    this.dxHat = alpha(this.dcutoff, dt) * dx + (1 - alpha(this.dcutoff, dt)) * this.dxHat;
    const cutoff = this.mincutoff + this.beta * Math.abs(this.dxHat);
    const a = alpha(cutoff, dt);
    this.xHat = a * x + (1 - a) * this.xHat;
    this.lastX = x;
    this.lastT = t;
    return this.xHat;
  }

  reset(): void {
    this.started = false;
  }
}

// Bank filter per titik per sumbu. Satu instance dipakai satu PoseEngine.
export class OneEuroBank {
  private filters = new Map<string, OneEuroFilter>();
  constructor(
    private mincutoff = 1.0,
    private beta = 0.05,
    private dcutoff = 1.0,
  ) {}

  filter(id: string, x: number, tSec: number): number {
    let f = this.filters.get(id);
    if (!f) {
      f = new OneEuroFilter(this.mincutoff, this.beta, this.dcutoff);
      this.filters.set(id, f);
    }
    return f.filter(x, tSec);
  }

  reset(): void {
    this.filters.clear();
  }
}
