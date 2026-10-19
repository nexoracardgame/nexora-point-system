"use client";

import { useEffect, useRef, useState } from "react";
import { History, ScrollText, X, ChevronDown } from "lucide-react";
import type { PentadRoom } from "@/lib/pentad-room-store";
import { triadCardByNo } from "@/lib/triad-dominion";
import "./BattleFieldHistory.css";

export default function BattleFieldHistory({ room }: { room: PentadRoom }) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(100);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); };
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const profiles = [...document.querySelectorAll<HTMLElement>('.nexora-arena-scoreplate,.battle-player-identity')];
        const bottom = Math.max(60, ...profiles.filter(node => node.getClientRects().length).map(node => node.getBoundingClientRect().bottom));
        setTop(Math.ceil(bottom + 16));
      });
    };
    const resize = new ResizeObserver(measure);
    resize.observe(document.body);
    const observeProfiles = () => {
      document.querySelectorAll('.nexora-arena-scoreplate,.battle-player-identity').forEach(node => resize.observe(node));
      measure();
    };
    const mutations = new MutationObserver(observeProfiles);
    mutations.observe(document.body, { childList: true, subtree: true });
    observeProfiles(); window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); mutations.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); } };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [open]);
  const name = (side: 'host' | 'challenger') => room.seats[side]?.name || (side === 'host' ? 'ฝ่ายเจ้าห้อง' : 'ฝ่ายคู่แข่ง');
  const card = (no: string) => no ? `#${no} ${triadCardByNo.get(no)?.name || ''}` : 'ไม่ได้ลงการ์ด';
  return <div className="battle-history-layer" style={{ '--history-top': `${top}px` } as React.CSSProperties}>
    <button ref={trigger} type="button" className="battle-history-trigger" title="บันทึกสนาม" aria-label="บันทึกสนาม" aria-expanded={open} aria-controls="battle-field-history" onClick={() => setOpen(value => !value)}><History size={22}/></button>
    {open && <aside id="battle-field-history" className="battle-history-panel" aria-label="บันทึกสนาม">
      <header><ScrollText size={23}/><div><h2>บันทึกสนาม</h2><span>{room.rounds.length} ตาที่ตัดสินผล · ล่าสุดอยู่ด้านบน</span></div><button type="button" title="ปิดบันทึกสนาม" aria-label="ปิดบันทึกสนาม" onClick={close}><X size={22}/></button></header>
      <div className="battle-history-scroll">
        {!room.rounds.length && <div className="battle-history-empty"><History size={32}/><p>ยังไม่มีตาที่ตัดสินผล</p></div>}
        {[...room.rounds].reverse().map(round => <details key={`${room.epoch}:${round.id}`} className="battle-history-round" open={round.id === room.rounds.at(-1)?.id}>
          <summary><span>ไฟต์ {round.fight} · ตา {round.turn}{round.finalDuel && ' · ตัดสิน'}</span><strong>{round.winner === 'draw' ? 'เสมอ' : `${name(round.winner)} ชนะ`}</strong><ChevronDown size={17}/></summary>
          <div className="battle-history-body">
            <p className="battle-history-reason">{round.reason}</p>
            <div className="battle-history-sides">{(['host','challenger'] as const).map(side => <section key={side} data-winner={round.winner === side}><h3>{name(side)}</h3><strong>{round.totals[side].toLocaleString()}</strong><span>พลังตัดสิน</span><p><b>มอนสเตอร์</b>{card(round.mains[side])}</p><p><b>สกิล</b>{card(round.skills[side])}</p></section>)}</div>
            {Boolean(round.stages?.length || round.events.length) && <><h3 className="battle-history-label">ลำดับเหตุการณ์</h3><ol className="battle-history-events">
              {round.stages?.map((stage,index) => <li key={`stage-${index}`}><strong>{stage.title}</strong><p>{stage.detail}</p></li>)}
              {round.events.map((event,index) => <li key={`event-${index}`}><strong>{name(event.side === 'player' ? 'host' : 'challenger')} · {card(event.cardNo)}</strong><p>{event.summary}</p></li>)}
            </ol></>}
          </div>
        </details>)}
      </div>
    </aside>}
  </div>;
}
