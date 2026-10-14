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
    if (counts.get(no)! > 1) errors.push(`No.${no} ใช้ได้เพียง 1 ใบทั้งเด็ค`);
    if (elements.get(card.element)! > 6) errors.push(`ธาตุ${pentadElementNames[card.element]}เกิน 6 ใบ`);
  }
  return [...new Set(errors)];
}

export function makePentadPools(random: () => number = Math.random): PentadDeck {
  const pools = emptyPentadDeck();
  for (const element of pentadElements) {
    const shuffled = triadCards.filter(card => card.element === element).map(card => ({card,order:random()})).sort((a,b)=>a.order-b.order).map(item=>item.card);
    pools.monsters.push(...shuffled.filter(card=>card.kind === "monster").slice(0,4).map(card=>card.cardNo));
    const skills = shuffled.filter(card=>card.kind === "skill").slice(0,8).map(card=>card.cardNo);
    pools.hand.push(...skills.slice(0,4)); pools.reserve.push(...skills.slice(4,8));
  }
  return pools;
}

export function completePentadDeck(partial: PentadDeck, random: () => number = Math.random, pools?: PentadDeck): PentadDeck {
  const deck = emptyPentadDeck();
  const add = (group: keyof PentadDeck, no: string) => {
    const trial = { ...deck, [group]: [...deck[group], no] };
    if (validatePentadDeck(trial, true).length) return false;
    deck[group].push(no); return true;
  };
  for (const group of ["monsters", "hand", "reserve"] as const) for (const no of partial[group]) {
    if (pools && !pools[group].includes(no)) throw new Error("การ์ดไม่ได้อยู่ในพูลของกองนี้");
    if (!add(group, no)) throw new Error("เด็คมีการ์ดซ้ำหรือผิดกติกา");
  }
  const shuffled = triadCards.map(card => ({ card, order: random() })).sort((a, b) => a.order - b.order).map(item => item.card);
  const groups = ["monsters", "reserve", "hand"] as const;
  const failed = new Set<string>();
  const limits = { monsters:5, hand:15, reserve:10 };
  const domains = Object.fromEntries(groups.map(group => [group,shuffled.filter(card => card.kind === (group === "monsters" ? "monster" : "skill") && (!pools || pools[group].includes(card.cardNo)))])) as Record<keyof PentadDeck, typeof shuffled>;
  const search = (index: number): boolean => {
    if (index === groups.length) return validatePentadDeck(deck).length === 0;
    const group = groups[index];
    if (deck[group].length === limits[group]) return search(index+1);
    const all = [...deck.monsters,...deck.hand,...deck.reserve];
    const key = `${index}:${groups.map(group=>pentadElements.map(element=>deck[group].filter(no=>triadCardByNo.get(no)?.element===element).length).join(",")).join(";")}`;
    if (failed.has(key)) return false;
    for (const remaining of groups.slice(index)) {
      const available = domains[remaining].filter(card => !all.includes(card.cardNo));
      const capacity = pentadElements.reduce((sum,element) => sum+Math.min(6-all.filter(no=>triadCardByNo.get(no)?.element===element).length,available.filter(card=>card.element===element).length),0);
      if (capacity < limits[remaining]-deck[remaining].length) return false;
    }
    const tried = new Set<TriadElement>();
    for (const card of domains[group]) {
      if (tried.has(card.element) || !add(group,card.cardNo)) continue;
      if (search(index)) return true;
      deck[group].pop(); tried.add(card.element);
    }
    failed.add(key); return false;
  };
  if (!search(0)) throw new Error("ชุดนี้เติมเด็คให้ครบตามกติกาไม่ได้ กรุณาปรับการ์ดหรือธาตุในกอง");
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
  stages?: { title: string; detail: string }[];
};

export function comparePentadPower(attack: Record<PentadSide, number>, support: Record<PentadSide, number>, totalOnly = false): PentadSide | "draw" {
  const pairs = [[attack.host + support.host, attack.challenger + support.challenger], ...(!totalOnly ? [[attack.host, attack.challenger], [support.host, support.challenger]] : [])];
  for (const [a, b] of pairs) if (a !== b) return a > b ? "host" : "challenger";
  return "draw";
}

