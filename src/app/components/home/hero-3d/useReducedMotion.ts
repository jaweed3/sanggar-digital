"use client";

import { useEffect, useState } from "react";

/** true bila OS/browser meminta gerak diminimalkan. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    // Sinkronisasi awal via antrian microtask — bukan setState sinkron di effect.
    queueMicrotask(() => setReduced(mq.matches));
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced ?? false;
}
