"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal, preload } from "react-dom";
import { Shield, Volume2, VolumeX } from "lucide-react";
import "./BattleVersusIntro.css";

type Duelist = { id?: string; name: string; image?: string };
const seen = new Set<string>();
const DURATION = 5200;
const ART = "/images/versus/";

export default function BattleVersusIntro({ sessionKey, left, right, background, enabled = true }: {
  sessionKey: string; left: Duelist; right: Duelist; background?: string; enabled?: boolean;
}) {
  for (const name of ["arena", "duelist-gold", "duelist-silver", "plate-gold", "plate-silver", "footer"]) {
    preload(`${ART}${name}.png`, { as: "image" });
  }
  const [visible, setVisible] = useState(false);
  const [muted, setMuted] = useState(false);
  const sound = useRef<HTMLAudioElement | null>(null);
  const startedAt = useRef(0);
  useEffect(() => {
    if (!enabled) { setVisible(false); sound.current?.pause(); return; }
    if (!sessionKey || seen.has(sessionKey)) return;
    const key = `nexora:versus:${sessionKey}`;
    try { if (sessionStorage.getItem(key)) return; } catch {}
    let timer: ReturnType<typeof setTimeout> | undefined;
    let assetsReady = false;
    let disposed = false;
    void Promise.all(["arena", "duelist-gold", "duelist-silver", "plate-gold", "plate-silver", "footer"].map(name => new Promise<void>(resolve => {
      const image = new Image();
      image.onload = image.onerror = () => resolve();
      image.src = `${ART}${name}.png`;
    }))).then(() => { if (!disposed) assetsReady = true; });
    const begin = () => {
      if (!assetsReady || document.querySelector(".nexora-game-loading")) return false;
      seen.add(sessionKey);
      try { sessionStorage.setItem(key, "1"); } catch {}
      setVisible(true);
      startedAt.current=Date.now();
      const audio = new Audio("/audio/ui/battle-versus.mp3");
      audio.volume = .28;
      try { audio.muted = localStorage.getItem("triad-battle-muted") === "1"; } catch {}
      setMuted(audio.muted);
      sound.current = audio;
      if (!audio.muted) void audio.play().catch(() => {});
      timer = setTimeout(() => { setVisible(false); audio.pause(); }, DURATION);
      return true;
    };
    const poll = setInterval(() => { if (begin()) clearInterval(poll); }, 80);
    return () => { disposed = true; clearInterval(poll); clearTimeout(timer); sound.current?.pause(); };
  }, [sessionKey, enabled]);
  useEffect(() => {
    const mute = () => {
      if (!sound.current) return;
      try { sound.current.muted = localStorage.getItem("triad-battle-muted") === "1"; } catch {}
      setMuted(sound.current.muted);
    };
    window.addEventListener("nexora:audio-preference", mute);
    return () => window.removeEventListener("nexora:audio-preference", mute);
  }, []);
  if (!visible) return null;
  return createPortal(<div className="nexora-versus-plane" role="status" aria-label={`${left.name} พบกับ ${right.name}`}>
    <button className="nexora-versus-mute" aria-label={muted ? "เปิดเสียง" : "ปิดเสียง"} onClick={() => {
      const next=!muted;setMuted(next);if(sound.current)sound.current.muted=next;
      if(!next&&sound.current){sound.current.currentTime=Math.max(0,(Date.now()-startedAt.current)/1000);void sound.current.play().catch(()=>{});}
      try {localStorage.setItem("triad-battle-muted",next?"1":"0");}catch{}
      window.dispatchEvent(new Event("nexora:audio-preference"));
    }}>{muted?<VolumeX size={20}/>:<Volume2 size={20}/>}</button>
    <img className="nexora-versus-background" src={`${ART}arena.png`} alt="" fetchPriority="high" />
    <div className="nexora-versus-shade" />
    <div className="nexora-versus-characters" aria-hidden="true">
      <img className="nexora-versus-character" data-side="left" src={`${ART}duelist-gold.png`} alt="" />
      <img className="nexora-versus-character" data-side="right" src={`${ART}duelist-silver.png`} alt="" />
    </div>
    <img className="nexora-versus-logo" src="/images/triad/nexora-official-logo.webp" alt="NEXORA" />
    <div className="nexora-versus-duelists">
      {[left,right].map((player,index)=><section className="nexora-versus-duelist" data-side={index===0?"left":"right"} key={index}>
        <img className="nexora-versus-plate" src={`${ART}plate-${index===0?"gold":"silver"}.png`} alt="" aria-hidden="true" />
        <div className="nexora-versus-avatar"><img src={player.image || "/avatar.png"} alt="" /><Shield aria-hidden="true" /></div>
        <div className="nexora-versus-name"><small>DUELIST</small><h2 data-name={player.name}>{player.name}</h2><span>NEXORA CARD GAME</span></div>
      </section>)}
    </div>
    <div className="nexora-versus-impact" aria-hidden="true"><b>VS</b></div>
    <div className="nexora-versus-bolt" aria-hidden="true" />
    <div className="nexora-versus-scan" aria-hidden="true" />
    <div className="nexora-versus-sparks" aria-hidden="true">{Array.from({length:16},(_,index)=><i key={index} style={{left:`${(index*37)%100}%`,animationDelay:`${index*137}ms`,animationDuration:`${1800+(index%4)*300}ms`}} />)}</div>
    <footer className="nexora-versus-footer"><img src={`${ART}footer.png`} alt="" aria-hidden="true" /><div><strong>กำลังเข้าสู่สนามดวล</strong><span>PREPARE FOR BATTLE</span></div><i /></footer>
  </div>,document.body);
}
