"use client";

import type { ReactNode } from "react";
import { Clock3, LogOut, Shuffle, Trash2 } from "lucide-react";
import GamePreparationBackground from "./GamePreparationBackground";

export const TRIAD_TITLE = "Triad Dominion (อำนาจสามผนึก) ฐาน 3 ใบ";
export const PENTAD_TITLE = "Pentad Dominion (อำนาจห้าผนึก) ฐาน 5 ใบ";

export function DeckPreparationTools({ disabled, onShuffle, onClear }: { disabled: boolean; onShuffle: () => void; onClear: () => void }) {
  return <div className="nexora-deck-tools"><button type="button" disabled={disabled} onClick={onShuffle} title="สุ่มจัดเด็คใหม่ทั้งชุด"><Shuffle size={18} />เติมเด็ค</button><button type="button" disabled={disabled} onClick={onClear} title="ล้างการ์ดที่เลือกทั้งหมด"><Trash2 size={18} />ล้างเด็ค</button></div>;
}

export function DeckPreparationHeader({ title, time, onExit }: { title: string; time: string; onExit: () => void }) {
  return <header className="nexora-deck-header"><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME" /><div><small>เตรียมสนาม</small><strong>{title}</strong></div><div className="nexora-deck-header-actions"><span data-game-audio-slot /><span><Clock3 size={16} />{time}</span><button type="button" aria-label="ออกจากห้อง" title="ออกจากห้อง" onClick={onExit}><LogOut /></button></div></header>;
}

export function DeckPreparationLayout({ tray, catalog, actions }: { tray: ReactNode; catalog: ReactNode; actions?: ReactNode }) {
  return <><GamePreparationBackground /><section className="nexora-deck-layout"><aside className="nexora-deck-tray">{tray}</aside><div className="nexora-deck-catalog">{catalog}</div><footer className="nexora-deck-actions">{actions}</footer></section></>;
}
