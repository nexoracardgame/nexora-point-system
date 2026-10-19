"use client";

import { useEffect, useRef, useState } from "react";
import { ENTRY_WALLPAPER_POSTER, entryWallpaperSources } from "@/lib/game-entry-wallpaper";
import "./GameEntryBackground.css";

export default function GameEntryBackground({ className = "" }: { className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [source, setSource] = useState("");
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      let enabled = true;
      try { enabled = localStorage.getItem("triad-command-motion-off") !== "1"; } catch { /* Optional preference. */ }
      setRunning(!document.hidden && !motion.matches && enabled);
    };
    setSource(entryWallpaperSources()[0] || "");
    sync();
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("nexora:motion-preference", sync);
    return () => {
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("nexora:motion-preference", sync);
    };
  }, []);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (running) void element.play().catch(() => {});
    else element.pause();
    return () => element.pause();
  }, [source, running]);
  return <div className={`nexora-entry-background ${className}`} aria-hidden="true">
    <img src={ENTRY_WALLPAPER_POSTER} alt="" fetchPriority="high" />
    {source && <video ref={video} src={source} muted loop playsInline preload="auto" data-ready={ready}
      onLoadedData={() => setReady(true)} onError={() => {
        const sources = entryWallpaperSources();
        setReady(false);
        setSource(sources[sources.indexOf(source) + 1] || "");
      }} />}
  </div>;
}
