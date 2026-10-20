// Master clock. SATU-SATUNYA jam adalah media yang memutar referensi.
// Prototipe: clock.type "video" (audio null, bpm null) → VideoClock.
// Rekaman final: ganti ke AudioClock tanpa mengubah Scorer/lane.

export interface MasterClock {
  now(): number;
}

/** Jam video: now = video.currentTime + offset kalibrasi latensi. */
export class VideoClock implements MasterClock {
  constructor(
    private video: HTMLVideoElement | null,
    public offsetSec = 0,
  ) {}
  attach(video: HTMLVideoElement | null): void {
    this.video = video;
  }
  now(): number {
    return (this.video?.currentTime ?? 0) + this.offsetSec;
  }
}

/** Jam audio (rekaman final + beat grid). Sekarang belum dipakai. */
export class AudioClock implements MasterClock {
  constructor(
    private audio: HTMLAudioElement | null,
    public offsetSec = 0,
  ) {}
  attach(audio: HTMLAudioElement | null): void {
    this.audio = audio;
  }
  now(): number {
    return (this.audio?.currentTime ?? 0) + this.offsetSec;
  }
}
