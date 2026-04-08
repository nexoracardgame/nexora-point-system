"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Flame } from "lucide-react";

export default function NexoraLuxuryHome() {
  const [mouse, setMouse] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (window.innerWidth < 1024) return; // ปิด parallax บนมือถือ
      setMouse({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  const cards = [
    { title: "Infernal Flame", price: "8,900 NEX", rarity: "Legendary" },
    { title: "Tidal Wrath", price: "6,700 NEX", rarity: "Mythic" },
    { title: "Valecrown Titan", price: "12,500 NEX", rarity: "Genesis" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a10] text-white">
      {/* premium background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.10),transparent_28%)]" />

      <section className="relative z-10 mx-auto grid max-w-[1800px] gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
        {/* LEFT HERO */}
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#101018] min-h-[620px] sm:min-h-[760px]">
          {/* heading */}
          <div className="relative z-20 p-5 sm:p-8 lg:p-10">
            <h1 className="text-[42px] font-black leading-[0.88] tracking-[-0.04em] sm:text-[72px] lg:text-[120px]">
              YOUR
              <br />
              <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-fuchsia-500 bg-clip-text text-transparent">
                NEXORA
              </span>
              <br />
              STYLE
            </h1>

            <p className="mt-4 max-w-[540px] text-sm leading-7 text-white/60 sm:text-base">
              Experience the world-class collectible platform with luxury
              marketplace visuals, legendary serial ownership, and elite reward
              systems.
            </p>
          </div>

          {/* hero image */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 transition-transform duration-300 lg:left-0 lg:translate-x-0"
            style={{
              transform: `translate(${(mouse.x - 50) * 0.08}px, ${(mouse.y - 50) * 0.05}px)`,
          }}
          >
            <img
              src="https://s.imgz.io/2026/03/20/158-39efa94028226fea.png"
              alt="hero"
              className="h-[320px] w-auto object-contain drop-shadow-[0_0_90px_rgba(255,153,0,0.22)] sm:h-[480px] lg:h-[680px]"
            />
          </div>

          {/* floating cards */}
          <div className="absolute bottom-4 left-4 right-4 z-30 grid gap-4 sm:bottom-6 sm:left-6 sm:right-6 lg:left-auto lg:right-8 lg:w-[420px]">
            <div className="rounded-[24px] border border-amber-300/15 bg-gradient-to-br from-orange-500/20 to-fuchsia-500/10 p-4 backdrop-blur-xl sm:p-6">
              <div className="text-xs uppercase tracking-[0.28em] text-amber-300">
                #001
              </div>
              <div className="mt-2 text-2xl font-black sm:text-4xl">
                GENESIS DROP
              </div>
              <p className="mt-2 text-xs leading-6 text-white/65 sm:text-sm">
                Enter the elite world of premium serial collectibles and unlock
                legendary elemental prestige.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/95 p-4 text-black shadow-[0_20px_80px_rgba(255,255,255,0.08)] sm:p-6">
              <div className="text-xl font-black leading-tight sm:text-3xl">
                Discover the world where
                <br />
                NEXORA matters
              </div>
              <Link
                href="/market"
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-black px-5 py-3 text-sm font-bold text-white sm:text-base"
              >
                Enter Marketplace
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="grid gap-6">
          {/* hot cards */}
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <Flame className="h-5 w-5 text-amber-300" />
              <div className="text-3xl font-black leading-none sm:text-5xl">
                HOT
                <br />
                NEXORA
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => (
                <div
                  key={card.title}
                  className="group rounded-[24px] border border-white/10 bg-[#111118] p-4 transition duration-500 hover:-translate-y-2 hover:shadow-[0_20px_80px_rgba(255,153,0,0.12)]"
                >
                  <div className="text-[10px] uppercase tracking-[0.25em] text-white/45 sm:text-xs">
                    {card.price}
                  </div>

                  <img
                    src="https://s.imgz.io/2026/03/20/158-39efa94028226fea.png"
                    alt={card.title}
                    className="mx-auto h-[180px] object-contain transition duration-500 group-hover:scale-105 sm:h-[220px]"
                  />

                  <div className="text-lg font-black sm:text-xl">
                    {card.title}
                  </div>
                  <div className="text-sm text-amber-300">{card.rarity}</div>
                </div>
              ))}
            </div>
          </div>

          {/* stats */}
          <div className="rounded-[28px] border border-white/10 bg-gradient-to-r from-amber-400/10 via-orange-400/10 to-fuchsia-500/10 p-5 sm:p-6">
            <div className="text-xs uppercase tracking-[0.3em] text-white/50 sm:text-sm">
              Luxury ownership
            </div>
            <div className="mt-2 text-2xl font-black leading-tight sm:text-4xl lg:text-5xl">
              293 Unique Sigils • 500,000 Printed • 1/1 Serial
            </div>
          </div>
        </div>
      </section>

      {/* mobile sticky CTA */}
      <div className="fixed bottom-4 left-4 right-4 z-50 lg:hidden">
        <Link
          href="/market"
          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-4 font-black text-black shadow-[0_20px_60px_rgba(251,191,36,0.35)]"
        >
          Enter Marketplace
          <ArrowUpRight className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}