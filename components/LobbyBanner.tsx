"use client";

import { useEffect, useState } from "react";
import { playGameUiSound } from "@/lib/game-ui-audio";
import "./LobbyBanner.css";

export type LobbyBannerSlide = { id: string; src: string; alt: string; fit?: "contain" | "cover" };
export const lobbyBannerSlides: LobbyBannerSlide[] = [
  { id: "logo", src: "/images/triad/nexora-official-logo.webp", alt: "NEXORA CARD GAME", fit: "contain" },
  { id: "wallpaper", src: "/images/triad/nexora-command-original.webp", alt: "โลกแห่ง NEXORA", fit: "cover" },
  { id: "next", src: "", alt: "" },
];

export default function LobbyBanner({ slides = lobbyBannerSlides }: { slides?: LobbyBannerSlide[] }) {
  const available = slides.slice(0, 3).filter(slide => slide.src.trim());
  const [activeId, setActiveId] = useState(available[0]?.id || "");
  const [selection, setSelection] = useState(0);
  const [visible, setVisible] = useState(true);
  const index = Math.max(0, available.findIndex(slide => slide.id === activeId));
  const active = available[index];
  const ids = available.map(slide => slide.id).join("|");
  useEffect(() => {
    const sync = () => setVisible(!document.hidden);
    sync(); document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  useEffect(() => {
    if (available.length < 2 || !visible) return;
    const timer = setTimeout(() => setActiveId(available[(index + 1) % available.length].id), 5000);
    return () => clearTimeout(timer);
  }, [activeId, ids, index, visible, selection]);
  if (!active) return null;
  return <section className="nexora-lobby-banner" aria-label="ข่าวสาร NEXORA" aria-roledescription="carousel" data-active-slide={active.id}>
    <div className="nexora-lobby-banner-frame">{available.map((slide, i) => <img key={slide.id} src={slide.src} alt={slide.alt} data-active={i === index} data-fit={slide.fit || "cover"} aria-hidden={i !== index} draggable={false} />)}<span className="nexora-lobby-banner-gleam" aria-hidden="true" /></div>
    {available.length > 1 && <div className="nexora-lobby-banner-dots" role="group" aria-label="เลือกรูปแบนเนอร์">{available.map((slide, i) => <button type="button" key={slide.id} aria-label={`แบนเนอร์ ${i + 1}: ${slide.alt}`} aria-pressed={i === index} onClick={() => { setActiveId(slide.id); setSelection(value => value + 1); playGameUiSound("click"); }} />)}</div>}
  </section>;
}
