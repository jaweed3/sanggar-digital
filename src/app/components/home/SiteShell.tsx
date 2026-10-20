"use client";
import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";

export function SiteShell({ children, onHome }: { children: ReactNode; onHome: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <main className="min-h-screen overflow-hidden bg-[#fffaf0] text-[#3b2314]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <button onClick={onHome} className="flex items-center gap-3 text-left">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#8b1d1d] text-xl text-[#f6c543]">✦</span>
          <span><strong className="block font-serif text-xl leading-none">Sanggar</strong><span className="text-[11px] uppercase tracking-[.22em] text-[#8b1d1d]">Digital</span></span>
        </button>
        <div className="hidden items-center gap-8 text-sm font-semibold text-[#795b43] md:flex">
          <button onClick={onHome}>Beranda</button><a href="#jelajahi">Jelajahi Gerak</a><a href="#tentang">Tentang</a>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="rounded-xl border border-[#eadcc7] p-2 md:hidden"><Menu size={20}/></button>
        <div className="hidden items-center gap-3 md:flex">
          <button className="rounded-full px-4 py-2 text-sm font-bold text-[#8b1d1d]">Masuk</button>
          <button className="rounded-full bg-[#8b1d1d] px-5 py-2.5 text-sm font-bold text-white shadow-[0_5px_0_#5b1717]">Mulai Belajar</button>
        </div>
      </nav>
      {menuOpen && <div className="mx-6 rounded-2xl border border-[#eadcc7] bg-white p-4 text-sm font-bold md:hidden">Beranda</div>}
      {children}
    </main>
  );
}
