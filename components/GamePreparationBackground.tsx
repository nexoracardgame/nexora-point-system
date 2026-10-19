"use client";

import { useEffect, useRef, useState } from "react";
import { homeWallpaperSources, loadHomeWallpaper, PREPARATION_WALLPAPER_POSTER } from "@/lib/home-wallpaper";
import "./GamePreparationBackground.css";

export default function GamePreparationBackground() {
  const video = useRef<HTMLVideoElement>(null);
  const [source, setSource] = useState("");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let active = true;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      let enabled = true;
      try { enabled = localStorage.getItem("triad-command-motion-off") !== "1"; } catch { /* Optional preference. */ }
      setRunning(!document.hidden && !motion.matches && enabled);
    };
    sync();
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("nexora:motion-preference", sync);
    void loadHomeWallpaper("preparation").then(url => { if (active) setSource(url); }).catch(() => { if (active) setFailed(true); });
    return () => {
      active = false;
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("nexora:motion-preference", sync);
    };
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (running && source) void element.play().catch(() => {});
    else element.pause();
    return () => element.pause();
  }, [running, source]);

  return <div className="nexora-preparation-background" aria-hidden="true">
    <img src={PREPARATION_WALLPAPER_POSTER} alt="" decoding="async" />
    {!failed && <video ref={video} src={source || undefined} muted loop playsInline preload="auto" data-ready={ready} onLoadedData={() => setReady(true)} onError={() => {
      const sources = homeWallpaperSources("preparation");
      const next = sources[sources.indexOf(source) + 1];
      setReady(false);
      if (next) setSource(next);
      else setFailed(true);
    }} />}
  </div>;
}
