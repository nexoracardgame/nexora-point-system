"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Bot, Check, ChevronRight, Loader2, X } from "lucide-react";
import "./GameModeModal.css";

export type GameModeOption = { id: "all" | "monster" | "skill"; title: string; detail: string };
type Props = {
  format: "triad" | "pentad";
  modes: GameModeOption[];
  selected: GameModeOption["id"];
  withBot: boolean;
  busy: boolean;
  onSelect: (id: GameModeOption["id"]) => void;
  onBotChange: (enabled: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
};
const art = { all: "all_in_one.webp", monster: "monster.webp", skill: "skill.webp" };
const asset = "/images/mode-ui-v3/";

export function ModeCard({ mode, selected, disabled, onSelect }: { mode: GameModeOption; selected: boolean; disabled: boolean; onSelect: () => void }) {
  return <button type="button" className="nexora-v3-mode" data-mode={mode.id} aria-pressed={selected} disabled={disabled} onClick={onSelect}>
    <div className="nexora-v3-mode-art"><img src={asset + art[mode.id]} alt="" draggable={false} /></div>
    <span className="nexora-v3-mode-check" aria-hidden="true">{selected ? <Check size={20} /> : null}</span>
    <div className="nexora-v3-mode-info"><strong>{mode.title}</strong><span className="nexora-v3-divider" aria-hidden="true"><img src={asset + "nexora_star.png"} alt="" /></span><p>{mode.detail}</p></div>
    <span className="nexora-v3-mode-corner" aria-hidden="true" />
  </button>;
}

export function BotToggle({ enabled, disabled, onChange }: { enabled: boolean; disabled: boolean; onChange: (enabled: boolean) => void }) {
  return <button type="button" className="nexora-v3-bot" role="switch" aria-checked={enabled} aria-label="สู้กับบอททันที" disabled={disabled} onClick={() => onChange(!enabled)}>
    <span className="nexora-v3-bot-icon"><Bot size={26} /></span>
    <span className="nexora-v3-bot-copy"><strong>สู้กับบอททันที</strong><small>สร้างแล้วเข้าสู่หน้าเลือกการ์ดเลย บอทจะลงฝั่งผู้ท้าชิงเป็น BOT Level.99</small></span>
    <span className="nexora-v3-switch" aria-hidden="true"><span /></span>
  </button>;
}

export default function GameModeModal({ format, modes, selected, withBot, busy, onSelect, onBotChange, onConfirm, onClose }: Props) {
  const panel = useRef<HTMLElement>(null);
  const latest = useRef({ busy, onClose });
  latest.current = { busy, onClose };
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !latest.current.busy) { event.preventDefault(); latest.current.onClose(); }
      if (event.key !== "Tab") return;
      const buttons = [...(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])];
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); document.body.style.overflow = overflow; if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  return createPortal(<div className="nexora-v3-overlay" data-format={format} onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="nexora-v3-fx" aria-hidden="true"><img className="nexora-v3-float nexora-v3-float-left" src={asset + "fx/floating_card_far.png"} alt="" /><img className="nexora-v3-float nexora-v3-float-right" src={asset + "fx/floating_card_far.png"} alt="" /><img className="nexora-v3-crystal" src={asset + "fx/crystal_large.png"} alt="" /></div>
    <section ref={panel} className="nexora-v3-modal" role="dialog" aria-modal="true" aria-labelledby="nexora-v3-title" aria-describedby="nexora-v3-subtitle" aria-busy={busy}>
      <div className="nexora-v3-ring" aria-hidden="true"><img src={asset + "fx/background_ring.png"} alt="" /></div>
      <div className="nexora-v3-sparkles" aria-hidden="true"><i /><i /><i /><i /></div>
      <header className="nexora-v3-header"><img className="nexora-v3-ornament" src={asset + "header_ornament.png"} alt="" aria-hidden="true" /><span className="nexora-v3-emblem" aria-hidden="true"><img src={asset + "nexora_star.png"} alt="" /></span><h2 id="nexora-v3-title">เลือกโหมดการเล่น</h2><p id="nexora-v3-subtitle">GAME MODE SELECTION <span>· {format === "triad" ? "TRIAD · 3 ใบ" : "PENTAD · 5 ใบ"}</span></p></header>
      <button type="button" className="nexora-v3-close" aria-label="ปิดหน้าต่างเลือกโหมด" title="ปิดหน้าต่าง" disabled={busy} onClick={onClose}><X size={24} /></button>
      <div className="nexora-v3-options" data-count={modes.length}>{modes.map(mode => <ModeCard key={mode.id} mode={mode} selected={selected === mode.id} disabled={busy} onSelect={() => onSelect(mode.id)} />)}</div>
      <BotToggle enabled={withBot} disabled={busy} onChange={onBotChange} />
      <footer className="nexora-v3-actions"><button type="button" className="nexora-v3-confirm" onClick={onConfirm} disabled={busy} aria-busy={busy}>{busy ? <><Loader2 size={20} className="nexora-v3-spinner" />กำลังสร้างห้อง</> : <>ยืนยันสร้างห้อง<ChevronRight size={24} /></>}</button><button type="button" className="nexora-v3-cancel" onClick={onClose} disabled={busy}>ยกเลิก</button></footer>
    </section>
  </div>, document.body);
}
