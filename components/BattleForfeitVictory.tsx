"use client";

import type { BattleForfeit } from "@/lib/battle-forfeit";
import BattleMatchResult from "./BattleMatchResult";

export default function BattleForfeitVictory({ result, userId, onExit }: { result?: BattleForfeit; userId: string; onExit: () => void }) {
  if (!result) return null;
  const won = result.winner.id === userId;
  return <BattleMatchResult key={result.at} title={won ? "คุณชนะ!" : `${result.winner.name} ชนะ`} detail="การต่อสู้สิ้นสุดจากการยอมแพ้หรือออกจากสนาม" onExit={onExit} />;
}
