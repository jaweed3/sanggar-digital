"use client";

// Konstelasi Gerak — ornamen 3D ambient di hero. Vanilla three, tanpa R3F.
//
// ~280 titik sendi (emas/teal/terracotta) + garis penghubung tipis melayang
// lambat seperti kain di atas gradien indigo. Dekoratif murni:
// aria-hidden, tanpa interaksi keyboard, transparan (teks tetap kontras).
//
// Perf: DPR clamp [1, 1.5], pause saat offscreen/hidden, partikel dikurangi
// di layar kecil, cleanup penuh (RAF, listener, geometry, renderer).

import { useEffect, useRef } from "react";
import * as THREE from "three";

const BRAND = {
  gold: 0xd99a2b,
  goldSoft: 0xf2d9a4,
  teal: 0x4fb3ab,
  terracotta: 0xc9684a,
} as const;

function isSmallScreen(): boolean {
  return window.matchMedia("(max-width: 640px)").matches;
}

export function HeroScene({ className = "" }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // WebGL gagal → fallback (komponen induk render mockup statis)
    }

    const COUNT = isSmallScreen() ? 140 : 280;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

    renderer.setPixelRatio(DPR);
    renderer.setClearColor(0x000000, 0); // transparan — gradien indigo di bawah
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 9;

    // --- Titik ---
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const palette = [BRAND.gold, BRAND.teal, BRAND.goldSoft, BRAND.terracotta] as const;
    const tmp = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 9;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
      tmp.setHex(palette[i % palette.length]);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    const pointGeo = new THREE.BufferGeometry();
    pointGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pointGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const pointMat = new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(pointGeo, pointMat);
    scene.add(points);

    // --- Garis penghubung (konstelasi): hubungkan titik yang berdekatan ---
    const linePositions: number[] = [];
    const posAttr = pointGeo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i += 1) {
      const ax = positions[i * 3];
      const ay = positions[i * 3 + 1];
      let best = -1;
      let bestD = 1.1;
      for (let j = Math.max(0, i - 24); j < i; j++) {
        const dx = ax - positions[j * 3];
        const dy = ay - positions[j * 3 + 1];
        const d = Math.hypot(dx, dy);
        if (d < bestD && d > 0.15) {
          bestD = d;
          best = j;
        }
      }
      if (best >= 0) {
        linePositions.push(ax, ay, positions[i * 3 + 2], positions[best * 3], positions[best * 3 + 1], positions[best * 3 + 2]);
      }
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(linePositions), 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: BRAND.teal,
      transparent: true,
      opacity: 0.22,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    // --- Parallax mouse halus ---
    let targetX = 0;
    let targetY = 0;
    const onMouse = (e: MouseEvent) => {
      const r = mount.getBoundingClientRect();
      targetX = ((e.clientX - r.left) / Math.max(r.width, 1) - 0.5) * 0.6;
      targetY = ((e.clientY - r.top) / Math.max(r.height, 1) - 0.5) * 0.4;
    };
    window.addEventListener("mousemove", onMouse, { passive: true });

    // --- Resize ---
    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // --- Pause saat offscreen / tab hidden ---
    let visible = true;
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.02 }
    );
    io.observe(mount);
    const onVis = () => {
      visible = !document.hidden && ioVisible();
    };
    const ioVisible = () => {
      const r = mount.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    };
    document.addEventListener("visibilitychange", onVis);

    let raf = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const t = clock.getElapsedTime();
      // Hanyut lambat seperti kain (0,2–0,3 rad/s), bukan putaran cepat.
      points.rotation.y = t * 0.06;
      points.rotation.x = Math.sin(t * 0.2) * 0.08;
      lines.rotation.y = t * 0.06;
      lines.rotation.x = Math.sin(t * 0.2) * 0.08;
      camera.position.x += (targetX - camera.position.x) * 0.03;
      camera.position.y += (-targetY - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);
      // Akses posisi via atribut (bukan private) untuk efek napas vertikal.
      const p = posAttr.array as Float32Array;
      for (let i = 0; i < COUNT; i++) {
        p[i * 3 + 1] += Math.sin(t * 0.5 + i) * 0.0006;
      }
      posAttr.needsUpdate = true;
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouse);
      document.removeEventListener("visibilitychange", onVis);
      io.disconnect();
      ro.disconnect();
      scene.remove(points, lines);
      pointGeo.dispose();
      lineGeo.dispose();
      pointMat.dispose();
      lineMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} aria-hidden="true" className={`pointer-events-none ${className}`} />;
}
