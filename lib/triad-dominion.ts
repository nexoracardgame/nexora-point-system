import bundledCardSkillDbJson from "@/public/cards/card-skill-db.json";

export type TriadElement = "earth" | "fire" | "gold" | "wood" | "water" | "unknown";
export type TriadCardKind = "monster" | "skill" | "unknown";
export type TriadLane = "top" | "left" | "right";
export type TriadTurn = 1 | 2 | 3;
export type TriadMetric = "attack" | "support";
export type TriadSkillShape =
  | "stat"
  | "block-stat-gain"
  | "element-transform"
  | "swap-control"
  | "unparsed";

type SourceCard = {
  cardNo: string;
  cardName: string;
  skill?: string;
  atk?: string;
  sup?: string;
  element?: string;
  rarity?: string;
  type?: string;
  rawText?: string;
  notes?: string;
  sourceImage?: string;
  confidence?: string;
};

export type TriadCard = {
  cardNo: string;
  name: string;
  kind: TriadCardKind;
  attack: number;
  support: number;
  element: TriadElement;
  skillText: string;
  sourceImage: string;
};

export type TriadSkillEffect = {
  metric: TriadMetric;
  delta: number;
};

export type TriadSkillRule = {
  cardNo: string;
  name: string;
  shape: TriadSkillShape;
  effects: TriadSkillEffect[];
  target:
    | "own-main"
    | "own-one"
    | "own-all"
    | "opponent-main"
    | "opponent-one"
    | "opponent-all"
    | "any-one"
    | "all";
  duration: "turn";
  allowedTurns: TriadTurn[];
  elementHint: TriadElement;
  blockedMetric?: TriadMetric;
  transformElement?: TriadElement;
  needsReview: boolean;
  reviewReason?: string;
  text: string;
};

export type TriadDeckValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  counts: {
    total: number;
    monsters: number;
    skills: number;
    byElement: Record<TriadElement, number>;
  };
};

export type TriadTriangle = {
  top: string;
  left?: string;
  right?: string;
};

export type TriadTurnInput = {
  turn: TriadTurn;
  player: TriadTriangle;
  opponent: TriadTriangle;
};

export type TriadTurnResult = {
  turn: TriadTurn;
  metric: "total" | TriadMetric;
  playerTotal: number;
  opponentTotal: number;
  winner: "player" | "opponent" | "draw";
  playerBreakdown: string[];
  opponentBreakdown: string[];
  unresolvedSkills: TriadSkillRule[];
};

const sourceCards = ((bundledCardSkillDbJson as { cards?: SourceCard[] }).cards || []).filter(
  Boolean
);

function normalizeCardNo(value: string | number) {
  return String(value).replace(/\D/g, "").padStart(3, "0").slice(-3);
}

