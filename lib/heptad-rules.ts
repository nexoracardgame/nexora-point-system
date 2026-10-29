import { triadCardByNo, triadCards, type TriadCard } from './triad-dominion';
import { rateMonster } from './game-monster-rating';

export type HeptadTurn = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type HeptadFight = 1 | 2 | 3;
// Legacy tier IDs remain readable for saved rooms and older clients.
export type HeptadTier = 'bronze' | 'silver-gold' | 'silver' | 'gold' | 'all';
export function normalizeHeptadTier(tier:HeptadTier){return tier==='silver'||tier==='gold'?'silver-gold':tier;}
export function heptadMonsterAllowed(card:TriadCard,tier:HeptadTier){
  if(card.kind!=='monster')return false;
  const mode=normalizeHeptadTier(tier),rating=rateMonster(card).tier;
  return mode==='all'||(mode==='silver-gold'?(rating==='silver'||rating==='gold'):rating===mode);
}
export type HeptadDeck = {
  monsters: string[];
  skills: string[];
  special: string[];
  skillReserve: string[];
  monsterReserve: string[];
};

// Confirmed rule contract. A live controller must enforce this server-side.
export const HEPTAD_RULES = {
  status: 'active', fights: 3, turnsPerFight: 7, maximumScore: 21,
  cardsPerFight: 35, cardsPerMatch: 105,
  maximumSkillCopiesPerMatch: 1,
  maximumMonsterCopiesPerMatch: 1,
  deckSizes: { monsters: 10, skills: 10, special: 5, skillReserve: 5, monsterReserve: 5 },
  specialTurns: [2, 3, 4, 5, 6],
  unresolved: [],
  skillDuration: 'current-turn-only',
  includeBranchMonsterPower: true,
  finalTieBreak: 'remaining-monster-attack-plus-support',
  noRemainingMonsters: 'draw',
} as const;

export const HEPTAD_TURNS = [
  { turn: 1, kind: 'monster', metric: 'combined', elementClash: true, slot: 'main' },
  { turn: 2, kind: 'monster', metric: 'attack', elementClash: true, slot: 'attack-monster' },
  { turn: 3, kind: 'skill', metric: 'attack', elementClash: false, slot: 'attack-left' },
  { turn: 4, kind: 'skill', metric: 'attack', elementClash: false, slot: 'attack-right' },
  { turn: 5, kind: 'monster', metric: 'support', elementClash: true, slot: 'support-monster' },
  { turn: 6, kind: 'skill', metric: 'support', elementClash: false, slot: 'support-right' },
  { turn: 7, kind: 'skill', metric: 'support', elementClash: false, slot: 'support-left' },
] as const;

export const HEPTAD_TIERS = [
  { id: 'bronze', title: 'BRONZE', description: 'มอนสเตอร์บรอนซ์ · สกิลทุกระดับ' },
  { id: 'silver-gold', title: 'SILVER + GOLD', description: 'มอนสเตอร์เงินและทอง · สกิลทุกระดับ' },
  { id: 'all', title: 'ALL', description: 'มอนสเตอร์รวมทุกระดับ · สกิลทุกระดับ' },
];

export const emptyHeptadDeck = (): HeptadDeck => ({ monsters: [], skills: [], special: [], skillReserve: [], monsterReserve: [] });
export function heptadCanCallSpecial(fight: HeptadFight, turn: HeptadTurn, used: number) {
  return Number.isInteger(used) && used >= 0 && turn >= 2 && turn <= 6 && used < fight;
}
export function heptadCardRemaining(deck: readonly string[], used: readonly string[], no: string) {
  return deck.filter(card => card === no).length > used.filter(card => card === no).length;
}
export function heptadCanStart(): boolean {
  return true;
}

