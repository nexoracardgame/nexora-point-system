"use client";

import { useState, type CSSProperties } from 'react';
import { triadCardByNo } from '@/lib/triad-dominion';
import { HEPTAD_SLOT_POSITIONS, HEPTAD_TURNS, type HeptadBoard, type HeptadTurn } from '@/lib/heptad-rules';
import { useCardGesture } from '@/lib/use-card-gesture';
import { pentadElementNames } from '@/lib/pentad-dominion';
import BattleCardInspector from './BattleCardInspector';
import { BattleArenaCardFrame } from './BattleArenaHud';
import './HeptadArenaBoard.css';

type Side = 'host' | 'challenger';
type Props = {
  board: Record<Side, HeptadBoard>;
  names: Record<Side, string>;
  activeTurn: HeptadTurn;
  playerSide?: Side;
  onChooseSlot?: (turn: HeptadTurn) => void;
};

function Slot({ no, turn, active, onChoose, onPreview, onPreviewEnd }: {
  no: string; turn: HeptadTurn; active: boolean;
  onChoose?: () => void; onPreview: () => void; onPreviewEnd: () => void;
}) {
  const card = triadCardByNo.get(no);
  const position = HEPTAD_SLOT_POSITIONS[turn];
  const gesture = useCardGesture({ onChoose, onPreview, onPreviewEnd });
  return <button {...gesture} type="button" className="heptad-slot" data-turn={turn} data-active={active}
    data-card-no={card?.cardNo || ''} data-hidden={no === 'hidden'}
    style={{ '--slot-x': `${position.x}%`, '--slot-y': `${position.y}%` } as CSSProperties}
    aria-label={`ตา ${turn} · ${card?.name || (no === 'hidden' ? 'การ์ดคว่ำ' : HEPTAD_TURNS[turn - 1].kind === 'monster' ? 'มอนสเตอร์' : 'สกิล')}`}>
    {card ? <BattleArenaCardFrame><img src={card.sourceImage} alt={card.name} draggable={false} /></BattleArenaCardFrame>
      : no === 'hidden' ? <BattleArenaCardFrame><img src="/cards/card-backs/card-backs.png" alt="การ์ดคว่ำ" draggable={false} /></BattleArenaCardFrame>
        : <span className="heptad-slot-number">{turn}</span>}
  </button>;
}

export default function HeptadArenaBoard({ board, names, activeTurn, playerSide, onChooseSlot }: Props) {
  const [preview, setPreview] = useState('');
  const card = triadCardByNo.get(preview);
  const order: Side[] = playerSide === 'challenger' ? ['host', 'challenger'] : ['challenger', 'host'];
  return <section className="heptad-arena-board" aria-label="สนาม HEPTAD 7 ใบ">
    {order.map(side => <section key={side} className="heptad-arena-side" data-side={side} data-player={side === playerSide} aria-label={names[side]}>
      <header>{names[side]}</header>
      <div className="heptad-formation">
        {HEPTAD_TURNS.map(({ turn }) => <Slot key={turn} turn={turn} no={board[side][turn] || ''} active={turn === activeTurn}
          onChoose={side === playerSide && turn === activeTurn && !board[side][turn] && onChooseSlot ? () => onChooseSlot(turn) : undefined}
          onPreview={() => setPreview(board[side][turn] || '')} onPreviewEnd={() => setPreview('')} />)}
      </div>
    </section>)}
    {card && <BattleCardInspector card={card} element={`ธาตุ${pentadElementNames[card.element]}`} interactive={false} onClose={() => setPreview('')} />}
  </section>;
}
