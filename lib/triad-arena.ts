export const triadArenas = [
  { id: "fire", name: "สมรภูมิอัคนี", element: "ไฟ", image: "/battle-arenas/fire.webp", color: "#ffad84" },
  { id: "water", name: "วิหารวารี", element: "น้ำ", image: "/battle-arenas/water.webp", color: "#8de4f4" },
  { id: "earth", name: "หุบผาศิลา", element: "ดิน", image: "/battle-arenas/earth.webp", color: "#d5e5bf" },
  { id: "wood", name: "ป่ารากนิรันดร์", element: "ไม้", image: "/battle-arenas/wood.webp", color: "#9be2b5" },
  { id: "gold", name: "ปราการทองคำ", element: "ทอง", image: "/battle-arenas/gold.webp", color: "#f9dc84" },
] as const;

export type TriadArena = (typeof triadArenas)[number];

export function battleArenaForSeed(seed: string): TriadArena {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  return triadArenas[(hash >>> 0) % triadArenas.length];
}