export function resolvePentadTurn(input: {
  fight: number; turn: PentadTurn; mains: Record<PentadSide, string>; skills: Record<PentadSide, string>;
  opener: PentadSide; targets?: Record<PentadSide, string>; copiedSkills?: Record<PentadSide, string>; finalDuel?: boolean; spent?: string[];
}): PentadResolution {
  const host = triadCardByNo.get(input.mains.host);
  const challenger = triadCardByNo.get(input.mains.challenger);
  if (host?.kind !== "monster" || challenger?.kind !== "monster") throw new Error("ต้องมีมอนสเตอร์หลักทั้งสองฝั่ง");
  const relation = pentadElementRelation(host.element, challenger.element);
  const basic = { attack: { host: host.attack, challenger: challenger.attack }, support: { host: host.support, challenger: challenger.support } };
  if (input.turn === 1 && relation.winner && !input.finalDuel) return {
    ...basic, winner: relation.winner, reason: `ธาตุ${pentadElementNames[triadCardByNo.get(input.mains[relation.winner])!.element]}ชนะธาตุ${pentadElementNames[triadCardByNo.get(input.mains[otherPentadSide(relation.winner)])!.element]}`,
    stages: [{ title: "เปิดมอนสเตอร์พร้อมกัน", detail: `ดิน น้ำ ไม้ ไฟ ทอง · วัดความสัมพันธ์ธาตุก่อนค่าพลัง` }, { title: "ธาตุพิชิต", detail: `ธาตุ${pentadElementNames[triadCardByNo.get(input.mains[relation.winner])!.element]}ชนะธาตุ${pentadElementNames[triadCardByNo.get(input.mains[otherPentadSide(relation.winner)])!.element]} ได้ 1 คะแนนทันที ไม่วัด ATK / SUP` }],
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
    combinedStatConditions: input.turn === 1,
    player: { top: host.cardNo, [turn === 2 ? "left" : "right"]: skills.host },
    opponent: { top: challenger.cardNo, [turn === 2 ? "left" : "right"]: skills.challenger },
    skillTargets: targets,
    copiedSkillCardNos: input.copiedSkills ? { player: input.copiedSkills.host, opponent: input.copiedSkills.challenger } : undefined,
    excludedRandomMonsterNos: input.spent,
    randomMonsterSeed: `pentad:${input.fight}:${input.turn}:${host.cardNo}:${challenger.cardNo}:${skills.host}:${skills.challenger}:${(input.spent || []).join(",")}`,
  });
  const metric = input.turn === 2 || input.turn === 3 ? "attack" : input.turn === 1 ? "total" : "support";
  const atk = metric !== "support" ? run(2) : null;
  const sup = metric !== "attack" ? run(3) : null;
  const attack = atk ? { host: atk.playerTotal, challenger: atk.opponentTotal } : basic.attack;
  const support = sup ? { host: sup.playerTotal, challenger: sup.opponentTotal } : basic.support;
  const totals = metric === "total" ? { host: attack.host + support.host, challenger: attack.challenger + support.challenger } : metric === "attack" ? attack : support;
  const winner = input.turn === 1 ? comparePentadPower(attack, support, input.finalDuel) : totals.host === totals.challenger ? "draw" : totals.host > totals.challenger ? "host" : "challenger";
  const metricEvents = [
    ...(atk?.skillEvents || []).filter(event => metric !== "total" || triadSkillRuleByNo.get(event.cardNo)?.allowedTurns.includes(2) !== false),
    ...(sup?.skillEvents || []).filter(event => metric !== "total" || triadSkillRuleByNo.get(event.cardNo)?.allowedTurns.includes(3) !== false),
  ];
  const events = metricEvents.filter((event, index, all) => all.findIndex(other => other.side === event.side && other.cardNo === event.cardNo && other.summary === event.summary) === index);
  const effective = atk || sup;
  const stages: NonNullable<PentadResolution["stages"]> = [];
  if (input.turn === 1 && !input.finalDuel) {
    stages.push({ title: "ตรวจความสัมพันธ์ธาตุ", detail: `ธาตุ${pentadElementNames[host.element]} ปะทะ ธาตุ${pentadElementNames[challenger.element]}` });
    if (relation.boosted) {
      const boosted = relation.boosted;
      const source = otherPentadSide(boosted);
      stages.push({ title: "ธาตุเสริมพลัง", detail: `ธาตุ${pentadElementNames[triadCardByNo.get(input.mains[source])!.element]}เสริมธาตุ${pentadElementNames[triadCardByNo.get(input.mains[boosted])!.element]} · จั่วกองเสริม 1 ใบ` });
      const drawn = triadCardByNo.get(input.skills[boosted]);
      stages.push({ title: drawn ? `จั่ว No.${drawn.cardNo} ${drawn.name}` : "กองเสริมหมด", detail: !drawn ? "ไม่มีสกิลเสริม วัดค่าพลังมอนสเตอร์" : !skills[boosted] ? "สกิลนี้ไม่ใช่การเพิ่มหรือลดค่าพลัง จึงไม่ทำงานตาแรก" : events.filter(event => event.side === (boosted === "host" ? "player" : "opponent")).map(event => event.summary).join(" · ") || "ตรวจเงื่อนไขสกิลก่อนวัดพลังรวม" });
    } else stages.push({ title: "ธาตุเดียวกัน", detail: "ไม่มีฝ่ายชนะด้วยธาตุ วัด ATK + SUP" });
    stages.push({ title: "เปรียบเทียบพลังรวม", detail: `${attack.host.toLocaleString()} + ${support.host.toLocaleString()} = ${totals.host.toLocaleString()} / ${attack.challenger.toLocaleString()} + ${support.challenger.toLocaleString()} = ${totals.challenger.toLocaleString()}` });
    if (totals.host === totals.challenger) stages.push({ title: "พลังรวมเสมอ · วัด ATK", detail: `${attack.host.toLocaleString()} / ${attack.challenger.toLocaleString()}` });
    if (totals.host === totals.challenger && attack.host === attack.challenger) stages.push({ title: "ATK เสมอ · วัด SUP", detail: `${support.host.toLocaleString()} / ${support.challenger.toLocaleString()}` });
    if (winner === "draw") stages.push({ title: "เสมอทุกค่า", detail: "ทิ้งมอนสเตอร์ทั้งสองฝ่าย เลือกตัวใหม่ ไม่มีเป่ายิงฉุบ" });
  }
  const reason = metric === "total" ? totals.host !== totals.challenger || input.finalDuel ? "พลังรวม ATK + SUP" : attack.host !== attack.challenger ? "ATK + SUP เท่ากัน ตัดสินด้วย ATK" : support.host !== support.challenger ? "ATK เท่ากัน ตัดสินด้วย SUP" : "ATK และ SUP เท่ากัน ต้องเลือกมอนสเตอร์ใหม่" : metric === "attack" ? "พลัง ATTACK" : "พลัง SUPPORT";
  return { winner, stages, reason, attack, support, totals, events, effective: { host: effective?.effectivePlayer.top || host.cardNo, challenger: effective?.effectiveOpponent.top || challenger.cardNo } };
}
