"use client";

import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

// Logo memakai aset brand asli (public/brand/mark.png) — figur penari
// dari garis lengkung dengan titik sendi, sesuai konsep di
// brand/BRAND_DIRECTION.md.
//
//   light → figur multiwarna (terracotta/gold/indigo), untuk latar terang
//   dark  → figur emas, untuk latar gelap (kanvas game, panel indigo)
export function BrandMark({
  size = 40,
  variant = "light",
  className = "",
}: {
  size?: number;
  variant?: "light" | "dark";
  className?: string;
}) {
  const src = variant === "dark" ? "/brand/mark-dark.png" : "/brand/mark.png";
  // Rasio aspect rasio file: mark 48x64, mark-dark 78x93.
  const ratio = variant === "dark" ? 93 / 78 : 64 / 48;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={Math.round(size * ratio)}
      className={className}
      style={{ width: size, height: "auto" }}
    />
  );
}

export function SiteShell({
  children,
  onHome,
  onExplore,
  immersive,
}: {
  children: ReactNode;
  onHome: () => void;
  onExplore: () => void;
  /**
   * Mode "immersive" untuk layar latihan: header disederhanakan (tombol
   * kembali + identitas game saja) dan footer disembunyikan, supaya
   * kanvas pose mendapat ruang maksimum.
   */
  immersive?: { title: string; onBack: () => void };
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const links: Array<{ label: string; onClick: () => void }> = [
    { label: "Beranda", onClick: onHome },
    { label: "Jelajahi Gerak", onClick: onExplore },
  ];

  if (immersive) {
    return (
      <div className="flex min-h-screen flex-col bg-ivory text-indigo">
        <header className="sticky top-0 z-40 border-b border-line/70 bg-ivory/85 backdrop-blur-md">
          <nav className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3.5 lg:px-10">
            <button
              onClick={immersive.onBack}
              className="rounded-full px-3 py-1.5 text-sm font-bold text-teal hover:bg-teal/10"
            >
              ← Keluar
            </button>
            <span className="h-5 w-px bg-line" />
            <span className="flex items-center gap-2.5">
              <BrandMark size={22} />
              <span className="text-sm font-bold uppercase tracking-[.14em] text-ink-muted">
                {immersive.title}
              </span>
            </span>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-ivory text-indigo">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-ivory/85 backdrop-blur-md">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3.5 lg:px-10">
          <button onClick={onHome} className="flex items-center gap-3 text-left" aria-label="Sanggar Digital — beranda">
            <span className="grid h-11 w-11 place-items-center">
              <BrandMark size={30} />
            </span>
            <span className="leading-none">
              <strong className="block font-display text-[17px] font-extrabold tracking-tight text-indigo">
                Sanggar
              </strong>
              <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[.24em] text-teal">
                Digital
              </span>
            </span>
          </button>

          <div className="hidden items-center gap-8 text-sm font-semibold text-ink-muted md:flex">
            {links.map((l) => (
              <button key={l.label} onClick={l.onClick} className="hover:text-teal">
                {l.label}
              </button>
            ))}
            <button
              onClick={() => document.getElementById("tentang")?.scrollIntoView({ behavior: "smooth" })}
              className="hover:text-teal"
            >
              Tentang
            </button>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <a
              href="#jelajahi"
              onClick={(e) => {
                e.preventDefault();
                onExplore();
              }}
              className="rounded-full bg-teal px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_0_var(--teal-dark)] hover:bg-teal-dark"
            >
              Mulai Belajar
            </a>
          </div>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-indigo md:hidden"
            aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>

        {menuOpen && (
          <div className="border-t border-line bg-surface px-6 py-4 md:hidden">
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <button
                  key={l.label}
                  onClick={() => {
                    setMenuOpen(false);
                    l.onClick();
                  }}
                  className="rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ink-muted hover:bg-ivory hover:text-teal"
                >
                  {l.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  document.getElementById("tentang")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ink-muted hover:bg-ivory hover:text-teal"
              >
                Tentang
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onExplore();
                }}
                className="mt-2 rounded-full bg-teal px-5 py-2.5 text-sm font-bold text-white"
              >
                Mulai Belajar
              </button>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <div className="flex items-center gap-2.5">
            <BrandMark size={22} />
            <span className="font-display font-bold text-indigo">Sanggar Digital</span>
            <span className="hidden sm:inline">· Gerak Tradisi, Hidup Kembali</span>
          </div>
          <p className="text-xs">
            Video tidak keluar dari perangkat. Referensi geraknya tetap milik sanggar dan penarinya.
          </p>
        </div>
      </footer>
    </div>
  );
}
