import { triadCardByNo } from './triad-dominion';
import { rateMonster } from './game-monster-rating';

export type HeptadTurn = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type HeptadFight = 1 | 2 | 3;
export type HeptadTier = 'bronze' | 'silver' | 'gold' | 'all';
export type HeptadDeck = {
  monsters: string[];
  skills: string[];
  special: string[];
  skillReserve: string[];
  monsterReserve: string[];
};

// Confirmed rule contract. A live controller must enforce this server-side.
export const HEPTAD_RULES = {
  status: 'draft', fights: 3, turnsPerFight: 7, maximumScore: 21,
  cardsPerFight: 35, cardsPerMatch: 105,
  maximumSkillCopiesPerMatch: 1,
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
  { id: 'silver', title: 'SILVER', description: 'มอนสเตอร์เงิน · สกิลทุกระดับ' },
  { id: 'gold', title: 'GOLD', description: 'มอนสเตอร์ทอง · สกิลทุกระดับ' },
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
  // The room controller and full-match skill integration are not shipped yet.
  return false;
}

export const HEPTAD_SLOT_POSITIONS: Record<HeptadTurn, { x: number; y: number }> = {
  1: { x: 43.5, y: 0 },
  2: { x: 23, y: 35 },
  3: { x: 12.5, y: 70 },
  4: { x: 33.5, y: 70 },
  5: { x: 63, y: 35 },
  6: { x: 74.5, y: 70 },
  7: { x: 53.5, y: 70 },
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
  if (!HEPTAD_TIERS.some(item => item.id === tier)) return ['ระดับมอนสเตอร์ไม่ถูกต้อง'];
  const errors: string[] = [];
  const skills = new Set<string>();
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
        } else if (tier !== 'all' && rateMonster(card).tier !== tier) errors.push(`No.${no} ไม่อยู่ในระดับมอนสเตอร์ที่เลือก`);
      }
    }
  }
  return [...new Set(errors)];
}
