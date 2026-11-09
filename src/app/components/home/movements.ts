export interface Movement {
  id: string;
  title: string;
  region: string;
  level: string;
  time: string;
  /** Gradien kartu — diturunkan dari palet brand (indigo/teal/gold/terracotta). */
  color: string;
  emoji: string;
  /** Referensi latihannya sudah ada dan bisa dimainkan. */
  available: boolean;
}

export const movements: Movement[] = [
  {
    id: "pendet",
    title: "Pendet",
    region: "Bali",
    level: "Pemula",
    time: "03:42",
    color: "from-[#c9684a] via-[#d99a2b] to-[#f0c674]",
    emoji: "✦",
    available: false,
  },
  {
    id: "remo",
    title: "Remo",
    region: "Jawa Timur",
    level: "Pemula",
    time: "04:18",
    color: "from-[#17324d] via-[#2c4a68] to-[#087e8b]",
    emoji: "◈",
    available: false,
  },
  {
    id: "saman",
    title: "Saman",
    region: "Aceh",
    level: "Menengah",
    time: "05:06",
    color: "from-[#066570] via-[#087e8b] to-[#4fb3ab]",
    emoji: "✺",
    available: true,
  },
];

/** Gerakan yang referensi latihannya sudah siap dimainkan. */
export const availableMovements = movements.filter((m) => m.available);
