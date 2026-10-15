"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Clock3, Loader2, Shield, Sparkles } from "lucide-react";
import { targetSelectionView, toggleTargetSelection, type TargetOptionView } from "@/lib/target-selection-view";
import "./TargetSelectionModal.css";

type Props = { contextKey: string; skillName: string; description: string; options: TargetOptionView[]; selected: string[]; min?: number; max?: number; sequences?: string[][]; timeLeft?: number; busy?: boolean; readOnly?: boolean; waitingText?: string; selectionHint?: string; onSelect: (ids: string[]) => void; onConfirm: () => unknown };
const assets = "/images/target-ui/";

export default function TargetSelectionModal(props: Props) {
  const { contextKey, skillName, description, options, selected, min = 1, max = 1, sequences, timeLeft, busy = false, readOnly = false, waitingText, selectionHint, onSelect, onConfirm } = props;
  const [mounted, setMounted] = useState(false), [sending, setSending] = useState(false), [error, setError] = useState(""), [hidden, setHidden] = useState(false);
  const panel = useRef<HTMLElement>(null), locked = useRef(false), latest = useRef(props);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  latest.current = props;
  const view = targetSelectionView(options, selected, min, max, sequences);
  const expired = timeLeft !== undefined && timeLeft <= 0;
  useEffect(() => { setMounted(true); const previous = document.activeElement; const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = overflow; if (previous instanceof HTMLElement) previous.focus(); }; }, []);
  useEffect(() => { setError(""); setHidden(false); setClosing(false); clearTimeout(closeTimer.current); }, [contextKey]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  const eligibleKey = options.filter(option => !option.disabled).map(option => option.id).join("|");
  const selectedKey = selected.join("|");
  useEffect(() => {
    const current = latest.current;
    const legal = new Set(current.options.filter(option => !option.disabled).map(option => option.id));
    const valid = [...new Set(current.selected.filter(id => legal.has(id)))];
    if (valid.join("|") !== current.selected.join("|")) current.onSelect(valid);
  }, [eligibleKey, selectedKey, contextKey]);
  const hide = () => { setClosing(true); closeTimer.current = setTimeout(() => { setHidden(true); setClosing(false); }, 180); };
  useEffect(() => { if (mounted && !hidden) panel.current?.focus(); }, [mounted, hidden, contextKey]);
  const submit = async () => {
    const current = latest.current;
    if (locked.current || current.busy || current.readOnly || (current.timeLeft !== undefined && current.timeLeft <= 0) || !targetSelectionView(current.options, current.selected, current.min ?? 1, current.max ?? 1, current.sequences).canConfirm) return;
    locked.current = true; setSending(true); setError("");
    try { const result = await current.onConfirm(); if (result === false) setError("ส่งเป้าหมายไม่สำเร็จ กรุณาตรวจสอบแล้วลองอีกครั้ง"); }
    catch { setError("ส่งเป้าหมายไม่สำเร็จ ลองยืนยันอีกครั้งได้"); }
    finally { locked.current = false; setSending(false); }
  };
  if (!mounted) return null;
  if (hidden) return createPortal(<button type="button" className="nexora-target-reopen" onClick={() => setHidden(false)}><Sparkles size={18} />เลือกเป้าหมายสกิล</button>, document.body);
  return createPortal(<div className="nexora-target-overlay" data-target-mode={view.mode} data-closing={closing} role="dialog" aria-modal="true" aria-labelledby="nexora-target-title" onKeyDown={event => {
    if (event.key === "Escape" && !sending && !busy) hide();
    if (event.key !== "Tab") return;
    const buttons = [...(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])];
    if (!buttons.length) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === buttons[0] || document.activeElement === panel.current)) { event.preventDefault(); buttons.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
  }}>
    <section ref={panel} tabIndex={-1} className="nexora-target-window" data-groups={view.groups.length}>
      <header className="nexora-target-header"><img src={assets + "header.png"} alt="" aria-hidden="true" /><h2 id="nexora-target-title">เลือกเป้าหมายสกิล</h2><p>เลือกมอนสเตอร์เป้าหมายเพื่อใช้สกิลของคุณ</p></header>
      <span className="nexora-target-audio" data-game-audio-slot />
      <button type="button" className="nexora-target-close" aria-label="พักหน้าต่างเลือกเป้าหมาย" title="พักหน้าต่าง (เวลายังเดินต่อ)" disabled={sending || busy} onClick={hide}><img src={assets + "close_button.png"} alt="" aria-hidden="true" /></button>
      <div className="nexora-target-skill"><strong>{skillName}</strong><p>{description}</p>{selectionHint && <p className="nexora-target-hint">{selectionHint}</p>}{timeLeft !== undefined && <span className="nexora-target-timer" data-urgent={timeLeft <= 10}><Clock3 size={16} />{Math.floor(Math.max(0,timeLeft) / 60)}:{String(Math.max(0,timeLeft) % 60).padStart(2,"0")}</span>}</div>
      <div className="nexora-target-groups">{view.groups.map(group => <section className="nexora-target-side" data-faction={group.faction} key={group.faction}><h3><img src={assets + (group.faction === "ally" ? "gold_emblem.png" : "red_emblem.png")} alt="" aria-hidden="true" />{group.faction === "ally" ? "ฝั่งเรา" : "ฝั่งศัตรู"}</h3><div className="nexora-target-options">{group.options.map(option => {
        const index = selected.indexOf(option.id);
        return <button key={option.id} type="button" className="nexora-target-option" data-target-id={option.id} disabled={sending || busy || readOnly || expired} aria-pressed={index >= 0} onClick={() => onSelect(toggleTargetSelection(selected, option.id, max))}>
          <div className="nexora-target-art"><img className="nexora-target-frame" src={assets + (group.faction === "ally" ? "ally_card.png" : "enemy_card.png")} alt="" aria-hidden="true" />{option.action ? <span className="nexora-target-action-art"><Sparkles size={42} /></span> : <img className="nexora-target-card" src={option.card?.sourceImage || "/cards/card-backs/card-backs.png"} alt={option.card?.name || "มอนสเตอร์ที่ยังไม่เปิดเผย"} draggable={false} />}{index >= 0 && <span className="nexora-target-check">{max > 1 ? index + 1 : <Check size={20} />}</span>}</div>
          <strong>{option.card?.name || option.label}</strong>{option.card && <span className="nexora-target-stats"><span>ATK {option.card.attack.toLocaleString()}</span><span>SUP {option.card.support.toLocaleString()}</span></span>}{option.note && <small>{option.note}</small>}
        </button>;
      })}</div></section>)}</div>
      {!view.groups.length && <div className="nexora-target-empty"><Shield size={32} /><p>ยังไม่พบเป้าหมายที่เลือกได้ในตานี้</p></div>}
      <footer className="nexora-target-footer">{error && <p role="alert">{error}</p>}{readOnly ? <p>{waitingText || "รอผู้เล่นเลือกเป้าหมาย"}</p> : <button type="button" className="nexora-target-confirm" disabled={!view.canConfirm || sending || busy || expired} onClick={() => void submit()}>{sending || busy ? <Loader2 className="nexora-target-spinner" size={20} /> : null}{sending || busy ? "กำลังยืนยัน" : expired ? "หมดเวลา กำลังดำเนินต่อ" : "ยืนยันเป้าหมาย"}</button>}</footer>
    </section>
  </div>, document.body);
}
