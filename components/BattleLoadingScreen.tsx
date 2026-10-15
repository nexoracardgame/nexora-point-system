"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import "./BattleLoadingScreen.css";

const DURATION = 3000;
let until = 0;
export function beginBattleLoading() {
  if (typeof window === "undefined") return;
  if (until <= performance.now()) until = performance.now() + DURATION;
  window.dispatchEvent(new Event("nexora:battle-loading"));
}

export function useBattleLoadingStage(stage: string) {
  const previous = useRef(stage);
  useLayoutEffect(() => {
    if (previous.current !== stage) { previous.current = stage; beginBattleLoading(); }
  }, [stage]);
}

export default function BattleLoadingScreen() {
  const pathname = usePathname();
  const [run, setRun] = useState(0);
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useLayoutEffect(() => {
    const show = () => {
      clearTimeout(timer.current);
      setVisible(true);
      setRun(until);
      timer.current = setTimeout(() => setVisible(false), Math.max(0, until - performance.now()));
    };
    window.addEventListener("nexora:battle-loading", show);
    beginBattleLoading();
    return () => { clearTimeout(timer.current); window.removeEventListener("nexora:battle-loading", show); };
  }, [pathname]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const target = (event.target as HTMLElement)?.closest("button,a");
      if (!target || target.hasAttribute("disabled")) return;
      const name = target.getAttribute("aria-label") || target.textContent?.trim() || "";
      const href = target.getAttribute("href");
      if ((href?.startsWith("/battle") && href !== pathname) || /^(ยืนยันสร้างห้อง|ออกจากห้อง|ออกห้อง|เข้าห้อง|เริ่มเกม|พร้อม|กลับล็อบบี้|กลับหน้า PLAY)$/.test(name)) beginBattleLoading();
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [pathname]);
  if (!visible) return null;
  return <div className="nexora-game-loading" role="status" aria-label="กำลังเข้าสู่เกม"><div className="nexora-game-loading-wallpaper" /><div className="nexora-game-loading-content"><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME" /><div key={run} className="nexora-game-loading-track" role="progressbar" aria-label="กำลังโหลด" aria-valuemin={0} aria-valuemax={100}><div style={{animationDuration:`${Math.max(0, until - (typeof performance !== "undefined" ? performance.now() : 0))}ms`}} /></div></div></div>;
}
