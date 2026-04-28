"use client";

import { useEffect, useMemo, useState } from "react";

const FIRST_OPEN_SPLASH_KEY = "nexora:first-open-splash:v1";

export default function FirstOpenSplash() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  const canUseStorage = useMemo(() => typeof window !== "undefined", []);

  useEffect(() => {
    if (!canUseStorage) {
      return;
    }

    const seen = window.sessionStorage.getItem(FIRST_OPEN_SPLASH_KEY);
    if (seen) {
      setMounted(true);
      return;
    }

    window.sessionStorage.setItem(FIRST_OPEN_SPLASH_KEY, "1");
    setMounted(true);
    setVisible(true);

    const fadeTimer = window.setTimeout(() => {
      setVisible(false);
    }, 1180);

    return () => {
      window.clearTimeout(fadeTimer);
    };
  }, [canUseStorage]);

  if (!mounted || !visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1600] flex items-center justify-center overflow-hidden bg-[#060708] px-5 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.34),transparent_22%),radial-gradient(circle_at_bottom,rgba(250,204,21,0.10),transparent_28%),linear-gradient(180deg,#07080a_0%,#0a0c10_100%)]" />
      <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:30px_30px]" />

      <div className="relative flex w-full max-w-[560px] flex-col items-center text-center">
        <div className="rounded-full border border-amber-300/22 bg-amber-300/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.34em] text-amber-200">
          NEXORA EXPERIENCE
        </div>

        <div className="mt-6 text-[15vw] font-black uppercase leading-none tracking-[-0.08em] text-white sm:text-[92px]">
          NEXORA
        </div>

        <div className="mt-3 max-w-[420px] text-sm font-semibold leading-6 text-white/58 sm:text-base">
          Loading premium marketplace systems, real-time chat, and collectible
          experiences.
        </div>

        <div className="mt-8 w-full max-w-[360px] overflow-hidden rounded-full border border-amber-300/18 bg-white/6 p-1">
          <div className="h-2 w-full rounded-full bg-[linear-gradient(90deg,#7c5b0c_0%,#facc15_42%,#fff1ad_70%,#facc15_100%)] animate-[nexora-splash-load_1.15s_ease-out_forwards]" />
        </div>
      </div>
    </div>
  );
}
