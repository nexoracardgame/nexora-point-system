"use client";

import { Clock3, Flag, Layers3, LogOut, Swords } from "lucide-react";
import type { ReactNode } from "react";

export type ArenaCardFilter = "all" | "monster" | "skill";

export function BattleArenaStatus({ fight, turn, turns, title, hint, className = "" }: { fight: number; turn: number; turns: number; title: string; hint: string; className?: string }) {
  return <div className={`nexora-arena-status ${className}`}><span>ไฟต์ {fight}/3 · ตา {turn}/{turns}</span><strong>{title}</strong><span>{hint}</span></div>;
}

export function BattleArenaFormation({ upper, children, className = "", floating = false, side }: { upper: boolean; children: ReactNode; className?: string; floating?: boolean; side?: string }) {
  return <div className={`nexora-arena-formation ${className}`} data-upper={upper} data-floating={floating} data-pentad-side={side}>{children}</div>;
}

export function BattleArenaHeader({ title, code, time, onExit, onSurrender }: { title: string; code?: string; time: string; onExit: () => void; onSurrender?: () => void }) {
  return <header className="nexora-arena-header"><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME" /><div className="nexora-arena-brand"><small><Swords size={12} /> BATTLE ROOM</small><strong>{title}</strong></div>{code && <span className="nexora-arena-room-code">ห้อง {code}</span>}<div className="nexora-arena-header-actions"><span data-game-audio-slot /><span><Clock3 size={16} />{time}</span>{onSurrender && <button type="button" title="ยอมแพ้" aria-label="ยอมแพ้" onClick={onSurrender}><Flag size={20} /></button>}<button type="button" title="ออกจากห้อง" aria-label="ออกจากห้อง" onClick={onExit}><LogOut size={22} /></button></div></header>;
}

export function BattleArenaHand({ title, filter, onFilterChange, children }: { title: string; filter: ArenaCardFilter; onFilterChange: (filter: ArenaCardFilter) => void; children: ReactNode }) {
  return <section className="nexora-arena-hand"><div className="nexora-arena-hand-heading"><strong><Layers3 size={16} />{title}</strong><div className="nexora-arena-hand-filters" role="group" aria-label="กรองการ์ดบนมือ">{([["all", "ทั้งหมด"], ["monster", "มอนสเตอร์"], ["skill", "สกิล"]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => onFilterChange(value)}>{label}</button>)}</div></div><div className="nexora-arena-hand-cards">{children}</div></section>;
}
