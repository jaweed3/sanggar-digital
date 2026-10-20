// Hook kecil bersama: kamera + hitung mundur. Tanpa logika game.
import { useCallback, useEffect, useRef, useState } from "react";

export function useCamera() {
  const streamRef = useRef<MediaStream | null>(null);
  const camEl = useRef<HTMLVideoElement | null>(null);

  const attachCam = useCallback((el: HTMLVideoElement | null) => {
    camEl.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      void el.play().catch(() => {});
    }
  }, []);

  // Kembalikan { ok, error } — tanpa state, tanpa baca stale closure.
  const start = useCallback(async (): Promise<{ ok: boolean; error: string }> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 1280, height: 720 },
        audio: false,
      });
      streamRef.current = stream;
      const el = camEl.current;
      if (el) {
        el.srcObject = stream;
        await el.play();
      }
      return { ok: true, error: "" };
    } catch {
      return { ok: false, error: "Izin kamera ditolak atau kamera tidak ditemukan. Izinkan akses kamera lalu coba lagi." };
    }
  }, []);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    },
    [],
  );

  return { attachCam, startCamera: start };
}

export function useCountdown(onDone: () => void) {
  const [value, setValue] = useState(3);
  const timerRef = useRef(0);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  const start = useCallback(() => {
    setValue(3);
    let n = 3;
    window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      n -= 1;
      if (n <= 0) {
        window.clearInterval(timerRef.current);
        doneRef.current();
      } else {
        setValue(n);
      }
    }, 1000);
  }, []);

  useEffect(() => () => window.clearInterval(timerRef.current), []);
  return { countdown: value, startCountdown: start };
}
