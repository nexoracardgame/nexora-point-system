"use client";

import { useLayoutEffect, useRef, useState, type ReactNode,type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, SendHorizontal } from "lucide-react";

export type ArenaChatMessage = { id: string; senderId: string; senderName: string; text: string };
export default function BattleArenaChat({ messages, currentUserId, draft, onDraftChange, onSubmit, disabled = false }: {
  messages: ArenaChatMessage[]; currentUserId: string; draft: string; onDraftChange: (text: string) => void; onSubmit: () => void; disabled?: boolean;
}) {
  const log = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages.length]);
  return <section className="triad-battle-chat-hud" aria-label="แชตสนาม">
    <div ref={log} className="triad-chat-hud-messages" role="log" aria-live="polite" aria-relevant="additions">{messages.slice(-40).map(message => <div key={message.id} className="triad-chat-hud-line"><span className={message.senderId === currentUserId ? "triad-chat-hud-own" : "triad-chat-hud-name"}>{message.senderName}: </span><span>{message.text}</span></div>)}</div>
    <form onPointerDown={event=>event.stopPropagation()} onSubmit={event => { event.preventDefault(); onSubmit(); }}><MessageCircle size={16} aria-hidden="true" /><input aria-label="ข้อความแชตสนาม" placeholder="แชตสนาม..." value={draft} onChange={event => onDraftChange(event.target.value.slice(0,240))} maxLength={240} disabled={disabled} autoComplete="off" enterKeyHint="send" /><button type="submit" aria-label="ส่งข้อความ" title="ส่งข้อความ" disabled={disabled || !draft.trim()}><SendHorizontal size={16} /></button></form>
  </section>;
}

export function BattleArenaChatFrame({ children, arenaSelector, cinematicActive, rotateBreakpoint = 900 }: { children: ReactNode; arenaSelector: string; cinematicActive: boolean; rotateBreakpoint?: number }) {
  const [frame, setFrame] = useState<{ left: number; top: number; width: number; height: number; rotated: boolean; clearWidth?: number;handInset:number } | null>(null);
  useLayoutEffect(() => {
    const board = document.querySelector<HTMLElement>(arenaSelector);
    const measure = () => {
      const rotated = document.documentElement.dataset.gamePortrait !== undefined ? document.documentElement.dataset.gamePortrait === "true" : window.matchMedia(`(max-width:${rotateBreakpoint}px) and (orientation:portrait)`).matches;
      const canvas = board?.closest<HTMLElement>(".nexora-arena-surface,.nexora-command-deck") || board;
      const rect = !cinematicActive ? canvas?.getBoundingClientRect() : null;
      const cards = rect ? Array.from(board?.querySelectorAll<HTMLElement>("[data-pentad-side] > button") || []) : [];
      const clearWidth = cards.length ? Math.max(80,Math.min(...cards.map(card => { const r=card.getBoundingClientRect(); return rotated ? r.top-rect!.top : r.left-rect!.left; }))-24) : undefined;
      const hand=[...document.querySelectorAll<HTMLElement>('.nexora-arena-hand')].map(el=>el.getBoundingClientRect()).find(r=>r.width>0&&r.height>0);
      const mobile=window.matchMedia('(max-width:1000px),(hover:none) and (pointer:coarse)').matches;
      const handInset=mobile&&hand&&rect&&!cinematicActive?Math.max(0,rotated?hand.right-rect.left:rect.bottom-hand.top)+8:0;
      const next = { left: rect?.left || 0, top: rect?.top || 0, width: rotated ? rect?.height ?? window.innerHeight : rect?.width ?? window.innerWidth, height: rotated ? rect?.width ?? window.innerWidth : rect?.height ?? window.innerHeight, rotated, clearWidth,handInset };
      setFrame(current => current && Object.keys(next).every(key => current[key as keyof typeof next] === next[key as keyof typeof next]) ? current : next);
    };
    measure(); const observer = new ResizeObserver(measure); if (board) observer.observe(board);document.querySelectorAll('.nexora-arena-hand').forEach(el=>observer.observe(el));
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("resize", measure); };
  }, [arenaSelector, cinematicActive, rotateBreakpoint]);
  return frame ? createPortal(<div className="triad-battle-chat-hud-frame" style={{ left:frame.left,top:frame.top,width:frame.width,height:frame.height,transform:frame.rotated ? "rotate(90deg) translateY(-100%)" : "none", transformOrigin:"top left",'--chat-hand-inset':`${frame.handInset}px` } as CSSProperties} data-cinematic-chat={cinematicActive}><div style={{maxWidth:frame.clearWidth}}>{children}</div></div>, document.body) : null;
}
