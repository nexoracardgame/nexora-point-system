"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { preload } from "react-dom";
import { LOBBY_ACTION_ART, loadLobbyAssets } from "@/lib/lobby-assets";
import "./BattleLoadingScreen.css";
import "./BattleMobileOverlays.css";

const DURATION = 3000;
let until = 0;
let pendingArrivalUntil = 0;
let lastArrival = -Infinity;
export function beginBattleLoading(trigger: "intent" | "arrival" = "intent") {
  if (typeof window === "undefined") return;
  const now = performance.now();
  const continuing = trigger === "arrival" && (now < pendingArrivalUntil || now - lastArrival < 1500);
  if (trigger === "intent") pendingArrivalUntil = now + 15000;
  else { pendingArrivalUntil = 0; lastArrival = now; }
  if (!continuing && until <= now) until = now + DURATION;
  window.dispatchEvent(new Event("nexora:battle-loading"));
}

export function useBattleLoadingStage(stage: string) {
  const previous = useRef(stage);
  useLayoutEffect(() => {
    if (previous.current !== stage) { previous.current = stage; beginBattleLoading("arrival"); }
  }, [stage]);
}

export default function BattleLoadingScreen() {
  preload(LOBBY_ACTION_ART, { as: "image", fetchPriority: "high" });
  const pathname = usePathname();
  if (pathname.includes("dominion")) {
    for (const name of ["arena", "duelist-gold", "duelist-silver", "plate-gold", "plate-silver", "footer"]) {
      preload(`/images/versus/${name}.png`, { as: "image" });
    }
  }
  const [run, setRun] = useState(0);
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useLayoutEffect(() => {
    let active = true;
    let sequence = 0;
    const artwork = Promise.race([
      loadLobbyAssets().catch(() => {}),
      new Promise<void>(resolve => { setTimeout(resolve, 8000); }),
    ]);
    const show = () => {
      const current = ++sequence;
      clearTimeout(timer.current);
      setVisible(until > performance.now());
      setRun(until);
      timer.current = setTimeout(() => {
        void artwork.then(() => { if (active && current === sequence) setVisible(false); });
      }, Math.max(0, until - performance.now()));
    };
    window.addEventListener("nexora:battle-loading", show);
    beginBattleLoading("arrival");
    return () => { active = false; clearTimeout(timer.current); window.removeEventListener("nexora:battle-loading", show); };
  }, [pathname]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const target = (event.target as HTMLElement)?.closest("button,a");
      if (!target || target.hasAttribute("disabled")) return;
      const name = target.getAttribute("aria-label") || target.textContent?.trim() || "";
      const href = target.getAttribute("href");
      if ((href?.startsWith("/battle") && href !== pathname) || /^(ยืนยันสร้างห้อง|เข้าห้อง|เริ่มเกม|พร้อม|กลับล็อบบี้|กลับหน้า PLAY)$/.test(name)) beginBattleLoading();
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [pathname]);
  if (!visible) return null;
  return <div className="nexora-game-loading" role="status" aria-label="กำลังเข้าสู่เกม"><div className="nexora-game-loading-wallpaper" /><div className="nexora-game-loading-content"><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME" /><div key={run} className="nexora-game-loading-track" role="progressbar" aria-label="กำลังโหลด" aria-valuemin={0} aria-valuemax={100}><div style={{animationDuration:`${Math.max(0, until - (typeof performance !== "undefined" ? performance.now() : 0))}ms`}} /></div></div></div>;
}
