"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Volume2, VolumeX } from "lucide-react";
import "./BattleMenuMusic.css";

export default function BattleMenuMusic() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [slot, setSlot] = useState<Element | null>(null);
  const [sceneControl, setSceneControl] = useState(false);
  useEffect(() => {
    const music = new Audio("/audio/music/nexora-menu.mp3"); music.loop = true; music.volume = .12; music.preload = "auto"; audio.current = music;
    const sync = () => {
      let muted = false;
      try { muted = localStorage.getItem("triad-battle-muted") === "1"; } catch {}
      setMuted(muted); music.muted = muted;
      if (muted || document.hidden || document.documentElement.dataset.nexoraCombatActive === "true") music.pause();
      else void music.play().catch(() => { /* Retry on the next user gesture if autoplay is blocked. */ });
    };
    const locate = () => {
      const visible = [...document.querySelectorAll("[data-game-audio-slot]")].filter(el => el.getClientRects().length > 0);
      setSlot(visible.at(-1) || null);
      setSceneControl(Boolean(document.querySelector("[data-command-audio-control]")));
    };
    const observer = new MutationObserver(locate); observer.observe(document.body, { childList: true, subtree: true }); locate(); sync();
    window.addEventListener("nexora:audio-preference", sync); window.addEventListener("nexora:combat-activity", sync); window.addEventListener("storage", sync);
    document.addEventListener("visibilitychange", sync); document.addEventListener("pointerdown", sync); document.addEventListener("keydown", sync);
    return () => { observer.disconnect(); music.pause(); music.removeAttribute("src"); music.load(); audio.current = null; window.removeEventListener("nexora:audio-preference", sync); window.removeEventListener("nexora:combat-activity", sync); window.removeEventListener("storage", sync); document.removeEventListener("visibilitychange", sync); document.removeEventListener("pointerdown", sync); document.removeEventListener("keydown", sync); };
  }, []);
  if (!slot && sceneControl) return null;
  const button = <button type="button" className={`nexora-menu-audio ${slot ? "" : "nexora-menu-audio-fixed"}`} data-global-audio-control aria-label={muted ? "เปิดเสียงเมนู" : "ปิดเสียงเมนู"} title={muted ? "เปิดเสียงเมนู" : "ปิดเสียงเมนู"} aria-pressed={muted} onClick={() => {
    const next = !muted;
    if (audio.current) { audio.current.muted = next; if (next) audio.current.pause(); }
    setMuted(next); try { localStorage.setItem("triad-battle-muted", next ? "1" : "0"); } catch {}
    window.dispatchEvent(new Event("nexora:audio-preference"));
  }}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>;
  return slot ? createPortal(button, slot) : button;
}
