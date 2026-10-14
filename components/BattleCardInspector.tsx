"use client";

import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";

type InspectorCard = { cardNo: string; name: string; sourceImage: string; attack: number; support: number; kind: string; skillText: string };

export default function BattleCardInspector({ card, element, interactive, onClose, onUseCard }: { card: InspectorCard; element: string; interactive: boolean; onClose?: () => void; onUseCard?: () => void }) {
  return createPortal(<div className="nexora-card-inspector" data-interactive={interactive} role="dialog" aria-modal={interactive} aria-label={`รายละเอียด No.${card.cardNo}`} onClick={event=>{if(event.currentTarget===event.target)onClose?.();}}>
    <section className="nexora-card-inspector-panel" onPointerDown={event=>event.stopPropagation()} onPointerUp={event=>event.stopPropagation()}>
      <header><span>รายละเอียดการ์ด · No.{card.cardNo}</span>{interactive && onClose && <button type="button" aria-label="ปิดหน้าต่างการ์ด" title="ปิดหน้าต่างการ์ด" onClick={onClose}><X size={20} /></button>}</header>
      <div className="nexora-card-inspector-art"><img src={card.sourceImage} alt={card.name} draggable={false} /></div>
      <div className="nexora-card-inspector-info"><h2>{card.name}</h2><div className="nexora-card-inspector-stats"><span>ATK {card.attack.toLocaleString()}</span><span>SUP {card.support.toLocaleString()}</span><span>{card.kind === "skill" ? "สกิล" : "มอนสเตอร์"} · {element}</span></div><p>{card.skillText || "มอนสเตอร์ใช้ค่าพลังและธาตุในการปะทะ"}</p></div>
      {interactive && onUseCard && <button type="button" className="nexora-card-inspector-use" onClick={onUseCard}><Check size={18} />เลือกการ์ดใบนี้ลงสนาม</button>}
    </section>
  </div>,document.body);
}
