"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useEffect } from "react";
import { performSecureLogout } from "@/lib/secure-logout";

type MarketPost = {
  id: string;
  cardNo: string;
  cardName: string;
  price: number;
  likes: number;
};

export default function NexoraMarketPageClient({
  latestCards = [],
  popularCards = [],
}: {
  latestCards: MarketPost[];
  popularCards: MarketPost[];
}) {
  const [mode, setMode] = useState<"popular" | "latest">("popular");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const cards = useMemo(
    () => (mode === "popular" ? popularCards : latestCards),
    [mode, popularCards, latestCards]
  );

  const getCardImage = (cardNo: string) => `/cards/${cardNo}.jpg`;

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0d0f] text-white">
      <div className="mx-auto max-w-[1700px] px-6 py-5">
        {/* top nav exact nft style */}
        <div className="mb-8 flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-10">
            <div className="text-3xl font-black">N</div>
            <div className="flex items-center gap-8 text-sm text-zinc-400">
              <button>Feed</button>
              <button className="text-white border-b border-white pb-2">Discover</button>
              <button>Activity</button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="rounded-none border border-white/20 bg-[#dfe8e8] px-8 py-3 font-semibold text-black">
              Create
            </button>
            <button className="text-sm">💎 32.06 ETH</button>
            <button>🔍</button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="h-10 w-10 overflow-hidden rounded-full border border-white/10"
              >
                <img
                  src="https://profile.line-scdn.net/0hRfPWexKaDUltLhOVaidyHhBrAyQaAAsBFU0RJkotVCxDTRgYBE9EehwmVysSSUhNAxhKKRp7V3oTAR5iGQsfJzNtUH8ySSxZCxwLKhpsNws3ZhJ5FC86KDAnLQwhcApnKg0EczRMNB8pHAseDRNATx1cMQ8ARU4aVBo"
                  className="h-full w-full object-cover"
                />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-14 z-50 w-72 rounded-3xl border border-orange-500/20 bg-[#0c0d12]/95 p-3 backdrop-blur-xl">
                  <div className="mb-2 border-b border-white/10 px-3 py-2">
                    <div className="font-bold">BOSS NEXORA</div>
                    <div className="text-xs text-zinc-400">Elite Marketplace Trader</div>
                  </div>
                  <button className="w-full rounded-2xl px-3 py-3 text-left hover:bg-white/5">👤 โปรไฟล์</button>
                  <button className="w-full rounded-2xl px-3 py-3 text-left hover:bg-white/5">⚙️ ตั้งค่าบัญชี</button>
                  <Link href="/dashboard" className="block w-full rounded-2xl px-3 py-3 text-left hover:bg-white/5">💳 Wallet</Link>
                  <button className="w-full rounded-2xl px-3 py-3 text-left hover:bg-white/5">🛡️ Admin Panel</button>
                  <div className="my-2 border-t border-white/10" />
                  <button
                    onClick={() => void performSecureLogout()}
                    className="w-full rounded-2xl px-3 py-3 text-left font-semibold text-red-400 hover:bg-red-500/10"
                  >
                    🚪 ออกจากระบบ
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* welcome */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-5xl font-light">Hello, Boss 👋</h2>
            <p className="mt-2 text-zinc-400">A great day to get new NEXORA cards</p>
          </div>
          <div className="flex gap-3">
            <button className="border border-white/20 px-6 py-3">Mint Card</button>
            <button className="border border-white/20 px-6 py-3">Search Card</button>
          </div>
        </div>

        {/* stats */}
        <div className="mb-10 grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[
            [cards.length || 124000, "Artworks"],
            [24000, "Auctions"],
            [94000, "Artists"],
            [1645, "Collections"],
          ].map(([value, label]) => (
            <div key={String(label)} className="bg-white/[0.03] p-6">
              <div className="text-4xl font-bold">{Number(value).toLocaleString()}</div>
              <div className="mt-2 text-zinc-400">{label}</div>
              <button className="mt-6 text-sm text-zinc-500">View all</button>
            </div>
          ))}
        </div>

        {/* discover */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-3xl font-semibold">Discover</h3>
            <div className="hidden md:flex items-center gap-2 text-sm">
              {[
                "All",
                "Legendary",
                "Fire",
                "Water",
                "Earth",
              ].map((tab, i) => (
                <button
                  key={tab}
                  className={`px-4 py-2 transition ${
                    i === 0
                      ? "border border-black bg-white text-black"
                      : "border border-white/20 text-zinc-300 hover:bg-white/5"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <button className="border border-white/20 px-4 py-2">All</button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {cards.slice(0, 8).map((card) => (
            <article key={card.id} className="group bg-white text-black transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div className="relative">
                <img
                  src={getCardImage(card.cardNo)}
                  alt={card.cardName}
                  className="h-[360px] w-full object-cover"
                />
                <div className="absolute left-4 top-4 flex items-center gap-3">
                 <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-white">
                  <img
                     src="https://profile.line-scdn.net/0hRfPWexKaDUltLhOVaidyHhBrAyQaAAsBFU0RJkotVCxDTRgYBE9EehwmVysSSUhNAxhKKRp7V3oTAR5iGQsfJzNtUH8ySSxZCxwLKhpsNws3ZhJ5FC86KDAnLQwhcApnKg0EczRMNB8pHAseDRNATx1cMQ8ARU4aVBo"
                     className="h-full w-full object-cover"
                  />
                </div>
                  
                </div>
                <div className="rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                  ❤️ {card.likes}
                </div>
              </div>

              <div className="p-5">
                <h4 className="text-xl font-semibold">{card.cardName}</h4>
                <p className="mt-2 text-sm text-zinc-500">Created by Nexora Market</p>
                <div className="mt-5 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-xs text-zinc-500">Current bid</div>
                    <div className="text-lg font-bold">◈ {card.price.toLocaleString()}</div>
                  </div>
                  <button className="bg-black px-6 py-3 text-white transition hover:bg-zinc-800">Buy Card</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
