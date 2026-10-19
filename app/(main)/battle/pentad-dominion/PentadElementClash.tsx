"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal, preload } from "react-dom";
import { triadCardByNo, type TriadElement } from "@/lib/triad-dominion";
import { pentadElementNames, pentadElementRelation } from "@/lib/pentad-dominion";
import { hasPentadElementClash, PENTAD_ELEMENT_REVEAL_MS, PENTAD_ELEMENT_SCENE_MS } from "@/lib/pentad-element-presentation";
import type { PentadRoom, PentadRound } from "@/lib/pentad-room-store";
import "@/components/BattleVersusIntro.css";
import "@/components/BattleCardGeometry.css";
import "./PentadElementClash.css";

const ROOT = "/game-assets/battle/element-clash/";
const elements: Record<TriadElement, { index: number; color: string; hue: string }> = {
  earth: { index: 0, color: "#ffb65a", hue: "25deg" },
  fire: { index: 1, color: "#ff532b", hue: "0deg" },
  gold: { index: 2, color: "#ffe272", hue: "45deg" },
  wood: { index: 3, color: "#7dff71", hue: "100deg" },
  water: { index: 4, color: "#58cfff", hue: "195deg" },
  unknown: { index: 2, color: "#ffffff", hue: "0deg" },
};

export default function PentadElementClash({ round, room, arenaImage, onComplete }: { round: PentadRound; room: PentadRoom; arenaImage: string; onComplete: () => void }) {
  const complete = useRef(onComplete); complete.current = onComplete;
  const [resolved, setResolved] = useState(false);
  const valid = hasPentadElementClash(round);
  const left = triadCardByNo.get(round.mains.host);
  const right = triadCardByNo.get(round.mains.challenger);
  preload(ROOT + "crystals.png", { as: "image" });
  preload(ROOT + "magic_03.png", { as: "image" });
  preload(ROOT + "light_02.png", { as: "image" });
  useEffect(() => {
    setResolved(false);
    if (!valid) { complete.current(); return; }
    const reveal = setTimeout(() => setResolved(true), PENTAD_ELEMENT_REVEAL_MS);
    const end = setTimeout(() => complete.current(), PENTAD_ELEMENT_SCENE_MS);
    return () => { clearTimeout(reveal); clearTimeout(end); };
  }, [round.id, valid]);
  if (!valid || !left || !right) return null;
  const relation = pentadElementRelation(left.element, right.element);
  const same = left.element === right.element;
  const winningElement = relation.winner === "host" ? left.element : right.element;
  const losingElement = relation.winner === "host" ? right.element : left.element;
  const title = !resolved ? "ธาตุปะทะ" : relation.winner ? `ธาตุ${pentadElementNames[winningElement]}ชนะ` : same ? "ธาตุเสมอ" : "ธาตุเสริมพลัง";
  const detail = !resolved ? `ธาตุ${pentadElementNames[left.element]} ปะทะ ธาตุ${pentadElementNames[right.element]}` : relation.winner ? `ธาตุ${pentadElementNames[winningElement]}พิชิตธาตุ${pentadElementNames[losingElement]} · ได้ 1 คะแนน` : same ? "ไม่มีฝ่ายชนะด้วยธาตุ · ตัดสินต่อด้วย ATK + SUP" : `ธาตุ${pentadElementNames[relation.boosted === "host" ? left.element : right.element]}ได้รับพลังเสริม · ตัดสินต่อด้วย ATK + SUP`;

  return createPortal(<div className="nexora-versus-plane nexora-element-clash" data-resolved={resolved} role="status" aria-label={`ธาตุปะทะ ไฟต์ ${round.fight}`}>
    <img className="nec-arena" src={arenaImage} alt="" />
    <div className="nec-vignette" />
    <header className="nec-heading"><span>ELEMENTAL CLASH / ไฟต์ {round.fight}</span><h1 key={title}>{title}</h1></header>
    <div className="nec-duel">
      {(["host", "challenger"] as const).map((side, index) => {
        const card = index === 0 ? left : right;
        const art = elements[card.element];
        const outcome = !resolved ? "pending" : relation.winner ? relation.winner === side ? "winner" : "loser" : "neutral";
        const badge = !resolved ? `ธาตุ${pentadElementNames[card.element]}` : relation.winner ? relation.winner === side ? "ชนะธาตุ" : "แพ้ธาตุ" : same ? "ธาตุเสมอ" : relation.boosted === side ? "รับพลังเสริม" : "ส่งพลังเสริม";
        return <section className="nec-side" data-side={side} data-outcome={outcome} key={side} style={{ "--element-color": art.color, "--element-hue": art.hue } as CSSProperties}>
          <div className="nec-light"><img src={ROOT + "light_02.png"} alt="" /></div>
          <div className="nec-rune"><img src={ROOT + "magic_03.png"} alt="" /></div>
          <div className="nec-card-entry"><div className="nec-card" data-battle-card-face><img src={card.sourceImage} alt={card.name} draggable={false} /></div></div>
          <div className="nec-crystal-entry"><div className="nec-crystal"><div className="nec-crystal-window"><img src={ROOT + "crystals.png"} alt={`คริสตัลธาตุ${pentadElementNames[card.element]}`} draggable={false} style={{ left: `${-art.index * 100}%` }} /></div></div></div>
          <div className="nec-particles" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${10 + i * 37 % 80}%`, top: `${15 + i * 23 % 70}%`, animationDelay: `${-i * .23}s`, animationDuration: `${2.1 + i % 4 * .4}s` }} />)}</div>
          <div className="nec-identity"><strong title={room.seats[side]?.name}>{room.seats[side]?.name || "NEXORA DUELIST"}</strong><span>{card.name}</span><b>{badge}</b></div>
        </section>;
      })}
    </div>
    <div className="nexora-versus-impact nec-vs" aria-hidden="true"><b>VS</b></div>
    <div className="nec-impact" aria-hidden="true" />
    <footer className="nec-result"><p>{detail}</p><i /></footer>
  </div>, document.body);
}
