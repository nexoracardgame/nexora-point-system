"use client";

import { useEffect, useRef, useState } from "react";
import { entryWallpaperPoster, entryWallpaperSources, type EntryWallpaperScene } from "@/lib/game-entry-wallpaper";
import "./GameEntryBackground.css";

export default function GameEntryBackground({ className = "", scene = "entry" }: { className?: string; scene?: EntryWallpaperScene }) {
  const container = useRef<HTMLDivElement>(null);
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
    let selected = "";
    const selectSource = () => {
      // Dialog children mount before showModal; a closed dialog has no measured width.
      const fallbackWidth = Math.min(window.innerWidth, 1920 / Math.min(window.devicePixelRatio || 1, 2));
      const next = entryWallpaperSources(scene, container.current?.clientWidth || fallbackWidth)[0] || "";
      if (next !== selected) { selected = next; setReady(false); setSource(next); }
    };
    selectSource();
    const observer = new ResizeObserver(selectSource);
    if (container.current) observer.observe(container.current);
    sync();
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("nexora:motion-preference", sync);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("nexora:motion-preference", sync);
    };
  }, [scene]);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (running) void element.play().catch(() => {});
    else element.pause();
    return () => element.pause();
  }, [source, running]);
  return <div ref={container} className={`nexora-entry-background ${className}`} data-wallpaper-scene={scene} aria-hidden="true">
    <img src={entryWallpaperPoster(scene)} alt="" fetchPriority="high" />
    {source && <video ref={video} src={source} autoPlay={running} muted loop playsInline preload="auto" data-ready={ready}
      onLoadedData={() => setReady(true)} onError={() => {
        const sources = entryWallpaperSources(scene, container.current?.clientWidth || window.innerWidth);
        setReady(false);
        setSource(sources[sources.indexOf(source) + 1] || "");
      }} />}
  </div>;
}
