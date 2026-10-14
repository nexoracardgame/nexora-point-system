import type { ReactNode } from "react";

export function BattleArenaScoreplate({ name, score, player, avatar }: { name: string; score: number; player?: boolean; avatar: ReactNode }) {
  const info = <div className="min-w-0 max-w-[120px] sm:max-w-none"><div className="text-[9px] font-black uppercase">{player ? "เรา" : "คู่แข่ง"}</div><div className="truncate text-xs font-black text-white sm:text-base">{name}</div></div>;
  const points = <div className="nexora-arena-points grid shrink-0 place-items-center rounded-full font-black text-white">{score}</div>;
  return <div className={`nexora-arena-scoreplate ${player ? "triad-player-scoreplate" : "triad-opponent-scoreplate"}`} title={name}>{player ? <>{points}{info}{avatar}</> : <>{avatar}{info}{points}</>}</div>;
}

export function BattleArenaPhaseTrack({ activeTurn, turns = 3 }: { activeTurn: number; turns?: number }) {
  const steps = ["เตรียม", ...Array.from({ length: turns }, (_, index) => `ตา ${index + 1}`), "จบ"];
  return <div className="triad-phase-track nexora-arena-phase-track"><div className="triad-phase-track-grid" style={{ gridTemplateColumns: `repeat(${steps.length},minmax(0,1fr))` }}>{steps.map((label, value) => <div key={label} className={`triad-phase-step ${value === activeTurn ? "nexora-phase-active" : ""}`}>{label}</div>)}</div></div>;
}
