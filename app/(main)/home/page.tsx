"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Play, Sparkles } from "lucide-react";

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

  const gameTiles = useMemo(
    () => [
      { title: "NEXORA MARKET", image: "/cards/001.jpg", active: true },
      { title: "CARD BATTLE", image: "/cards/002.jpg" },
      { title: "COLLECTIONS", image: "/cards/003.jpg" },
      { title: "REWARDS", image: "/cards/004.jpg" },
    ],
    []
  );

  return (
    <div className="relative min-h-[calc(100vh-140px)] overflow-hidden rounded-[32px] border border-white/10 bg-[#090714] text-white shadow-[0_40px_140px_rgba(0,0,0,0.55)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_80%_30%,rgba(168,85,247,0.18),transparent_30%),radial-gradient(circle_at_70%_80%,rgba(59,130,246,0.14),transparent_28%)]" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

      <section className="relative grid min-h-[calc(100vh-140px)] grid-cols-1 lg:grid-cols-[320px_1fr]">
        {/* LEFT PANEL */}
        <div className="relative z-20 border-b border-white/10 bg-black/20 p-4 backdrop-blur-xl lg:border-b-0 lg:border-r lg:p-6">
          <div className="mb-6">
            <div className="text-2xl font-black tracking-tight">NEXORA</div>
            <div className="text-xs uppercase tracking-[0.3em] text-white/40">
              Ultimate Card Universe
            </div>
          </div>

          <div className="mb-4 text-xs uppercase tracking-[0.28em] text-white/40">
            Select your zone
          </div>

          <div className="space-y-3">
            {gameTiles.map((tile, i) => (
              <Link
                key={tile.title}
                href="/market"
                className={`group relative block overflow-hidden rounded-[20px] border transition-all duration-500 ${
                  tile.active
                    ? "border-amber-300/60 shadow-[0_0_30px_rgba(251,191,36,0.18)]"
                    : "border-white/10 hover:border-cyan-400/40"
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent z-10" />
                <img
                  src={tile.image}
                  alt={tile.title}
                  className="h-[92px] w-full object-cover transition duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-y-0 left-0 z-20 flex items-center px-4 text-lg font-black tracking-wide">
                  {tile.title}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* HERO */}
        <div className="relative min-h-[720px] overflow-hidden">
          <div
            className="absolute inset-0 transition-transform duration-300"
            style={{
              transform: `translate(${(mouse.x - 50) * 0.12}px, ${(mouse.y - 50) * 0.08}px) scale(1.03)`,
            }}
          >
            <img
              src="/cards/001.jpg"
              alt="hero"
              className="h-full w-full object-cover opacity-30"
            />
          </div>

          <div className="absolute right-[-5%] top-[8%] hidden h-[78%] w-[58%] lg:block">
            <img
              src="/cards/002.jpg"
              alt="feature"
              className="h-full w-full object-contain drop-shadow-[0_0_80px_rgba(59,130,246,0.35)] animate-[floatY_6s_ease-in-out_infinite]"
            />
          </div>

          <div className="relative z-20 flex h-full flex-col justify-center px-6 py-10 sm:px-10 lg:px-16">
            <div className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.4em] text-cyan-300">
              <Sparkles className="h-4 w-4" />
              NEXORA CHAMPIONS
            </div>

            <h1 className="max-w-[760px] text-[44px] font-black leading-[0.92] sm:text-[72px] lg:text-[96px] xl:text-[110px]">
              GET BETTER
              <br />
              <span className="text-white">AT NEXORA</span>
              <br />
              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 bg-clip-text text-transparent">
                CARDGAME
              </span>
            </h1>

            <p className="mt-6 max-w-[620px] text-base leading-8 text-white/70 sm:text-xl">
              Enter the futuristic battleground of 293 unique sigils, luxury
              serial cards, ranked duels, elite rewards, and cinematic world-class
              collection experiences.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <button className="inline-flex h-[58px] items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-8 text-base font-black text-black shadow-[0_0_30px_rgba(251,191,36,0.35)] transition hover:scale-[1.03]">
                <Play className="h-5 w-5" />
                Watch action
              </button>

              <Link
                href="/market"
                className="inline-flex h-[58px] items-center justify-center gap-3 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-8 text-base font-black text-cyan-200 backdrop-blur-xl transition hover:scale-[1.03]"
              >
                Explore
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        @keyframes floatY {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-18px);
          }
        }
      `}</style>
    </div>
  );
}
