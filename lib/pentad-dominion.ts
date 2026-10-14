import { resolveTriadTurn, triadCardByNo, triadCards, triadSkillRuleByNo, type TriadElement, type TriadTurnResult } from "./triad-dominion";

export type PentadSide = "host" | "challenger";
export type PentadTurn = 1 | 2 | 3 | 4 | 5;
export type PentadDeck = { monsters: string[]; hand: string[]; reserve: string[] };
export const PENTAD_DECK_MS = 600_000;
export const PENTAD_TURN_MS = 120_000;
export const PENTAD_TARGET_MS = 30_000;
export const pentadElements: TriadElement[] = ["earth", "water", "wood", "fire", "gold"];
export const pentadElementNames: Record<TriadElement, string> = { earth: "ดิน", water: "น้ำ", wood: "ไม้", fire: "ไฟ", gold: "ทอง", unknown: "ไม่ทราบ" };
const conquers: Partial<Record<TriadElement, TriadElement>> = { wood: "earth", earth: "water", water: "fire", fire: "gold", gold: "wood" };
const nourishes: Partial<Record<TriadElement, TriadElement>> = { water: "wood", wood: "fire", fire: "earth", earth: "gold", gold: "water" };
export const otherPentadSide = (side: PentadSide): PentadSide => side === "host" ? "challenger" : "host";
export const emptyPentadDeck = (): PentadDeck => ({ monsters: [], hand: [], reserve: [] });

export function pentadElementRelation(host: TriadElement, challenger: TriadElement) {
  if (conquers[host] === challenger) return { winner: "host" as PentadSide, boosted: null };
  if (conquers[challenger] === host) return { winner: "challenger" as PentadSide, boosted: null };
  if (nourishes[host] === challenger) return { winner: null, boosted: "challenger" as PentadSide };
  if (nourishes[challenger] === host) return { winner: null, boosted: "host" as PentadSide };
  return { winner: null, boosted: null };
}

export function validatePentadDeck(deck: PentadDeck, partial = false): string[] {
  const errors: string[] = [];
  const groups = [[deck.monsters, "monster", 5], [deck.hand, "skill", 15], [deck.reserve, "skill", 10]] as const;
  for (const [cards, kind, limit] of groups) {
    if (cards.length > limit || (!partial && cards.length !== limit)) errors.push(`${kind === "monster" ? "มอนสเตอร์" : limit === 15 ? "สกิลบนมือ" : "กองเสริม"} ต้องมี ${limit} ใบ`);
    if (cards.some(no => triadCardByNo.get(no)?.kind !== kind)) errors.push("ประเภทการ์ดไม่ตรงกับกอง");
  }
  const all = [...deck.monsters, ...deck.hand, ...deck.reserve];
  const counts = new Map<string, number>();
  const elements = new Map<TriadElement, number>();
  for (const no of all) {
    counts.set(no, (counts.get(no) || 0) + 1);
    const card = triadCardByNo.get(no);
    if (!card || card.element === "unknown") { errors.push(`ไม่พบข้อมูลการ์ด ${no}`); continue; }
    elements.set(card.element, (elements.get(card.element) || 0) + 1);
    if (counts.get(no)! > (card.kind === "skill" ? 2 : 1)) errors.push(`No.${no} เกินจำนวนซ้ำที่อนุญาต`);
    if (elements.get(card.element)! > 6) errors.push(`ธาตุ${pentadElementNames[card.element]}เกิน 6 ใบ`);
  }
  return [...new Set(errors)];
}

export function completePentadDeck(partial: PentadDeck, random: () => number = Math.random): PentadDeck {
  const deck = emptyPentadDeck();
  const add = (group: keyof PentadDeck, no: string) => {
    const trial = { ...deck, [group]: [...deck[group], no] };
    if (validatePentadDeck(trial, true).length) return false;
    deck[group].push(no); return true;
  };
  for (const group of ["monsters", "hand", "reserve"] as const) for (const no of partial[group]) add(group, no);
  const shuffled = triadCards.map(card => ({ card, order: random() })).sort((a, b) => a.order - b.order).map(item => item.card);
  // Fill missing monster elements first so skill-heavy partial decks remain completable.
  for (const group of ["monsters", "reserve", "hand"] as const) {
    const limit = group === "monsters" ? 5 : group === "hand" ? 15 : 10;
    for (const card of shuffled) {
      if (deck[group].length === limit) break;
      if (card.kind !== (group === "monsters" ? "monster" : "skill")) continue;
      add(group, card.cardNo);
      if (group !== "monsters" && deck[group].length < limit) add(group, card.cardNo);
    }
  }
  if (validatePentadDeck(deck).length) {
    // A partial allocation can consume every slot of an element before its monster is picked.
    if ([...partial.monsters, ...partial.hand, ...partial.reserve].length) return completePentadDeck(emptyPentadDeck(), random);
    throw new Error("ไม่สามารถเติมเด็คตามกติกาได้");
  }
  return deck;
}

