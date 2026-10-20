import type { ReactNode, HTMLAttributes } from "react";
import './BattleCardGeometry.css';
import BattleSkipSummary from './BattleSkipSummary';
import './BattleElementBoosts.css';
import {PREPARATION_WALLPAPER_POSTER} from '@/lib/home-wallpaper';
import BattlePlayerProfile,{type BattlePlayerIdentity,type BattlePlayerRank} from './BattlePlayerProfile';

export function BattleArenaSurface({ image, children, className = "", style, ...props }: HTMLAttributes<HTMLElement> & { image: string }) {
  const phase=(props as Record<string,unknown>)['data-heptad-phase']||(props as Record<string,unknown>)['data-pentad-phase'];
  const preparation=phase==='waiting'||phase==='entering'||className.includes('nexora-room-create-preview');
  const background=preparation?PREPARATION_WALLPAPER_POSTER:image;
  return <main {...props} className={`nexora-arena-surface ${className}`} style={{...style,backgroundImage:`linear-gradient(#05070865,#05070865),url('${background}')`,backgroundPosition:"center",backgroundSize:"cover"}}>{children}<BattleSkipSummary/></main>;
}

export function BattleArenaCardFrame({ children }: { children: ReactNode }) {
  return <span className="nexora-card-art-frame">{children}</span>;
}

export function BattleArenaScoreplate({ name, score, player, avatar,identity,rank,currentUserId }: { name: string; score: number; player?: boolean; avatar: ReactNode;identity?:BattlePlayerIdentity;rank?:BattlePlayerRank|null;currentUserId?:string }) {
  const info = <div className="min-w-0 max-w-[120px] sm:max-w-none"><div className="text-[9px] font-black uppercase">{player ? "เรา" : "คู่แข่ง"}</div><div className="truncate text-xs font-black text-white sm:text-base">{name}</div></div>;
  const points = <div className="nexora-arena-points grid shrink-0 place-items-center rounded-full font-black text-white">{score}</div>;
  if(identity)return <div className={`nexora-arena-scoreplate ${player?'triad-player-scoreplate':'triad-opponent-scoreplate'}`}>{player&&points}<BattlePlayerProfile identity={identity} rank={rank} player={player} currentUserId={currentUserId}/>{!player&&points}</div>;
  return <div className={`nexora-arena-scoreplate ${player ? "triad-player-scoreplate" : "triad-opponent-scoreplate"}`} title={name}>{player ? <>{points}{info}{avatar}</> : <>{avatar}{info}{points}</>}</div>;
}

export function BattleArenaPhaseTrack({ activeTurn, turns = 3 }: { activeTurn: number; turns?: number }) {
  const steps = ["เตรียม", ...Array.from({ length: turns }, (_, index) => `ตา ${index + 1}`), "จบ"];
  return <div className="triad-phase-track nexora-arena-phase-track"><div className="triad-phase-track-grid" style={{ gridTemplateColumns: `repeat(${steps.length},minmax(0,1fr))` }}>{steps.map((label, value) => <div key={label} className={`triad-phase-step ${value === activeTurn ? "nexora-phase-active" : ""}`}>{label}</div>)}</div></div>;
}

export function BattleArenaProgress({ fight, turn, turns, time, playerScore, opponentScore, scoreLabel = "คะแนนสะสม", wins }: { fight: number; turn: number; turns: number; time: string; playerScore: number; opponentScore: number; scoreLabel?: string; wins?: { player: number; opponent: number } }) {
  return <div className="nexora-arena-progress" aria-label="สถานะการต่อสู้"><span>ไฟต์ <b>{fight}/3</b></span><span>ตา <b>{turn}/{turns}</b></span><span>{scoreLabel} <b>{playerScore} : {opponentScore}</b></span>{wins && <span>ไฟต์ที่ชนะ <b>{wins.player} : {wins.opponent}</b></span>}<span>เวลา <b>{time}</b></span></div>;
}
