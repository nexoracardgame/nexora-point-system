import { resolveTriadTurn, triadCardByNo, triadSkillRuleByNo, triadSkillElementConditionMatches, type TriadTriangle, type TriadTurn } from "./triad-dominion";
import {battleBotOutcome} from './battle-bot-evaluation';

export function botSkillTargets(no: string, own: TriadTriangle, enemy: TriadTriangle): string[] {
  const rule = triadSkillRuleByNo.get(no);
  if (!rule) return [""];
  if (no === "245") return [...new Set(Object.values(enemy))].flatMap(cardNo => {
    if (!cardNo || cardNo === "245" || triadCardByNo.get(cardNo)?.kind !== "skill") return [];
    return botSkillTargets(cardNo, own, enemy).map(target => `copy:${cardNo}${target ? `>${target}` : ""}`);
  });
  if (no === "254") return ["draw-skill", "reroll-own", "reroll-opponent"];
  if (no === "232") return ["player-top>bot-top", "bot-top>player-top"];
  const candidates = rule.target.startsWith("own") ? ["bot-top"] : rule.target.startsWith("opponent") ? ["player-top"] : ["bot-top", "player-top"];
  const legal = candidates.filter(target => {
    const card = triadCardByNo.get((target === "bot-top" ? own : enemy).top || "");
    return card && triadSkillElementConditionMatches(rule, card) && (no !== "225" || card.attack <= 5000) && (no !== "226" || card.attack <= 3000) && (no !== "227" || Math.max(card.attack,card.support)>7000) && (no !== "231" || card.attack!==card.support);
  });
  return legal.length ? legal : [""];
}

export function bestTriadBotPlay(turn: TriadTurn, enemy: TriadTriangle, own: TriadTriangle, candidates: string[], priority: "player" | "opponent" = "opponent") {
  const lane = turn === 1 ? "top" : turn === 2 ? "left" : "right";
  let best = { cardNo: "", target: "", score: -Infinity };
  for (const no of candidates) {
    const field = { ...own, [lane]: no };
    for (const target of botSkillTargets(no, field, enemy)) {
      const result = resolveTriadTurn({ turn, player: enemy, opponent: field, prioritySide: priority, skillTargets: { opponent: { [no]: target } }, randomMonsterSeed: `bot:${no}:${enemy.top}:${own.top}` });
      let future = 0;
      if (turn < 3) {
        const nextLane = turn === 1 ? "left" : "right";
        const nextTurn = (turn + 1) as TriadTurn;
        const followups = candidates.filter(other => other !== no && other !== own.top && other !== own.left && triadCardByNo.get(other)?.kind === (turn === 1 ? "monster" : triadCardByNo.get(no)?.kind));
        future = Math.max(0,...followups.slice(0,20).map(other => {
          const nextField={...field,[nextLane]:other};
          return Math.max(...botSkillTargets(other,nextField,enemy).map(nextTarget=>{
            const follow=resolveTriadTurn({turn:nextTurn,player:enemy,opponent:nextField,prioritySide:priority,skillTargets:{opponent:{[other]:nextTarget}}});
            return follow.winner==='opponent'?20_000:follow.winner==='draw'?5_000:0;
          }));
        }));
      }
      const score = battleBotOutcome(result.winner,'opponent',result.opponentTotal,result.playerTotal) + future;
      if (score > best.score) best = { cardNo:no, target, score };
    }
  }
  return best;
}
