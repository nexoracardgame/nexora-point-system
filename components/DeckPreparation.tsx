"use client";

import type { ReactNode } from "react";
import { Clock3, LogOut } from "lucide-react";

export function DeckPreparationHeader({ title, time, onExit }: { title: string; time: string; onExit: () => void }) {
  return <header className="nexora-deck-header"><img src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME" /><div><small>เตรียมสนาม</small><strong>{title}</strong></div><div className="nexora-deck-header-actions"><span><Clock3 size={16} />{time}</span><button type="button" aria-label="ออกจากห้อง" title="ออกจากห้อง" onClick={onExit}><LogOut /></button></div></header>;
}

export function DeckPreparationLayout({ tray, catalog }: { tray: ReactNode; catalog: ReactNode }) {
  return <section className="nexora-deck-layout"><aside className="nexora-deck-tray">{tray}</aside><div className="nexora-deck-catalog">{catalog}</div></section>;
}
