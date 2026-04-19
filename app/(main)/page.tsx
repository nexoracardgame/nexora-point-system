"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import PrefetchLink from "@/components/PrefetchLink";

export default function NexoraLuxuryHome() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let frameId = 0;

    const move = (e: MouseEvent) => {
      if (frameId) return;

      frameId = window.requestAnimationFrame(() => {
        setMouse({
          x: (e.clientX / window.innerWidth - 0.5) * 30,
          y: (e.clientY / window.innerHeight - 0.5) * 20,
        });
        frameId = 0;
      });
    };

    window.addEventListener("mousemove", move);
    return () => {
      window.removeEventListener("mousemove", move);
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return (
    <section className="relative min-h-[calc(100vh-140px)] overflow-hidden rounded-[36px] bg-black text-white">
      {/* BG */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#02070c] via-[#020b14] to-black" />
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_70%,rgba(255,255,255,0.18),transparent_28%)]" />

      {/* GIANT TYPO */}
      <div className="pointer-events-none absolute left-4 top-0 z-10 text-[22vw] font-black leading-none tracking-[-0.06em] text-white sm:left-8 lg:text-[18vw]">
        Nexora
      </div>

      {/* TOP RIGHT MINI */}
      <div className="absolute right-4 top-4 z-30 text-[10px] uppercase tracking-[0.28em] text-white/70 sm:right-8 sm:top-8">
        WORLD CLASS EXPERIENCE
      </div>

      {/* TAG ROW */}
      <div className="absolute left-4 top-[34%] z-30 hidden gap-6 text-sm text-white/80 sm:flex lg:left-8">
        <span>Collect +</span>
        <span>Battle +</span>
        <span>Trade +</span>
        <span>Reward +</span>
      </div>

      {/* HERO CHARACTER */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 flex justify-center transition-transform duration-300"
        style={{ transform: `translate(${mouse.x}px, ${mouse.y}px)` }}
      >
        <Image
          src="https://s.imgz.io/2026/03/24/033-97ca7d23f8ddf07a.png"
          alt="nexora hero"
          width={1200}
          height={1600}
          priority
          sizes="(max-width: 640px) 80vw, (max-width: 1024px) 62vw, 52vw"
          className="h-[70vh] w-auto object-contain sm:h-[82vh] lg:h-[88vh] drop-shadow-[0_0_80px_rgba(255,255,255,0.08)]"
        />
      </div>

      {/* BOTTOM LEFT COPY */}
      <div className="absolute bottom-6 left-4 z-30 max-w-[420px] sm:bottom-10 sm:left-8">
        <div className="text-sm font-bold uppercase tracking-[0.2em] text-red-400">
          COLLECT, BATTLE, ASCEND
        </div>
        <div className="mt-3 text-base leading-7 text-white/85 sm:text-lg">
          Enter the next era of premium collectible card experiences with
          cinematic battles, elite ownership, and luxury-grade rewards.
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <PrefetchLink
            href="/market"
            className="rounded-2xl bg-white px-6 py-3 text-sm font-black text-black transition hover:scale-[1.03]"
          >
            ENTER MARKET
          </PrefetchLink>
          <PrefetchLink
            href="/collections"
            className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-black text-white backdrop-blur-xl transition hover:scale-[1.03]"
          >
            VIEW SETS
          </PrefetchLink>
        </div>
      </div>

      {/* BOTTOM FADE */}
      <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-black via-black/40 to-transparent" />
    </section>
  );
}