export function completeHeptadMatchDeck(partial: HeptadDeck[], tier: HeptadTier, random: () => number = Math.random): HeptadDeck[] {
  const errors=validateHeptadMatchDeck(partial,tier,true);
  if(errors.length)throw Error(errors.join(' / '));
  const decks=structuredClone(partial);
  const selectedSkills=new Set(decks.flatMap(deck=>[...deck.skills,...deck.special,...deck.skillReserve]));
  const selectedMonsters=new Set(decks.flatMap(deck=>[...deck.monsters,...deck.monsterReserve]));
  const shuffled=triadCards.map(card=>({card,order:random()})).sort((a,b)=>a.order-b.order).map(item=>item.card);
  const skills=shuffled.filter(card=>card.kind==='skill'&&!selectedSkills.has(card.cardNo));
  const monsters=shuffled.filter(card=>!selectedMonsters.has(card.cardNo)&&heptadMonsterAllowed(card,tier));
  const required=decks.reduce((total,deck)=>total+HEPTAD_RULES.deckSizes.monsters-deck.monsters.length+HEPTAD_RULES.deckSizes.monsterReserve-deck.monsterReserve.length,0);
  if(monsters.length<required)throw Error('มอนสเตอร์ระดับนี้มีไม่ครบ 45 แบบสำหรับชุด 105 ใบที่ห้ามซ้ำ');
  for(const deck of decks)for(const [key,limit] of Object.entries(HEPTAD_RULES.deckSizes)){
    const group=key as keyof HeptadDeck;
    const monster=group==='monsters'||group==='monsterReserve';
    while(deck[group].length<limit){
      const card=monster?monsters.shift():skills.shift();
      if(!card)throw Error('การ์ดสกิลไม่พอสำหรับเด็ค 105 ใบ');
      deck[group].push(card.cardNo);
    }
  }
  const invalid=validateHeptadMatchDeck(decks,tier);if(invalid.length)throw Error(invalid.join(' / '));
  return decks;
}

export const HEPTAD_SLOT_POSITIONS: Record<HeptadTurn, { x: number; y: number }> = {
  1: { x: 43.5, y: 0 },
  2: { x: 23, y: 35 },
  3: { x: 33.5, y: 70 },
  4: { x: 12.5, y: 70 },
  5: { x: 63, y: 35 },
  6: { x: 53.5, y: 70 },
  7: { x: 74.5, y: 70 },
};

export type HeptadBoard = Partial<Record<HeptadTurn, string>>;
export function heptadTurnCards(board: HeptadBoard, turn: HeptadTurn) {
  const main = board[1] || '';
  const branch = turn === 1 ? '' : board[turn <= 4 ? 2 : 5] || '';
  const skill = HEPTAD_TURNS[turn - 1].kind === 'skill' ? board[turn] || '' : '';
  return { main, branch, skill };
}

export function heptadBasePower(board: HeptadBoard, turn: HeptadTurn) {
  const cards = heptadTurnCards(board, turn);
  const metric = HEPTAD_TURNS[turn - 1].metric;
  return [cards.main, cards.branch].reduce((total, no) => {
    const card = triadCardByNo.get(no);
    if (card?.kind !== 'monster') return total;
    return total + (metric === 'combined' ? card.attack + card.support : card[metric]);
  }, 0);
}


export function validateHeptadMatchDeck(value: unknown, tier: HeptadTier, partial = false): string[] {
  if (!Array.isArray(value) || value.length !== 3) return ['ต้องจัดเด็คแยก 3 ไฟต์'];
  if (!HEPTAD_TIERS.some(item => item.id === normalizeHeptadTier(tier))) return ['ระดับมอนสเตอร์ไม่ถูกต้อง'];
  const errors: string[] = [];
  const skills = new Set<string>();
  const monsters = new Set<string>();
  for (const [index, raw] of value.entries()) {
    if (!raw || typeof raw !== 'object') { errors.push(`ไฟต์ ${index + 1}: ข้อมูลเด็คไม่ถูกต้อง`); continue; }
    for (const [key, size] of Object.entries(HEPTAD_RULES.deckSizes)) {
      const cards: unknown = raw[key];
      if (!Array.isArray(cards) || cards.some(no => typeof no !== 'string')) { errors.push(`ไฟต์ ${index + 1}: กอง ${key} ไม่ถูกต้อง`); continue; }
      if (cards.length > size || !partial && cards.length !== size) errors.push(`ไฟต์ ${index + 1}: กอง ${key} ต้องมี ${size} ใบ`);
      const kind = key === 'monsters' || key === 'monsterReserve' ? 'monster' : 'skill';
      for (const no of cards) {
        const card = triadCardByNo.get(no);
        if (!card || card.kind !== kind) { errors.push(`ไฟต์ ${index + 1}: No.${no} ประเภทไม่ตรงกับกอง`); continue; }
        if (kind === 'skill') {
          if (skills.has(no)) errors.push(`No.${no} ใช้สกิลได้ 1 ใบเท่านั้นในชุด 105 ใบ`);
          skills.add(no);
        } else {
          if(monsters.has(no))errors.push(`No.${no} ใช้มอนสเตอร์ได้ 1 ใบเท่านั้นในชุด 105 ใบ รวมกองสำรองทุกไฟต์`);
          monsters.add(no);
          if(!heptadMonsterAllowed(card,tier))errors.push(`No.${no} ไม่อยู่ในระดับมอนสเตอร์ที่เลือก`);
        }
      }
    }
  }
  return [...new Set(errors)];
}
