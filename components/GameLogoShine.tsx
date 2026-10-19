"use client";

import { useEffect } from "react";
import "./GameLogoShine.css";

const logo = "/images/triad/nexora-official-logo.webp";

// Decorate existing images without wrapping them or changing scene layout.
export default function GameLogoShine() {
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let layers: Array<{ image: HTMLImageElement; light: HTMLDivElement }> = [];
    const clear = () => {
      cancelAnimationFrame(frame);
      layers.forEach(({ light }) => light.remove());
      layers = [];
    };
    const enabled = () => {
      let moving = true;
      try { moving = localStorage.getItem("triad-command-motion-off") !== "1"; } catch { /* Optional preference. */ }
      return moving && !document.hidden && !motion.matches;
    };
    const pulse = () => {
      clear();
      if (!enabled()) return;
      for (const image of document.querySelectorAll<HTMLImageElement>(`img[src="${logo}"]`)) {
        if (!image.complete || !image.naturalWidth || !image.getClientRects().length) continue;
        const light = document.createElement("div");
        light.className = "nexora-logo-reflection";
        light.setAttribute("aria-hidden", "true");
        (image.closest("dialog[open]") || document.body).append(light);
        layers.push({ image, light });
      }
      const started = performance.now();
      const follow = () => {
        if (!enabled() || performance.now() - started >= 750) { clear(); return; }
        for (const { image, light } of layers) {
          const rect = image.getBoundingClientRect();
          const style = getComputedStyle(image);
          const hit = document.elementFromPoint(Math.max(0,Math.min(innerWidth-1,rect.x+rect.width/2)),Math.max(0,Math.min(innerHeight-1,rect.y+rect.height/2)));
          const visible = image.isConnected && rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && Number(style.opacity) > 0 && hit && (hit === image || image.parentElement?.contains(hit));
          const scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
          const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
          Object.assign(light.style, { display: visible ? "block" : "none", left: `${rect.x+(rect.width-width)/2}px`, top: `${rect.y+(rect.height-height)/2}px`, width: `${width}px`, height: `${height}px` });
        }
        frame = requestAnimationFrame(follow);
      };
      follow();
    };
    const stop = () => { if (!enabled()) clear(); };
    const timer = window.setInterval(pulse, 5000);
    document.addEventListener("visibilitychange", stop);
    motion.addEventListener("change", stop);
    window.addEventListener("nexora:motion-preference", stop);
    return () => {
      clearInterval(timer); clear();
      document.removeEventListener("visibilitychange", stop);
      motion.removeEventListener("change", stop);
      window.removeEventListener("nexora:motion-preference", stop);
    };
  }, []);
  return null;
}
