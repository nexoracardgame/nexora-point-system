"use client";

import { useEffect, useState } from "react";

export default function AppSplash() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050507]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.18),transparent_45%)]" />

      <div className="relative flex flex-col items-center">
        <div className="mb-5 h-24 w-24 rounded-[28px] border border-amber-300/30 bg-black/60 p-3 shadow-[0_0_80px_rgba(251,191,36,0.35)]">
          <img
            src="/icon-512.png"
            alt="NEXORA"
            className="h-full w-full rounded-[20px] object-cover"
          />
        </div>

        <div className="text-2xl font-black tracking-[0.35em] text-amber-200">
          NEXORA
        </div>

        <div className="mt-3 text-[10px] uppercase tracking-[0.4em] text-white/45">
          Loading world...
        </div>

        <div className="mt-6 h-1 w-44 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-[splashLoad_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-amber-500 via-yellow-200 to-amber-500" />
        </div>
      </div>
    </div>
  );
}