function parseNumber(value?: string) {
  const numeric = Number.parseInt(String(value || "").replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(numeric) ? numeric : 0;
}

function inferElementFromCardNo(cardNo: string): TriadElement {
  const numeric = Number.parseInt(normalizeCardNo(cardNo), 10);
  if (!Number.isFinite(numeric)) return "unknown";

  const specialElements: Partial<Record<number, TriadElement>> = {
    1: "earth",
    2: "fire",
    3: "gold",
    4: "wood",
    5: "water",
    6: "fire",
    7: "earth",
    8: "water",
    9: "wood",
    10: "gold",
    11: "earth",
    12: "fire",
    13: "gold",
    14: "wood",
    15: "water",
    16: "earth",
    17: "fire",
    18: "gold",
    19: "wood",
    20: "water",
  };
  if (specialElements[numeric]) return specialElements[numeric];

  if (numeric >= 21 && numeric <= 60) return "earth";
  if (numeric >= 61 && numeric <= 99) return "gold";
  if (numeric >= 100 && numeric <= 138) return "water";
  if (numeric >= 139 && numeric <= 176) return "fire";
  if (numeric >= 177 && numeric <= 215) return "wood";
  if (numeric >= 216 && numeric <= 233) return "earth";
  if (numeric >= 234 && numeric <= 248) return "gold";
  if (numeric >= 249 && numeric <= 263) return "water";
  if (numeric >= 264 && numeric <= 278) return "fire";
  if (numeric >= 279 && numeric <= 293) return "wood";

  return "unknown";
}

function normalizeElement(value?: string, cardNo?: string): TriadElement {
  if (cardNo) {
    const elementFromCardNo = inferElementFromCardNo(cardNo);
    if (elementFromCardNo !== "unknown") return elementFromCardNo;
  }

  const raw = String(value || "").toLowerCase();
  if (/earth|stone|rock|sand|orange|triangle|ปฐพี|ดิน|หิน/.test(raw)) return "earth";
  if (/fire|flame|inferno|red|อัคคี|ไฟ/.test(raw)) return "fire";
  if (/gold|coin|yellow|aura|metal|ทอง/.test(raw)) return "gold";
  if (/nature|wood|green|leaf|plant|forest|spade|พฤกษ|ไม้/.test(raw)) return "wood";
  if (/water|ocean|blue|วารี|น้ำ/.test(raw)) return "water";
  return "unknown";
}

function getKind(card: SourceCard): TriadCardKind {
  const hasSkill = Boolean(String(card.skill || "").trim());
  const hasStats = parseNumber(card.atk) > 0 || parseNumber(card.sup) > 0;
  if (hasSkill && !hasStats) return "skill";
  if (hasStats && !hasSkill) return "monster";
  if (hasSkill) return "skill";
  if (hasStats) return "monster";
  return "unknown";
}

export const triadCards: TriadCard[] = sourceCards.map((card) => ({
  cardNo: normalizeCardNo(card.cardNo),
  name: String(card.cardName || `Card ${card.cardNo}`).trim(),
  kind: getKind(card),
  attack: parseNumber(card.atk),
  support: parseNumber(card.sup),
  element: normalizeElement(
    `${card.element || ""} ${card.type || ""} ${card.cardName || ""} ${card.rawText || ""} ${card.notes || ""}`,
    card.cardNo
  ),
  skillText: String(card.skill || "").replace(/\s+/g, " ").trim(),
  sourceImage: card.sourceImage || `/cards/${normalizeCardNo(card.cardNo)}.jpg`,
}));

export const triadCardByNo = new Map(triadCards.map((card) => [card.cardNo, card]));

function statEffects(text: string): TriadSkillEffect[] {
  const effects: TriadSkillEffect[] = [];
  const pattern = /\b(ATTACK|SUPPORT|SUP)\s*([+-])\s*(\d{2,5})\b/gi;
  for (const match of text.matchAll(pattern)) {
    const metric: TriadMetric = match[1].toUpperCase() === "ATTACK" ? "attack" : "support";
    const amount = Number.parseInt(match[3], 10);
    if (Number.isFinite(amount)) {
      effects.push({ metric, delta: match[2] === "-" ? -amount : amount });
    }
  }
  return effects;
}

function inferTarget(text: string): TriadSkillRule["target"] {
  if (/มอนสเตอร์ของฝ่ายตรงข้ามทุกใบ|ฝ่ายตรงข้ามทุกใบ/.test(text)) return "opponent-all";
  if (/ของฝ่ายตรงข้าม|ฝ่ายตรงข้าม/.test(text)) return "opponent-one";
  if (/บนสนามเราทุกใบ|ของเราทุกใบ|เรา ทุกใบ/.test(text)) return "own-all";
  if (/บนสนามใครก็ได้|ใครก็ได้/.test(text)) return "any-one";
  if (/มอนสเตอร์ทั้งหมด|ทุกใบ/.test(text)) return "all";
  if (/เลือกมอนสเตอร์ บนสนามเรา|บนสนามเรา 1 ใบ|ของเรา 1 ใบ/.test(text)) return "own-one";
  return "own-main";
}

function inferAllowedTurns(text: string, shape: TriadSkillShape): TriadTurn[] {
  if (shape === "unparsed") return [2, 3];
  if (/SUPPORT|SUP\b/i.test(text) && !/ATTACK/i.test(text)) return [3];
  if (/ATTACK/i.test(text) && !/SUPPORT|SUP\b/i.test(text)) return [2];
  return [2, 3];
}

function inferSkillShape(text: string, effects: TriadSkillEffect[]): TriadSkillShape {
  if (/ไม่สามารถเพิ่มค่า\s*ATTACK|cannot increase ATTACK/i.test(text)) return "block-stat-gain";
  if (/ไม่สามารถเพิ่มค่า\s*SUPPORT|ไม่สามารถเพิ่มค่า\s*SUP|cannot increase SUPPORT/i.test(text)) {
    return "block-stat-gain";
  }
  if (/ธาตุของมอนสเตอร์ทั้งหมด|กลายเป็น/.test(text)) return "element-transform";
  if (/สลับตำแหน่ง|นำมาใช้งานในตานี้/.test(text)) return "swap-control";
  if (effects.length > 0) return "stat";
  return "unparsed";
}

function inferTransformElement(text: string): TriadElement | undefined {
  if (/\[?Fire|red\/ora|ไฟ/.test(text)) return "fire";
  if (/\[?Water|น้ำ|วารี/.test(text)) return "water";
  if (/\[?Green|ไม้|พฤกษ/.test(text)) return "wood";
  if (/\[?Gold|ทอง/.test(text)) return "gold";
  if (/\[?Earth|ดิน|ปฐพี|หิน/.test(text)) return "earth";
  return undefined;
}

function makeSkillRule(card: TriadCard): TriadSkillRule | null {
  if (card.kind !== "skill") return null;

  const effects = statEffects(card.skillText);
  const shape = inferSkillShape(card.skillText, effects);
  const blockedMetric = /ATTACK/i.test(card.skillText)
    ? "attack"
    : /SUPPORT|SUP\b/i.test(card.skillText)
      ? "support"
      : undefined;
  const needsReview =
    shape === "unparsed" ||
    shape === "swap-control" ||
    shape === "element-transform" ||
    /ไม่ใช่|หรือมากกว่า|หรือต่ำกว่า|จบไฟต์|ยกเลิก|ทำลาย/.test(card.skillText);

  return {
    cardNo: card.cardNo,
    name: card.name,
    shape,
    effects,
    target: inferTarget(card.skillText),
    duration: "turn",
    allowedTurns: inferAllowedTurns(card.skillText, shape),
    elementHint: card.element,
    blockedMetric,
    transformElement: inferTransformElement(card.skillText),
    needsReview,
    reviewReason: needsReview
      ? "สกิลนี้มีเงื่อนไข/เป้าหมาย/ผลพิเศษที่ควรยืนยันก่อนใช้ในการแข่งจริง"
      : undefined,
    text: card.skillText,
  };
}

export const triadSkillRules = triadCards
  .map(makeSkillRule)
  .filter((rule): rule is TriadSkillRule => Boolean(rule));

export const triadSkillRuleByNo = new Map(triadSkillRules.map((rule) => [rule.cardNo, rule]));

export function validateTriadDeck(cardNos: string[]): TriadDeckValidation {
  const cards = cardNos.map((cardNo) => triadCardByNo.get(normalizeCardNo(cardNo))).filter(Boolean) as TriadCard[];
  const errors: string[] = [];
  const warnings: string[] = [];
  const byElement: Record<TriadElement, number> = {
    earth: 0,
    fire: 0,
    gold: 0,
    wood: 0,
    water: 0,
    unknown: 0,
  };
  const skillCopies = new Map<string, number>();

  for (const card of cards) {
    byElement[card.element] += 1;
    if (card.kind === "skill") skillCopies.set(card.cardNo, (skillCopies.get(card.cardNo) || 0) + 1);
  }

  const monsters = cards.filter((card) => card.kind === "monster").length;
  const skills = cards.filter((card) => card.kind === "skill").length;

  if (cards.length !== 20) errors.push("เด็คต้องมีการ์ดทั้งหมด 20 ใบ");
  if (monsters > 10) errors.push("ใส่มอนสเตอร์ได้สูงสุด 10 ใบ");
  if (skills < 10) warnings.push("เด็คนี้มีสกิลน้อยกว่า 10 ใบ อาจเล่นโหมดสกิลได้ไม่เต็ม");

  for (const [cardNo, count] of skillCopies) {
    if (count > 2) errors.push(`สกิล No.${cardNo} ใส่ได้ไม่เกิน 2 ใบ`);
  }

  for (const [element, count] of Object.entries(byElement) as [TriadElement, number][]) {
    if (element !== "unknown" && count > 4) errors.push(`ธาตุ ${element} เกิน 4 ใบ`);
  }

  if (byElement.unknown > 0) warnings.push("มีการ์ดบางใบที่ยังไม่ระบุธาตุชัดเจน");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    counts: { total: cards.length, monsters, skills, byElement },
  };
}

function selectedLane(turn: TriadTurn): TriadLane {
  if (turn === 1) return "top";
  if (turn === 2) return "left";
  return "right";
}

function getCard(cardNo?: string) {
  if (!cardNo) return undefined;
  return triadCardByNo.get(normalizeCardNo(cardNo));
}

function baseScore(triangle: TriadTriangle, turn: TriadTurn) {
  const top = getCard(triangle.top);
  const laneCard = getCard(triangle[selectedLane(turn)]);
  if (turn === 1) {
    return {
      metric: "total" as const,
      total: (top?.attack || 0) + (top?.support || 0),
      breakdown: top ? [`No.${top.cardNo} ${top.name}: ATK ${top.attack} + SUP ${top.support}`] : [],
    };
  }

  const metric: TriadMetric = turn === 2 ? "attack" : "support";
  const topValue = top?.[metric] || 0;
  const laneValue = laneCard?.kind === "monster" ? laneCard[metric] : 0;
  const label = metric === "attack" ? "ATK" : "SUP";

  return {
    metric,
    total: topValue + laneValue,
    breakdown: [
      top ? `No.${top.cardNo} ${top.name}: ${label} ${topValue}` : "",
      laneCard?.kind === "monster" ? `No.${laneCard.cardNo} ${laneCard.name}: ${label} ${laneValue}` : "",
    ].filter(Boolean),
  };
}

function applySkill(
  triangle: TriadTriangle,
  score: ReturnType<typeof baseScore>,
  turn: TriadTurn
) {
  const laneCard = getCard(triangle[selectedLane(turn)]);
  const unresolved: TriadSkillRule[] = [];
  if (!laneCard || laneCard.kind !== "skill") return { score, unresolved };

  const rule = triadSkillRuleByNo.get(laneCard.cardNo);
  if (!rule) return { score, unresolved };

  if (!rule.allowedTurns.includes(turn)) {
    score.breakdown.push(`No.${rule.cardNo} ${rule.name}: สกิลไม่เข้าเงื่อนไขตานี้`);
    return { score, unresolved };
  }

  if (rule.needsReview && rule.shape !== "stat") {
    unresolved.push(rule);
    score.breakdown.push(`No.${rule.cardNo} ${rule.name}: รอยืนยันกติกาสกิลพิเศษ`);
    return { score, unresolved };
  }

  for (const effect of rule.effects) {
    if (score.metric !== "total" && effect.metric === score.metric) {
      score.total += effect.delta;
      const label = effect.metric === "attack" ? "ATK" : "SUP";
      score.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${label} ${effect.delta >= 0 ? "+" : ""}${effect.delta}`);
    }
  }

  return { score, unresolved };
}

export function resolveTriadTurn(input: TriadTurnInput): TriadTurnResult {
  const playerScore = baseScore(input.player, input.turn);
  const opponentScore = baseScore(input.opponent, input.turn);
  const playerApplied = applySkill(input.player, playerScore, input.turn);
  const opponentApplied = applySkill(input.opponent, opponentScore, input.turn);
  const playerTotal = playerApplied.score.total;
  const opponentTotal = opponentApplied.score.total;

  return {
    turn: input.turn,
    metric: playerApplied.score.metric,
    playerTotal,
    opponentTotal,
    winner: playerTotal > opponentTotal ? "player" : opponentTotal > playerTotal ? "opponent" : "draw",
    playerBreakdown: playerApplied.score.breakdown,
    opponentBreakdown: opponentApplied.score.breakdown,
    unresolvedSkills: [...playerApplied.unresolved, ...opponentApplied.unresolved],
  };
}

export function getTriadCatalogSummary() {
  const skills = triadCards.filter((card) => card.kind === "skill");
  const monsters = triadCards.filter((card) => card.kind === "monster");
  const parsedSkills = triadSkillRules.filter((rule) => !rule.needsReview);
  const reviewSkills = triadSkillRules.filter((rule) => rule.needsReview);

  return {
    totalCards: triadCards.length,
    monsters: monsters.length,
    skills: skills.length,
    parsedSkills: parsedSkills.length,
    reviewSkills: reviewSkills.length,
  };
}
