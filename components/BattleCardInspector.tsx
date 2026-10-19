"use client";

import { createPortal } from "react-dom";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Check, X } from "lucide-react";
import "./BattleMobileOverlays.css";
import './BattleCardInspector.css';

type InspectorCard = { cardNo: string; name: string; sourceImage: string; attack: number; support: number; kind: string; skillText: string };

export default function BattleCardInspector({ card, element, interactive, onClose, onUseCard }: { card: InspectorCard; element: string; interactive: boolean; onClose?: () => void; onUseCard?: () => void }) {
  const [bottom, setBottom] = useState(16);
  const panel=useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const tops = [...document.querySelectorAll(".nexora-arena-hand,.nexora-arena-hand-filters")]
        .map(node => node.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0 && rect.top > window.innerHeight / 2).map(rect => rect.top);
      setBottom(tops.length ? Math.min(window.innerHeight * .25, window.innerHeight - Math.min(...tops) + 16) : 16);
    };
    measure();
    const observer = new ResizeObserver(measure);
    document.querySelectorAll(".nexora-arena-hand").forEach(node => observer.observe(node));
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  return createPortal(<div className="nexora-card-inspector" style={{"--inspector-bottom":`${bottom}px`} as CSSProperties} data-interactive={interactive} role="dialog" aria-modal={interactive} aria-label={`รายละเอียด No.${card.cardNo}`} onClick={event=>{if(event.currentTarget===event.target)onClose?.();}}>
    <section ref={panel} className="nexora-card-inspector-panel" onPointerDown={event=>event.stopPropagation()} onPointerUp={event=>event.stopPropagation()}>
      <header><span>รายละเอียดการ์ด · No.{card.cardNo}</span>{interactive && onClose && <button type="button" aria-label="ปิดหน้าต่างการ์ด" title="ปิดหน้าต่างการ์ด" onClick={onClose}><X size={20} /></button>}</header>
      <div className="nexora-card-inspector-art"><img src={card.sourceImage} alt={card.name} draggable={false} /></div>
      <div className="nexora-card-inspector-info"><h2>{card.name}</h2><div className="nexora-card-inspector-stats"><span>ATK {card.attack.toLocaleString()}</span><span>SUP {card.support.toLocaleString()}</span><span>{card.kind === "skill" ? "สกิล" : "มอนสเตอร์"} · {element}</span></div><p>{card.skillText || "มอนสเตอร์ใช้ค่าพลังและธาตุในการปะทะ"}</p></div>
      {interactive && onUseCard && <button type="button" className="nexora-card-inspector-use" onClick={onUseCard}><Check size={18} />เลือกการ์ดใบนี้ลงสนาม</button>}
    </section>
  </div>,document.body);
}
