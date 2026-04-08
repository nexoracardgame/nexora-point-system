"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Flame } from "lucide-react";

export default function NexoraLuxuryHome() {
  const [mouse, setMouse] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const move = (e: MouseEvent) => {
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
    <div className="relative min-h-[calc(100vh-140px)] overflow-hidden rounded-[38px] border border-white/10 bg-[#111118] text-white shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.08),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(255,153,0,0.08),transparent_22%)]" />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] p-6 xl:p-8">
        {/* LEFT HERO */}
        <div className="relative min-h-[760px] overflow-hidden rounded-[34px] border border-white/10 bg-[#0f1016]">
          <div className="relative z-10 p-8">
            <h1 className="text-[72px] font-black leading-[0.88] tracking-[-0.04em] xl:text-[140px]">
              YOUR
              <br />
              <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-fuchsia-500 bg-clip-text text-transparent">
                NEXORA
              </span>
              <br />
              STYLE
            </h1>
          </div>

          <div
            className="absolute bottom-0 left-0 transition-transform duration-300"
            style={{
              transform: `translate(${(mouse.x - 50) * 0.08}px, ${(mouse.y - 50) * 0.05}px)`,
            }}
          >
            <img
              src="https://s.imgz.io/2026/03/20/158-39efa94028226fea.png"
              alt="hero"
              className="h-[680px] w-auto object-contain drop-shadow-[0_0_90px_rgba(255,153,0,0.18)]"
            />
          </div>

          <div className="absolute bottom-8 left-[42%] z-20 grid w-[48%] gap-4">
            <div className="rounded-[28px] border border-amber-300/15 bg-gradient-to-br from-orange-500/20 to-fuchsia-500/10 p-6 backdrop-blur-xl">
              <div className="text-sm uppercase tracking-[0.28em] text-amber-300">
                #001
              </div>
              <div className="mt-3 text-4xl font-black">GENESIS DROP</div>
              <p className="mt-3 text-sm leading-7 text-white/65">
                Enter the elite world of premium serial collectibles and unlock
                legendary elemental prestige.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/95 px-6 py-6 text-black shadow-[0_20px_80px_rgba(255,255,255,0.08)]">
              <div className="text-3xl font-black leading-tight">
                Discover the world where
                <br />
                NEXORA matters
              </div>
              <Link
                href="/market"
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-black px-5 py-3 font-bold text-white"
              >
                Mint now
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="grid gap-5">
          <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_100px_rgba(0,0,0,0.3)]">
            <div className="mb-4 flex items-center gap-3">
              <Flame className="h-5 w-5 text-amber-300" />
              <div className="text-5xl font-black leading-none">
                HOT
                <br />
                NEXORA
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {cards.map((card) => (
                <div
                  key={card.title}
                  className="group rounded-[28px] border border-white/10 bg-[#111118] p-4 transition duration-500 hover:-translate-y-2 hover:shadow-[0_20px_80px_rgba(255,153,0,0.12)]"
                >
                  <div className="text-xs uppercase tracking-[0.28em] text-white/45">
                    {card.price}
                  </div>
                  <img
                    src="https://s.imgz.io/2026/03/20/158-39efa94028226fea.png"
                    alt={card.title}
                    className="mx-auto h-[240px] object-contain transition duration-500 group-hover:scale-105"
                  />
                  <div className="text-xl font-black">{card.title}</div>
                  <div className="text-sm text-amber-300">{card.rarity}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[34px] border border-white/10 bg-gradient-to-r from-amber-400/10 via-orange-400/10 to-fuchsia-500/10 p-6 shadow-[0_20px_80px_rgba(255,153,0,0.08)]">
            <div className="text-sm uppercase tracking-[0.3em] text-white/50">
              Luxury ownership
            </div>
            <div className="mt-2 text-5xl font-black leading-tight">
              293 Unique Sigils • 500,000 Printed • 1/1 Serial
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
