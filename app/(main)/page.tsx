"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import AppInstallButton from "@/components/AppInstallButton";
import PrefetchLink from "@/components/PrefetchLink";

export default function NexoraLuxuryHome() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let frameId = 0;

    const move = (event: MouseEvent) => {
      if (frameId) return;

      frameId = window.requestAnimationFrame(() => {
        setMouse({
          x: (event.clientX / window.innerWidth - 0.5) * 26,
          y: (event.clientY / window.innerHeight - 0.5) * 18,
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
    <section className="relative min-h-[calc(var(--app-shell-height)-140px)] overflow-hidden rounded-[36px] border border-black/6 bg-[#f7f4ee] text-black shadow-[0_32px_90px_rgba(24,24,24,0.12)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.22),transparent_20%),radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.95),transparent_24%),linear-gradient(180deg,#fcfaf5_0%,#f3efe7_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(180deg,rgba(247,244,238,0)_0%,rgba(0,0,0,0.03)_68%,rgba(0,0,0,0.08)_100%)]" />

      <div className="pointer-events-none absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.72)_38%,rgba(255,255,255,0.14)_64%,rgba(255,255,255,0)_100%)]" />

      <div className="pointer-events-none absolute left-4 top-3 z-10 text-[22vw] font-black leading-none tracking-[-0.065em] text-black/[0.96] sm:left-8 sm:top-5 lg:text-[18vw]">
        Nexora
      </div>

      <div className="absolute right-4 top-4 z-30 text-[10px] uppercase tracking-[0.28em] text-black/48 sm:right-8 sm:top-8">
        WORLD CLASS EXPERIENCE
      </div>

      <div className="absolute left-4 top-[34%] z-30 hidden gap-6 text-sm font-semibold text-black/56 sm:flex lg:left-8">
        <span>Collect +</span>
        <span>Battle +</span>
        <span>Trade +</span>
        <span>Reward +</span>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 z-20 flex justify-center transition-transform duration-300"
        style={{ transform: `translate(${mouse.x}px, ${mouse.y}px)` }}
      >
        <Image
          src="https://s.imgz.io/2026/03/24/033-97ca7d23f8ddf07a.png"
          alt="Nexora hero"
          width={1200}
          height={1600}
          priority
          sizes="(max-width: 640px) 82vw, (max-width: 1024px) 64vw, 54vw"
          className="h-[68dvh] w-auto object-contain drop-shadow-[0_18px_50px_rgba(0,0,0,0.20)] sm:h-[80dvh] lg:h-[86dvh]"
        />
      </div>

      <div className="absolute inset-x-4 top-[56%] z-40 flex -translate-y-1/2 justify-center sm:inset-x-8 sm:top-auto sm:bottom-10 sm:translate-y-0">
        <AppInstallButton variant="light" />
      </div>

      <div className="absolute bottom-6 left-4 z-30 max-w-[430px] sm:bottom-10 sm:left-8">
        <div className="text-sm font-black uppercase tracking-[0.2em] text-amber-700">
          COLLECT, BATTLE, ASCEND
        </div>
        <div className="mt-3 text-base leading-7 text-black/76 sm:text-lg">
          Enter the next era of premium collectible card experiences with
          cinematic battles, elite ownership, and luxury-grade rewards.
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <PrefetchLink
            href="/market"
            className="rounded-2xl bg-black px-6 py-3 text-sm font-black text-white shadow-[0_18px_32px_rgba(0,0,0,0.16)] transition hover:scale-[1.03] hover:bg-black/88"
          >
            ENTER MARKET
          </PrefetchLink>
          <PrefetchLink
            href="/collections"
            className="rounded-2xl border border-black/12 bg-white/72 px-6 py-3 text-sm font-black text-black backdrop-blur-xl transition hover:scale-[1.03] hover:bg-white"
          >
            VIEW SETS
          </PrefetchLink>
        </div>
      </div>
    </section>
  );
}
