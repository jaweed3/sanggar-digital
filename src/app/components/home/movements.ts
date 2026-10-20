export interface Movement { id: string; title: string; region: string; level: string; time: string; color: string; emoji: string; }
export const movements: Movement[] = [
  { id: "pendet", title: "Pendet", region: "Bali", level: "Pemula", time: "03:42", color: "from-[#c94d36] to-[#f0a33c]", emoji: "✦" },
  { id: "remo", title: "Remo", region: "Jawa Timur", level: "Pemula", time: "04:18", color: "from-[#74362f] to-[#c88739]", emoji: "◈" },
  { id: "saman", title: "Saman", region: "Aceh", level: "Menengah", time: "05:06", color: "from-[#274f52] to-[#d09b44]", emoji: "✺" },
];
