"use client";

import { useEffect, useRef, useState } from "react";
import { loadHomeWallpaper } from "@/lib/home-wallpaper";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { primeBattleAudio } from "./BattleAudio";

export default function NexoraCommandScene({ homeVideo = false }: { homeVideo?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [source, setSource] = useState("");
  const [videoReady,setVideoReady]=useState(false);
  const [videoFailed,setVideoFailed]=useState(false);
  const [moving, setMoving] = useState(true);
  const [visible, setVisible] = useState(true);
  const [muted, setMuted] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReduced(media.matches);
    const syncVisibility = () => setVisible(!document.hidden);
    const syncAudio = () => { try { setMuted(localStorage.getItem("triad-battle-muted") === "1"); } catch {} };
    syncMotion(); syncVisibility();
    try {
      setMoving(localStorage.getItem("triad-command-motion-off") !== "1");
      setMuted(localStorage.getItem("triad-battle-muted") === "1");
    } catch { /* Preferences are optional. */ }
    media.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("nexora:audio-preference", syncAudio);
    return () => { media.removeEventListener("change", syncMotion); document.removeEventListener("visibilitychange", syncVisibility); window.removeEventListener("nexora:audio-preference", syncAudio); };
  }, []);
  const running = moving && visible && !reduced;
  useEffect(() => {
    if (!homeVideo) return;
    let active = true;
    void loadHomeWallpaper().then(url => { if (active) setSource(url); }).catch(() => { if(active)setVideoFailed(true); });
    return () => { active = false; };
  }, [homeVideo]);
  useEffect(() => {
    if (!video.current) return;
    if (running && source) void video.current.play().catch(() => {});
    else video.current.pause();
  }, [running, source]);
  return <>
    <div className="nexora-command-scene" data-motion={running ? "running" : "paused"} aria-hidden="true">
      <div className="nexora-command-camera">
        <div className="nexora-command-art">
          <img className="nexora-command-world" src={homeVideo ? "/videos/nexora-home-4k/poster.webp" : "/images/triad/nexora-command-original.webp"} alt="" decoding="async" fetchPriority="high" style={{visibility:homeVideo&&!videoFailed?'hidden':'visible'}} />
          {homeVideo&&!videoFailed && <video ref={video} className="nexora-command-world-video" src={source || undefined} muted loop playsInline preload="auto" onLoadedData={()=>{const element=video.current;if(element?.requestVideoFrameCallback&&running)element.requestVideoFrameCallback(()=>setVideoReady(true));else setVideoReady(true)}} onError={()=>setVideoFailed(true)} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",pointerEvents:"none",opacity:videoReady?1:0,transition:'opacity 500ms ease'}} />}
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
        window.dispatchEvent(new Event("nexora:audio-preference"));
        if (!next) void primeBattleAudio();
      }}>{muted ? <VolumeX /> : <Volume2 />}</button>
    </div>
  </>;
}
