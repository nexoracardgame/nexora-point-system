"use client";

import { useLayoutEffect, useRef, useState, type ReactNode,type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, SendHorizontal } from "lucide-react";
import { useBattleChat } from "@/lib/use-battle-chat";
import type { BattleChatRoom } from "@/lib/battle-chat-messages";
import { battleChatClearance } from '@/lib/battle-chat-layout';
import './BattleArenaChat.css';

export type ArenaChatMessage = { id: string; senderId: string; senderName: string; text: string };
export default function BattleArenaChat({ messages, currentUserId, currentUserName = "", room, draft, onDraftChange, onSubmit, disabled = false }: {
  messages: ArenaChatMessage[]; currentUserId: string; currentUserName?: string; room?: BattleChatRoom; draft: string; onDraftChange: (text: string) => void; onSubmit: () => void | Promise<boolean | void>; disabled?: boolean;
}) {
  const chat = useBattleChat(messages, room, currentUserId, currentUserName);
  const log = useRef<HTMLDivElement>(null);
  const [expanded,setExpanded]=useState(false);
  const latest = chat.messages.at(-1);
  useLayoutEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [latest?.id]);
  return <section className="triad-battle-chat-hud" data-chat-expanded={expanded} aria-label="แชตสนาม" onFocusCapture={()=>setExpanded(true)}>
    <div ref={log} className="triad-chat-hud-messages" role="log" aria-live="polite" aria-relevant="additions">{chat.messages.map(message => <div key={message.id} className="triad-chat-hud-line"><span className={message.senderId === currentUserId ? "triad-chat-hud-own" : "triad-chat-hud-name"}>{message.senderName}: </span><span>{message.text}</span>{"failed" in message && message.failed === true && <small role="status"> · ส่งไม่สำเร็จ</small>}</div>)}</div>
    <form onPointerDown={event=>event.stopPropagation()} onSubmit={event => { event.preventDefault(); if (!disabled && draft.trim()) void chat.send(draft, onSubmit); }}><MessageCircle size={16} aria-hidden="true" /><input aria-label="ข้อความแชตสนาม" placeholder="แชตสนาม..." value={draft} onChange={event => onDraftChange(event.target.value.slice(0,240))} maxLength={240} disabled={disabled} autoComplete="off" enterKeyHint="send" /><button type="submit" aria-label="ส่งข้อความ" title="ส่งข้อความ" disabled={disabled || !draft.trim()}><SendHorizontal size={16} /></button></form>
  </section>;
}

export function BattleArenaChatFrame({ children, arenaSelector, cinematicActive, rotateBreakpoint = 900, layoutKey }: { children: ReactNode; arenaSelector: string; cinematicActive: boolean; rotateBreakpoint?: number; layoutKey?: string }) {
  const [frame, setFrame] = useState<{ left: number; top: number; width: number; height: number; rotated: boolean; clearWidth?: number;chatLeft:number;handInset:number } | null>(null);
  useLayoutEffect(() => {
    const board = document.querySelector<HTMLElement>(arenaSelector);
    const observed=new WeakSet<Element>();
    const observer = new ResizeObserver(()=>measure());
    const observe=(node:Element|null)=>{if(node&&!observed.has(node)){observed.add(node);observer.observe(node);}};
    const measure = () => {
      const rotated = document.documentElement.dataset.gamePortrait !== undefined ? document.documentElement.dataset.gamePortrait === "true" : window.matchMedia(`(max-width:${rotateBreakpoint}px) and (orientation:portrait)`).matches;
      const canvas = board?.closest<HTMLElement>(".nexora-arena-surface,.nexora-command-deck") || board;
      const rect = !cinematicActive ? canvas?.getBoundingClientRect() : null;
      const cards = rect ? Array.from(board?.querySelectorAll<HTMLElement>("[data-pentad-side] button,.nexora-arena-formation button,.heptad-slot,.triad-arena-card") || []) : [];
      const hand=[...document.querySelectorAll<HTMLElement>('.nexora-arena-hand')].map(el=>el.getBoundingClientRect()).find(r=>r.width>0&&r.height>0);
      const handInset=hand&&rect&&!cinematicActive?Math.max(0,rotated?hand.right-rect.left:rect.bottom-hand.top)+8:12;
      const hud=document.querySelector<HTMLElement>('.triad-battle-chat-hud-frame .triad-battle-chat-hud');observe(hud);
      const chatBottom=(rect?.height||window.innerHeight)-handInset;
      const clearance=rect&&!rotated&&cards.length?battleChatClearance(rect.width,chatBottom-(hud?.getBoundingClientRect().height||80),chatBottom,cards.map(card=>{const r=card.getBoundingClientRect();return {left:r.left-rect.left,right:r.right-rect.left,top:r.top-rect.top,bottom:r.bottom-rect.top};}),Math.min(440,rect.width*.28)):undefined;
      const next = { left: rect?.left || 0, top: rect?.top || 0, width: rotated ? rect?.height ?? window.innerHeight : rect?.width ?? window.innerWidth, height: rotated ? rect?.width ?? window.innerWidth : rect?.height ?? window.innerHeight, rotated, clearWidth:clearance?.width,chatLeft:clearance?.left||0,handInset };
      setFrame(current => current && Object.keys(next).every(key => current[key as keyof typeof next] === next[key as keyof typeof next]) ? current : next);
    };
    measure();observe(board);document.querySelectorAll('.nexora-arena-hand').forEach(observe);
    const animation=requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(animation);observer.disconnect(); window.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("resize", measure); };
  }, [arenaSelector, cinematicActive, rotateBreakpoint, layoutKey]);
  return frame ? createPortal(<div className="triad-battle-chat-hud-frame" style={{ left:frame.left,top:frame.top,width:frame.width,height:frame.height,transform:frame.rotated ? "rotate(90deg) translateY(-100%)" : "none", transformOrigin:"top left",'--chat-hand-inset':`${frame.handInset}px`,'--chat-clear-left':`${frame.chatLeft}px` } as CSSProperties} data-cinematic-chat={cinematicActive}><div style={{maxWidth:frame.clearWidth}}>{children}</div></div>, document.body) : null;
}