export type PentadResolution = {
  winner: PentadSide | "draw";
  reason: string;
  attack: Record<PentadSide, number>;
  support: Record<PentadSide, number>;
  totals: Record<PentadSide, number>;
  events: TriadTurnResult["skillEvents"];
  effective: Record<PentadSide, string>;
};

export function comparePentadPower(attack: Record<PentadSide, number>, support: Record<PentadSide, number>, totalOnly = false): PentadSide | "draw" {
  const pairs = [[attack.host + support.host, attack.challenger + support.challenger], ...(!totalOnly ? [[attack.host, attack.challenger], [support.host, support.challenger]] : [])];
  for (const [a, b] of pairs) if (a !== b) return a > b ? "host" : "challenger";
  return "draw";
}

export function resolvePentadTurn(input: {
  fight: number; turn: PentadTurn; mains: Record<PentadSide, string>; skills: Record<PentadSide, string>;
  opener: PentadSide; targets?: Record<PentadSide, string>; finalDuel?: boolean; spent?: string[];
}): PentadResolution {
  const host = triadCardByNo.get(input.mains.host);
  const challenger = triadCardByNo.get(input.mains.challenger);
  if (host?.kind !== "monster" || challenger?.kind !== "monster") throw new Error("ต้องมีมอนสเตอร์หลักทั้งสองฝั่ง");
  const relation = pentadElementRelation(host.element, challenger.element);
  const basic = { attack: { host: host.attack, challenger: challenger.attack }, support: { host: host.support, challenger: challenger.support } };
  if (input.turn === 1 && relation.winner && !input.finalDuel) return {
    ...basic, winner: relation.winner, reason: `ธาตุ${pentadElementNames[triadCardByNo.get(input.mains[relation.winner])!.element]}ชนะธาตุ`,
    totals: { host: host.attack + host.support, challenger: challenger.attack + challenger.support }, events: [], effective: { ...input.mains },
  };
  const skills = { ...input.skills };
  if (input.turn === 1) for (const side of ["host", "challenger"] as const) {
    const rule = triadSkillRuleByNo.get(skills[side]);
    if (input.finalDuel || !rule || rule.shape !== "stat" || !rule.effects.length) skills[side] = "";
  }
  const targets = {
    player: { [skills.host]: input.targets?.host || "" },
    opponent: { [skills.challenger]: input.targets?.challenger || "" },
  };
  const run = (turn: 2 | 3) => resolveTriadTurn({
    turn, prioritySide: input.opener === "host" ? "player" : "opponent",
    player: { top: host.cardNo, [turn === 2 ? "left" : "right"]: skills.host },
    opponent: { top: challenger.cardNo, [turn === 2 ? "left" : "right"]: skills.challenger },
    skillTargets: targets,
    excludedRandomMonsterNos: input.spent,
    randomMonsterSeed: `pentad:${input.fight}:${input.turn}:${host.cardNo}:${challenger.cardNo}:${skills.host}:${skills.challenger}:${(input.spent || []).join(",")}`,
  });
  const metric = input.turn === 2 || input.turn === 3 ? "attack" : input.turn === 1 || (input.fight === 3 && input.turn === 4) ? "total" : "support";
  const atk = metric !== "support" ? run(2) : null;
  const sup = metric !== "attack" ? run(3) : null;
  const attack = atk ? { host: atk.playerTotal, challenger: atk.opponentTotal } : basic.attack;
  const support = sup ? { host: sup.playerTotal, challenger: sup.opponentTotal } : basic.support;
  const totals = metric === "total" ? { host: attack.host + support.host, challenger: attack.challenger + support.challenger } : metric === "attack" ? attack : support;
  const winner = input.turn === 1 ? comparePentadPower(attack, support, input.finalDuel) : totals.host === totals.challenger ? "draw" : totals.host > totals.challenger ? "host" : "challenger";
  const metricEvents = [
    ...(atk?.skillEvents || []).filter(event => triadSkillRuleByNo.get(event.cardNo)?.allowedTurns.includes(2) !== false),
    ...(sup?.skillEvents || []).filter(event => triadSkillRuleByNo.get(event.cardNo)?.allowedTurns.includes(3) !== false),
  ];
  const events = metricEvents.filter((event, index, all) => all.findIndex(other => other.side === event.side && other.cardNo === event.cardNo && other.summary === event.summary) === index);
  const effective = atk || sup;
  return { winner, reason: metric === "total" ? "พลังรวม ATK + SUP" : metric === "attack" ? "พลัง ATTACK" : "พลัง SUPPORT", attack, support, totals, events, effective: { host: effective?.effectivePlayer.top || host.cardNo, challenger: effective?.effectiveOpponent.top || challenger.cardNo } };
}
