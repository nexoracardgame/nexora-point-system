import { triadCardByNo } from "./triad-dominion";
import type { PentadSide } from "./pentad-dominion";

export const PENTAD_ELEMENT_REVEAL_MS = 1800;
export const PENTAD_ELEMENT_HOLD_MS = 6000;
export const PENTAD_ELEMENT_SCENE_MS = PENTAD_ELEMENT_REVEAL_MS + PENTAD_ELEMENT_HOLD_MS;

export function hasPentadElementClash(round: { turn: number; finalDuel?: boolean; mains: Record<PentadSide, string> }) {
  return round.turn === 1 && !round.finalDuel && (["host", "challenger"] as const).every(side => {
    const card = triadCardByNo.get(round.mains[side]);
    return card?.kind === "monster" && card.element !== "unknown";
  });
}
