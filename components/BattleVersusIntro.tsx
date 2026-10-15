"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Shield, Swords, Volume2, VolumeX } from "lucide-react";
import "./BattleVersusIntro.css";

type Duelist = { id?: string; name: string; image?: string };
const seen = new Set<string>();
const DURATION = 5200;

export default function BattleVersusIntro({ sessionKey, left, right, background, enabled = true }: {
  sessionKey: string; left: Duelist; right: Duelist; background?: string; enabled?: boolean;
}) {
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
    const begin = () => {
      if (document.querySelector(".nexora-game-loading")) return false;
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
    return () => { clearInterval(poll); clearTimeout(timer); sound.current?.pause(); };
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
    <img className="nexora-versus-background" src={background || "/images/triad/nexora-command-original.webp"} alt="" />
    <div className="nexora-versus-shade" />
    <img className="nexora-versus-logo" src="/images/triad/nexora-official-logo.webp" alt="NEXORA" />
    <div className="nexora-versus-duelists">
      {[left,right].map((player,index)=><section className="nexora-versus-duelist" data-side={index===0?"left":"right"} key={index}>
        <div className="nexora-versus-avatar"><img src={player.image || "/avatar.png"} alt="" /><Shield aria-hidden="true" /></div>
        <div className="nexora-versus-name"><small>DUELIST</small><h2 data-name={player.name}>{player.name}</h2><span>NEXORA CARD GAME</span></div>
      </section>)}
    </div>
    <div className="nexora-versus-impact" aria-hidden="true"><Swords /><b>VS</b></div>
    <div className="nexora-versus-bolt" aria-hidden="true" />
    <div className="nexora-versus-scan" aria-hidden="true" />
    <footer className="nexora-versus-footer"><strong>กำลังเข้าสู่สนามดวล</strong><span>PREPARE FOR BATTLE</span><i /></footer>
  </div>,document.body);
}
