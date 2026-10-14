"use client";

import { useEffect, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { primeBattleAudio } from "./BattleAudio";

export default function NexoraCommandScene() {
  const [moving, setMoving] = useState(true);
  const [visible, setVisible] = useState(true);
  const [muted, setMuted] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReduced(media.matches);
    const syncVisibility = () => setVisible(!document.hidden);
    syncMotion(); syncVisibility();
    try {
      setMoving(localStorage.getItem("triad-command-motion-off") !== "1");
      setMuted(localStorage.getItem("triad-battle-muted") === "1");
    } catch { /* Preferences are optional. */ }
    media.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => { media.removeEventListener("change", syncMotion); document.removeEventListener("visibilitychange", syncVisibility); };
  }, []);
  const running = moving && visible && !reduced;
  return <>
    <div className="nexora-command-scene" data-motion={running ? "running" : "paused"} aria-hidden="true">
      <div className="nexora-command-camera">
        <div className="nexora-command-art">
          <picture><source media="(max-width:900px)" srcSet="/images/triad/nexora-world-small.webp 1x, /images/triad/nexora-world.webp 2x" /><img className="nexora-command-world" src="/images/triad/nexora-world.webp" alt="" decoding="async" fetchPriority="high" /></picture>
        </div>
        <div className="nexora-command-foreground">
          <picture><source media="(max-width:900px)" srcSet="/images/triad/nexora-duelists-small.webp 1x, /images/triad/nexora-duelists.webp 2x" /><img src="/images/triad/nexora-duelists.webp" alt="" decoding="async" fetchPriority="high" /></picture>
        </div>
        <div className="nexora-command-shards">{Array.from({ length: 16 }, (_, index) => <i key={index} style={{ left: `${22 + (index * 37 % 54)}%`, top: `${12 + (index * 23 % 72)}%`, animationDelay: `${-index * .7}s`, animationDuration: `${7 + index % 5}s` }} />)}</div>
      </div>
    </div>
    <div className="nexora-command-scene-controls">
      <button type="button" aria-label={moving ? "หยุดการเคลื่อนไหว" : "เปิดการเคลื่อนไหว"} title={moving ? "หยุดการเคลื่อนไหว" : "เปิดการเคลื่อนไหว"} aria-pressed={!moving} onClick={() => {
        const next = !moving; setMoving(next);
        try { localStorage.setItem("triad-command-motion-off", next ? "0" : "1"); } catch { /* Optional preference. */ }
      }}>{moving ? <Pause /> : <Play />}</button>
      <button type="button" data-command-audio-control aria-label={muted ? "เปิดเสียงเมนู" : "ปิดเสียงเมนู"} title={muted ? "เปิดเสียงเมนู" : "ปิดเสียงเมนู"} aria-pressed={muted} onClick={() => {
        const next = !muted; setMuted(next);
        try { localStorage.setItem("triad-battle-muted", next ? "1" : "0"); } catch { /* Optional preference. */ }
        if (!next) void primeBattleAudio();
      }}>{muted ? <VolumeX /> : <Volume2 />}</button>
    </div>
  </>;
}
