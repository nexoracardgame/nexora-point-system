import bundledCardSkillDbJson from "@/public/cards/card-skill-db.json";

export type TriadElement = "earth" | "fire" | "gold" | "wood" | "water" | "unknown";
export type TriadCardKind = "monster" | "skill" | "unknown";
export type TriadLane = "top" | "left" | "right";
export type TriadTurn = 1 | 2 | 3;
export type TriadMetric = "attack" | "support";
export type TriadRpsChoice = "rock" | "scissors" | "paper" | "unknown";

const triadElementThai: Record<TriadElement, string> = {
  earth: "ดิน",
  water: "น้ำ",
  wood: "ไม้",
  fire: "ไฟ",
  gold: "ทอง",
  unknown: "ไม่ทราบ",
};
export type TriadSkillShape =
  | "stat"
  | "block-stat-gain"
  | "skill-cancel"
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
  elementCondition?: {
    mode: "include" | "exclude";
    elements: TriadElement[];
  };
  blockedMetric?: TriadMetric;
  blockedUseMetric?: TriadMetric;
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
  prioritySide?: "player" | "opponent";
  skippedSkillCardNos?: string[];
  skillTargets?: Partial<Record<"player" | "opponent", Partial<Record<string, "player-top" | "bot-top" | string>>>>;
};

export type TriadTurnResult = {
  turn: TriadTurn;
  prioritySide: "player" | "opponent";
  metric: "total" | TriadMetric;
  playerTotal: number;
  opponentTotal: number;
  winner: "player" | "opponent" | "draw";
  effectivePlayer: TriadTriangle;
  effectiveOpponent: TriadTriangle;
  playerBreakdown: string[];
  opponentBreakdown: string[];
  unresolvedSkills: TriadSkillRule[];
  skillEvents: TriadSkillEvent[];
};

export type TriadSkillEvent = {
  cardNo: string;
  name: string;
  side: "player" | "opponent";
  type: TriadSkillShape;
  text: string;
  summary: string;
  targetLabel?: string;
  blocked?: boolean;
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

  if (numeric >= 21 && numeric <= 59) return "earth";
  if (numeric >= 60 && numeric <= 98) return "gold";
  if (numeric >= 99 && numeric <= 137) return "water";
  if (numeric >= 138 && numeric <= 176) return "fire";
  if (numeric >= 177 && numeric <= 215) return "wood";
  if (numeric >= 216 && numeric <= 232) return "earth";
  if (numeric >= 233 && numeric <= 248) return "gold";
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

function formatElementName(element: TriadElement) {
  return triadElementThai[element] || triadElementThai.unknown;
}

function normalizeSkillElementText(value: string) {
  return value
    .replace(/\[(?:Water|Blue)\s+Element\s+(?:Symbol|Icon)\]|\((?:Water|Blue)\s+element\s+(?:symbol|icon)\)/gi, "ธาตุน้ำ")
    .replace(/\[(?:Fire|Red)\s+Element\s+(?:Symbol|Icon)\]|\((?:Fire|Red)\s+element\s+(?:symbol|icon)\)/gi, "ธาตุไฟ")
    .replace(/\[(?:Green|Nature|Wood)\s+(?:Spade\s+)?(?:Element\s+)?(?:Symbol|Icon)\]|\((?:Green|Nature|Wood)\s+(?:spade\s+)?(?:element\s+)?(?:symbol|icon)\)/gi, "ธาตุไม้")
    .replace(/\[(?:Gold|Yellow|Metal|C)[-\s]*(?:Element\s+)?(?:Symbol|Icon)?\]|\((?:Gold|Yellow|Metal|C)[-\s]*(?:element\s+)?(?:symbol|icon)?\)/gi, "ธาตุทอง")
    .replace(/\[(?:Earth|Rock|Stone|Orange|Red\/Orange|red\/orange)\s+(?:triangle\s+)?(?:Element\s+)?(?:Symbol|Icon)\]|\((?:Earth|Rock|Stone|Orange|Red\/Orange|red\/orange)\s+(?:triangle\s+)?(?:element\s+)?(?:symbol|icon)\)/gi, "ธาตุดิน")
    .replace(/\b(?:element|elememt)\s+(?:symbol|simbol|icon)\b/gi, "")
    .replace(/\b(?:symbol|simbol|icon)\b/gi, "")
    .replace(/\b(?:Earth|Rock|Sand)\b|🟠|▲|△|🔶|orange triangle|triangle/gi, "ธาตุดิน")
    .replace(/\bWater\b|🔵|💧|blue circle/gi, "ธาตุน้ำ")
    .replace(/\b(?:Green|Nature|Wood)\b|🟢|♠|♤|green spade|spade/gi, "ธาตุไม้")
    .replace(/\bFire\b|🔴|🔥|red circle/gi, "ธาตุไฟ")
    .replace(/\bGold\b|🟡|🪙|coin|yellow circle/gi, "ธาตุทอง")
    .replace(/ธาตุ\s*ธาตุ/g, "ธาตุ")
    .replace(/ไม่ใช่\s*ธาตุ\s*(ดิน|น้ำ|ไม้|ไฟ|ทอง)/g, "ไม่ใช่ธาตุ$1")
    .replace(/ที่ไม่ใช่\s*ธาตุ\s*(ดิน|น้ำ|ไม้|ไฟ|ทอง)/g, "ที่ไม่ใช่ธาตุ$1")
    .replace(/ที่ไม่ใช่\s*(ดิน|น้ำ|ไม้|ไฟ|ทอง)/g, "ที่ไม่ใช่ธาตุ$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function getTriadCardRpsChoice(cardNo?: string): TriadRpsChoice {
  const normalized = normalizeCardNo(cardNo || "");
  const card = sourceCards.find((item) => normalizeCardNo(item.cardNo) === normalized);
  const raw = `${card?.type || ""} ${card?.rarity || ""} ${card?.notes || ""} ${card?.rawText || ""}`.toLowerCase();
  if (/fist|rock|ค้อน/.test(raw)) return "rock";
  if (/peace|scissors|กรรไกร/.test(raw)) return "scissors";
  if (/hand|paper|กระดาษ/.test(raw)) return "paper";
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
  skillText: normalizeSkillElementText(String(card.skill || "").replace(/\s+/g, " ").trim()),
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
  if (/ฝ่ายตรงข้ามทุกใบ|ของฝ่ายตรงข้ามทุกใบ|มอนสเตอร์.*ฝ่ายตรงข้าม.*ทุกใบ/i.test(text)) return "opponent-all";
  if (/ฝ่ายตรงข้าม|ของฝ่ายตรงข้าม/i.test(text)) return "opponent-one";
  if (/บนสนามเรา.*ทุกใบ|ของเรา.*ทุกใบ/i.test(text)) return "own-all";
  if (/บนสนามเรา\s*1\s*ใบ|ของเรา\s*1\s*ใบ/i.test(text)) return "own-one";
  if (/ใครก็ได้|สนามใครก็ได้/i.test(text)) return "any-one";
  if (/มอนสเตอร์ของฝ่ายตรงข้ามทุกใบ|ฝ่ายตรงข้ามทุกใบ/.test(text)) return "opponent-all";
  if (/ของฝ่ายตรงข้าม|ฝ่ายตรงข้าม/.test(text)) return "opponent-one";
  if (/บนสนามเราทุกใบ|ของเราทุกใบ|เรา ทุกใบ/.test(text)) return "own-all";
  if (/บนสนามใครก็ได้|ใครก็ได้/.test(text)) return "any-one";
  if (/มอนสเตอร์ทั้งหมด|ทุกใบ/.test(text)) return "all";
  if (/เลือกมอนสเตอร์\s*บนสนาม|เลือกมอนสเตอร์บนสนาม|เลือกมอนสเตอร์.*บนสนาม/i.test(text)) return "any-one";
  return "own-main";
}

function inferAllowedTurns(text: string, shape: TriadSkillShape): TriadTurn[] {
  if (shape === "unparsed") return [2, 3];
  if (/SUPPORT|SUP\b/i.test(text) && !/ATTACK/i.test(text)) return [3];
  if (/ATTACK/i.test(text) && !/SUPPORT|SUP\b/i.test(text)) return [2];
  return [2, 3];
}

function inferSkillShape(text: string, effects: TriadSkillEffect[]): TriadSkillShape {
  if (/ยกเลิกสกิล|cancel skill|suppress skill|สกัดศัตรูก่อนจะได้เริ่มลงมือใดๆ/i.test(text)) return "skill-cancel";
  if (/Buff|บัฟ|พลังเสริม/i.test(text)) return "block-stat-gain";
  if (/สลับตำแหน่ง|นำมาใช้งานในตานี้|swap/i.test(text)) return "swap-control";
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

function uniqueElements(elements: TriadElement[]) {
  return Array.from(new Set(elements.filter((element) => element !== "unknown")));
}

function inferElementsFromText(text: string): TriadElement[] {
  const elements: TriadElement[] = [];
  if (/Fire|ไฟ|เพลิง|🔴/i.test(text)) elements.push("fire");
  if (/Water|น้ำ|วารี|🔵/i.test(text)) elements.push("water");
  if (/Green|Nature|Wood|ไม้|พฤกษ|♠|🟢/i.test(text)) elements.push("wood");
  if (/Gold|ทอง|coin|สุวรรณ|🟡/i.test(text)) elements.push("gold");
  if (/Earth|Rock|Sand|ดิน|ปฐพี|หิน|ธรณี|triangle|orange/i.test(text)) elements.push("earth");
  return uniqueElements(elements);
}

function inferElementCondition(card: TriadCard): TriadSkillRule["elementCondition"] {
  const text = card.skillText;
  const explicitElements = inferElementsFromText(text);
  const fallbackElements = card.element !== "unknown" ? [card.element] : [];
  const elements = explicitElements.length > 0 ? explicitElements : fallbackElements;
  if (elements.length === 0) return undefined;

  if (/ไม่ใช่|ยกเว้น|except|non[-\s]?/i.test(text)) {
    return { mode: "exclude", elements };
  }

  if (
    /ที่เป็น|ธาตุ|Element|Symbol|icon|🔴|🔵|🟢|♠|coin|triangle|ไฟ|น้ำ|วารี|ไม้|พฤกษ|ทอง|ดิน|ปฐพี|หิน/i.test(text) &&
    /เลือกมอนสเตอร์|มอนสเตอร์บนสนาม|monster/i.test(text)
  ) {
    return { mode: "include", elements };
  }

  return undefined;
}

function makeSkillRule(card: TriadCard): TriadSkillRule | null {
  if (card.kind !== "skill") return null;

  const effects = statEffects(card.skillText);
  const inferredShape = inferSkillShape(card.skillText, effects);
  const shape: TriadSkillShape =
    card.cardNo === "284"
      ? "swap-control"
      : card.cardNo === "236"
        ? "skill-cancel"
        : card.cardNo === "244"
          ? "block-stat-gain"
          : inferredShape;
  const blockedMetric = card.cardNo === "244"
    ? undefined
    : /Buff|บัฟ|พลังเสริม/i.test(card.skillText)
      ? undefined
      : /ATTACK/i.test(card.skillText)
        ? "attack"
        : /SUPPORT|SUP\b/i.test(card.skillText)
          ? "support"
          : undefined;
  const blockedUseMetric = /ไม่สามารถใช้(?:ค่า|คำ)?\s*ATTACK|cannot use ATTACK|cannot use ATK/i.test(card.skillText)
    ? "attack"
    : /ไม่สามารถใช้(?:ค่า|คำ)?\s*SUPPORT|cannot use SUPPORT|cannot use SUP/i.test(card.skillText)
      ? "support"
      : undefined;
  const needsReview =
    card.cardNo !== "236" &&
    (shape === "unparsed" ||
      shape === "element-transform" ||
      /ไม่ใช่|หรือมากกว่า|หรือต่ำกว่า|จบไฟต์|ยกเลิก|ทำลาย/.test(card.skillText));

  return {
    cardNo: card.cardNo,
    name: card.name,
    shape,
    effects,
    target: card.cardNo === "258" ? "opponent-main" : inferTarget(card.skillText),
    duration: "turn",
    allowedTurns: inferAllowedTurns(card.skillText, shape),
    elementHint: card.element,
    elementCondition: inferElementCondition(card),
    blockedMetric,
    blockedUseMetric,
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

function baseScore(triangle: TriadTriangle, turn: TriadTurn, blockedTopMetrics: TriadMetric[] = []) {
  const blockedTopMetricSet = new Set(blockedTopMetrics);
  const top = getCard(triangle.top);
  const laneCard = getCard(triangle[selectedLane(turn)]);
  if (turn === 1) {
    const topAttack = blockedTopMetricSet.has("attack") ? 0 : top?.attack || 0;
    const topSupport = blockedTopMetricSet.has("support") ? 0 : top?.support || 0;
    return {
      metric: "total" as const,
      total: topAttack + topSupport,
      contributions: top ? [{ card: top, lane: "top" as TriadLane, value: topAttack + topSupport }] : [],
      breakdown: top ? [`No.${top.cardNo} ${top.name}: ATK ${topAttack} + SUP ${topSupport}`] : [],
    };
  }

  const metric: TriadMetric = turn === 2 ? "attack" : "support";
  const topValue = top ? (blockedTopMetricSet.has(metric) ? 0 : top[metric] || 0) : 0;
  const laneValue = laneCard?.kind === "monster" ? laneCard[metric] : 0;
  const label = metric === "attack" ? "ATK" : "SUP";

  return {
    metric,
    total: topValue + laneValue,
    contributions: [
      top ? { card: top, lane: "top" as TriadLane, value: topValue } : null,
      laneCard?.kind === "monster" ? { card: laneCard, lane: selectedLane(turn), value: laneValue } : null,
    ].filter((item): item is { card: TriadCard; lane: TriadLane; value: number } => Boolean(item)),
    breakdown: [
      top ? `No.${top.cardNo} ${top.name}: ${label} ${topValue}` : "",
      laneCard?.kind === "monster" ? `No.${laneCard.cardNo} ${laneCard.name}: ${label} ${laneValue}` : "",
    ].filter(Boolean),
  };
}

function cardHighestMetric(card: TriadCard): TriadMetric | "" {
  if (card.attack === card.support) return "";
  return card.attack > card.support ? "attack" : "support";
}

function applyMetalSword(
  rule: TriadSkillRule,
  side: "player" | "opponent",
  targetId: string | undefined,
  playerScore: ReturnType<typeof baseScore>,
  opponentScore: ReturnType<typeof baseScore>
) {
  const ownTarget = side === "player" ? "player-top" : "bot-top";
  const opponentTarget = side === "player" ? "bot-top" : "player-top";
  const normalizedTarget = targetId === ownTarget || targetId === opponentTarget ? targetId : opponentTarget;
  const targetScore = normalizedTarget === "player-top" ? playerScore : opponentScore;
  const targetContribution = targetScore.contributions.find((item) => item.lane === "top");
  const targetLabel = normalizedTarget === ownTarget ? "มอนสเตอร์หลักฝั่งผู้ใช้สกิล" : "มอนสเตอร์หลักฝั่งตรงข้าม";

  if (!targetContribution) {
    return {
      event: {
        cardNo: rule.cardNo,
        name: rule.name,
        side,
        type: rule.shape,
        text: rule.text,
        summary: "ไม่พบมอนสเตอร์เป้าหมาย สกิลไม่เกิดผลและกลับไปวัดค่าพลังปกติ",
        targetLabel,
        blocked: true,
      } satisfies TriadSkillEvent,
    };
  }

  const metric = cardHighestMetric(targetContribution.card);
  if (!metric) {
    return {
      event: {
        cardNo: rule.cardNo,
        name: rule.name,
        side,
        type: rule.shape,
        text: rule.text,
        summary: `No.${targetContribution.card.cardNo} ${targetContribution.card.name} มี ATK และ SUP เท่ากัน จึงไม่เข้าเงื่อนไข สกิลไม่เกิดผลและกลับไปวัดค่าพลังปกติ`,
        targetLabel,
        blocked: true,
      } satisfies TriadSkillEvent,
    };
  }

  const originalValue = targetContribution.card[metric];
  const reducedValue = Math.min(originalValue, 2000);
  const delta = reducedValue - originalValue;
  if (targetScore.metric === metric) {
    targetScore.total += delta;
    const contribution = targetScore.contributions.find((item) => item.lane === "top");
    if (contribution) contribution.value = Math.max(0, contribution.value + delta);
  }
  const label = metric === "attack" ? "ATK" : "SUP";
  targetScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${targetLabel} ${label} ${originalValue.toLocaleString()} -> ${reducedValue.toLocaleString()}`);

  return {
    event: {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `เลือก ${targetLabel} No.${targetContribution.card.cardNo} ลดค่าที่สูงที่สุด (${label}) จาก ${originalValue.toLocaleString()} เหลือ ${reducedValue.toLocaleString()} จนจบตา`,
      targetLabel,
    } satisfies TriadSkillEvent,
  };
}

type StatUseBlocker = {
  sourceSide: "player" | "opponent";
  targetSide: "player" | "opponent";
  metric: TriadMetric;
  rule: TriadSkillRule;
};

function elementConditionMatches(rule: TriadSkillRule, card: TriadCard) {
  if (!rule.elementCondition) return true;
  const listed = rule.elementCondition.elements.includes(card.element);
  return rule.elementCondition.mode === "include" ? listed : !listed;
}

function elementConditionLabel(rule: TriadSkillRule) {
  if (!rule.elementCondition) return "";
  const elements = rule.elementCondition.elements.map(formatElementName).join("/");
  return rule.elementCondition.mode === "include" ? `ต้องเป็นธาตุ${elements}` : `ต้องไม่ใช่ธาตุ${elements}`;
}

function collectStatUseBlockers(player: TriadTriangle, opponent: TriadTriangle, turn: TriadTurn, skippedSkillCardNos: Set<string> = new Set()) {
  const blockers: StatUseBlocker[] = [];
  const events: TriadSkillEvent[] = [];
  const items = [
    { side: "player" as const, rule: getLaneSkillRule(player, turn, skippedSkillCardNos) },
    { side: "opponent" as const, rule: getLaneSkillRule(opponent, turn, skippedSkillCardNos) },
  ].filter(
    (item): item is { side: "player" | "opponent"; rule: TriadSkillRule } =>
      Boolean(item.rule?.blockedUseMetric && item.rule.allowedTurns.includes(turn))
  );

  for (const item of items) {
    const metric = item.rule.blockedUseMetric;
    if (!metric) continue;
    const targetSide =
      item.rule.target.startsWith("own")
        ? item.side
        : item.side === "player"
          ? "opponent"
          : "player";
    const metricLabel = metric === "attack" ? "ATK" : "SUP";
    const targetLabel = targetSide === item.side ? "มอนสเตอร์หลักฝั่งผู้ใช้สกิล" : "มอนสเตอร์หลักฝั่งตรงข้าม";
    blockers.push({ sourceSide: item.side, targetSide, metric, rule: item.rule });
    events.push({
      cardNo: item.rule.cardNo,
      name: item.rule.name,
      side: item.side,
      type: item.rule.shape,
      text: item.rule.text,
      summary: `ล็อกเป้า ${targetLabel} แล้ว ทำให้ใช้ค่า ${metricLabel} ไม่ได้ในตานี้`,
      targetLabel,
      blocked: true,
    });
  }

  return { blockers, events };
}

function applySkill(
  triangle: TriadTriangle,
  ownScore: ReturnType<typeof baseScore>,
  opponentScore: ReturnType<typeof baseScore>,
  turn: TriadTurn,
  side: "player" | "opponent",
  blockers: StatGainBlocker[] = [],
  skippedSkillCardNos: Set<string> = new Set(),
  cancelledSkillCardNos: Set<string> = new Set(),
  canCancelOpponentSkill = false,
  selectedTarget = ""
) {
  const laneCard = getCard(triangle[selectedLane(turn)]);
  const unresolved: TriadSkillRule[] = [];
  const events: TriadSkillEvent[] = [];
  if (!laneCard || laneCard.kind !== "skill") return { unresolved, events };

  const rule = triadSkillRuleByNo.get(laneCard.cardNo);
  if (!rule) return { unresolved, events };

  if (cancelledSkillCardNos.has(rule.cardNo)) {
    ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: skill was cancelled this turn`);
    events.push({
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "สกิลถูกยกเลิกในตานี้ จึงกลับไปใช้คะแนนมอนสเตอร์หลักแทน",
      blocked: true,
    });
    return { unresolved, events };
  }

  if (skippedSkillCardNos.has(rule.cardNo)) {
    ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: skipped because no target was selected in time`);
    events.push({
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "ไม่ได้เลือกเป้าหมายในเวลา สกิลใบนี้ไม่ทำงานในตานี้",
      blocked: true,
    });
    return { unresolved, events };
  }

  if (!rule.allowedTurns.includes(turn)) {
    ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: สกิลไม่เข้าเงื่อนไขตานี้`);
    events.push({
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "สกิลนี้ยังไม่ทำงานในตานี้",
    });
    return { unresolved, events };
  }

  if (rule.cardNo === "231") {
    const result = applyMetalSword(
      rule,
      side,
      selectedTarget,
      side === "player" ? ownScore : opponentScore,
      side === "player" ? opponentScore : ownScore
    );
    ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${result.event.summary}`);
    events.push(result.event);
    return { unresolved, events };
  }

  if (rule.shape === "skill-cancel") {
    if (!canCancelOpponentSkill) {
      ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: cancel opened after the opposing skill already resolved`);
      events.push({
        cardNo: rule.cardNo,
        name: rule.name,
        side,
        type: rule.shape,
        text: rule.text,
        summary: "เปิดสกิลช้ากว่าอีกฝ่าย จึงยกเลิกสกิลที่ใช้ผลไปแล้วไม่ได้",
        blocked: true,
      });
      return { unresolved, events };
    }

    ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ยกเลิกสกิลฝั่งตรงข้ามในตานี้`);
    events.push({
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "ยกเลิกสกิลฝั่งตรงข้ามในตานี้ แล้วใช้คะแนนมอนสเตอร์หลักแทน",
      blocked: true,
    });
    return { unresolved, events };
  }

  if (rule.shape === "block-stat-gain") {
    const { targetSide, targetLane } = statGainBlockerTarget(rule, side, selectedTarget);
    const metricLabel = rule.cardNo === "244"
      ? "ATK/SUP"
      : rule.blockedMetric === "attack"
        ? "ATK"
        : rule.blockedMetric === "support"
          ? "SUP"
          : "ATK/SUP";
    const targetLabel = targetSide === side ? "มอนสเตอร์หลักฝั่งผู้ใช้สกิล" : "มอนสเตอร์หลักฝั่งตรงข้าม";
    blockers.push({ sourceSide: side, targetSide, targetLane, metric: rule.blockedMetric, rule });
    events.push({
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: rule.cardNo === "244"
        ? `ล็อกค่า ${metricLabel} ของ ${targetLabel} ไว้เท่าเดิมจนจบตา อีกฝ่ายไม่สามารถบัฟ ลด หรือเปลี่ยนค่านี้ได้`
        : `ล็อกเป้า ${targetLabel} แล้ว บล็อกบัฟเพิ่ม ${metricLabel} จากสกิลทั้งหมดในตานี้`,
      targetLabel,
    });
    ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: locked ${metricLabel} changes on ${targetSide}${targetLane ? ` ${targetLane}` : ""}`);
    return { unresolved, events };
  }

  if (rule.shape === "swap-control") {
    return { unresolved, events };
  }

  if (rule.needsReview && rule.shape !== "stat") {
    unresolved.push(rule);
    ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: รอยืนยันกติกาสกิลพิเศษ`);
    events.push({
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "สกิลพิเศษนี้รอตรวจสอบกติกา จึงยังไม่เปลี่ยนคะแนน",
    });
    return { unresolved, events };
  }

  const targetIsOpponent =
    rule.target.startsWith("opponent") || (rule.target === "any-one" && rule.effects.some((effect) => effect.delta < 0));
  const targetScore =
    targetIsOpponent
      ? opponentScore
      : ownScore;

  for (const effect of rule.effects) {
    if (targetScore.metric !== "total" && effect.metric === targetScore.metric) {
      const eligibleContributions = targetScore.contributions.filter((item) => elementConditionMatches(rule, item.card));
      const affectsAll = rule.target === "all" || rule.target.endsWith("-all");
      const intendedContributions = affectsAll ? eligibleContributions : eligibleContributions.slice(0, 1);
      const affectedCount = intendedContributions.length;
      if (affectedCount === 0) {
        const condition = elementConditionLabel(rule);
        events.push({
          cardNo: rule.cardNo,
          name: rule.name,
          side,
          type: rule.shape,
          text: rule.text,
          summary: condition
            ? `ไม่เข้าเงื่อนไขธาตุ (${condition}) จึงไม่มีผลในตานี้`
            : "ไม่พบมอนสเตอร์เป้าหมายที่เข้าเงื่อนไข สกิลจึงไม่มีผลในตานี้",
          blocked: true,
        });
        ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: element condition not met`);
        continue;
      }
      const effectTargetSide = targetIsOpponent ? (side === "player" ? "opponent" : "player") : side;
      const blockedContributions = intendedContributions
        .map((contribution) => ({
          contribution,
          blocker: blockers.find((blocker) => blocker.targetSide === effectTargetSide && statGainBlockerApplies(blocker, effect, contribution)),
        }))
        .filter((item): item is { contribution: { card: TriadCard; lane: TriadLane; value: number }; blocker: StatGainBlocker } => Boolean(item.blocker));
      if (blockedContributions.length > 0) {
        const blockedBy = blockedContributions[0].blocker;
        const label = effect.metric === "attack" ? "ATK" : "SUP";
        events.push({
          cardNo: rule.cardNo,
          name: rule.name,
          side,
          type: rule.shape,
          text: rule.text,
          summary: `${effect.delta > 0 ? "บัฟ" : "เปลี่ยนค่า"} ${label} ${effect.delta >= 0 ? "+" : ""}${effect.delta.toLocaleString()} ถูกบล็อกโดย No.${blockedBy.rule.cardNo} ${blockedBy.rule.name} ค่าเดิมไม่เปลี่ยน`,
          blocked: true,
        });
        ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${label} ${effect.delta >= 0 ? "+" : ""}${effect.delta} ถูกบล็อก`);
      }
      const unblockedCount = intendedContributions.length - blockedContributions.length;
      if (unblockedCount === 0) continue;
      const totalDelta = effect.delta * unblockedCount;
      targetScore.total += totalDelta;
      const label = effect.metric === "attack" ? "ATK" : "SUP";
      targetScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${label} ${totalDelta >= 0 ? "+" : ""}${totalDelta}`);
      const metricLabel = effect.metric === "attack" ? "โจมตี" : "ช่วยเหลือ";
      const directionLabel = effect.delta >= 0 ? "เพิ่ม" : "ลด";
      const targetLabel = targetIsOpponent ? "ฝั่งตรงข้าม" : "ฝั่งผู้ใช้สกิล";
      events.push({
        cardNo: rule.cardNo,
        name: rule.name,
        side,
        type: rule.shape,
        text: rule.text,
        summary: `${targetLabel} ${directionLabel}${metricLabel} ${Math.abs(totalDelta).toLocaleString()} แต้ม${affectedCount > 1 ? ` (${affectedCount} ใบเข้าเงื่อนไข)` : ""}`,
      });
    }
  }

  if (events.length === 0) {
    events.push({
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "สกิลทำงานแล้ว แต่ไม่ตรงค่าสถานะที่ใช้คิดคะแนนในตานี้",
    });
  }

  return { unresolved, events };
}

function getLaneSkillRule(triangle: TriadTriangle, turn: TriadTurn, skippedSkillCardNos: Set<string> = new Set()) {
  const laneCard = getCard(triangle[selectedLane(turn)]);
  if (!laneCard || laneCard.kind !== "skill") return undefined;
  if (skippedSkillCardNos.has(laneCard.cardNo)) return undefined;
  return triadSkillRuleByNo.get(laneCard.cardNo);
}

type StatGainBlocker = {
  sourceSide: "player" | "opponent";
  targetSide: "player" | "opponent";
  targetLane?: TriadLane;
  metric?: TriadMetric;
  rule: TriadSkillRule;
};

function statGainBlockerTarget(rule: TriadSkillRule, side: "player" | "opponent", selectedTarget = ""): { targetSide: "player" | "opponent"; targetLane?: TriadLane } {
  if (rule.cardNo === "244") {
    const targetSide: "player" | "opponent" =
      selectedTarget === "player-top"
        ? "player"
        : selectedTarget === "bot-top"
          ? "opponent"
          : side === "player"
            ? "opponent"
            : "player";
    return { targetSide, targetLane: "top" as TriadLane };
  }
  const targetSide: "player" | "opponent" =
    rule.target.startsWith("own")
      ? side
      : side === "player"
        ? "opponent"
        : "player";
  return { targetSide, targetLane: undefined };
}

function statGainBlockerApplies(blocker: StatGainBlocker, effect: TriadSkillEffect, contribution: { lane: TriadLane }) {
  if (blocker.metric && blocker.metric !== effect.metric) return false;
  if (blocker.targetLane && blocker.targetLane !== contribution.lane) return false;
  if (blocker.rule.cardNo === "244") return effect.delta !== 0;
  return effect.delta > 0;
}

function collectSkillCancels(
  player: TriadTriangle,
  opponent: TriadTriangle,
  turn: TriadTurn,
  prioritySide: "player" | "opponent",
  skippedSkillCardNos: Set<string> = new Set()
) {
  const cancelledSkillCardNos = new Set<string>();
  const events: TriadSkillEvent[] = [];
  const priorityTriangle = prioritySide === "player" ? player : opponent;
  const items = [
    { side: prioritySide, rule: getLaneSkillRule(priorityTriangle, turn, skippedSkillCardNos) },
  ].filter(
    (item): item is { side: "player" | "opponent"; rule: TriadSkillRule } =>
      item.rule?.shape === "skill-cancel" && item.rule.allowedTurns.includes(turn)
  );

  for (const item of items) {
    const targetSide = item.side === "player" ? "opponent" : "player";
    const targetTriangle = targetSide === "player" ? player : opponent;
    const targetCardNo = getCard(targetTriangle[selectedLane(turn)])?.cardNo;
    if (targetCardNo) cancelledSkillCardNos.add(targetCardNo);
    events.push({
      cardNo: item.rule.cardNo,
      name: item.rule.name,
      side: item.side,
      type: item.rule.shape,
      text: item.rule.text,
      summary: targetCardNo
        ? `ยกเลิกสกิลฝั่ง${targetSide === "player" ? "เรา" : "ตรงข้าม"} No.${normalizeCardNo(targetCardNo)} ในตานี้ แล้วใช้คะแนนมอนสเตอร์หลักแทน`
        : "ยกเลิกสกิลฝั่งตรงข้ามในตานี้ แล้วใช้คะแนนมอนสเตอร์หลักแทน",
      targetLabel: targetCardNo ? `No.${normalizeCardNo(targetCardNo)}` : undefined,
      blocked: true,
    });
  }

  return { cancelledSkillCardNos, events };
}

function applyPreScoreSkills(player: TriadTriangle, opponent: TriadTriangle, turn: TriadTurn, skippedSkillCardNos: Set<string> = new Set()) {
  const effectivePlayer = { ...player };
  const effectiveOpponent = { ...opponent };
  const events: TriadSkillEvent[] = [];

  const swapSkills = [
    { side: "player" as const, rule: getLaneSkillRule(player, turn, skippedSkillCardNos) },
    { side: "opponent" as const, rule: getLaneSkillRule(opponent, turn, skippedSkillCardNos) },
  ].filter(
    (item): item is { side: "player" | "opponent"; rule: TriadSkillRule } =>
      item.rule?.shape === "swap-control" && item.rule.allowedTurns.includes(turn)
  );

  if (swapSkills.length > 0) {
    const playerTop = effectivePlayer.top;
    effectivePlayer.top = effectiveOpponent.top;
    effectiveOpponent.top = playerTop;
  }

  for (const item of swapSkills) {
    events.push({
      cardNo: item.rule.cardNo,
      name: item.rule.name,
      side: item.side,
      type: item.rule.shape,
      text: item.rule.text,
      summary: "สลับมอนสเตอร์หลักของทั้งสองฝ่ายในตานี้ แล้วค่อยคำนวณคะแนนจากมอนสเตอร์หลักหลังสลับ",
    });
  }

  return { player: effectivePlayer, opponent: effectiveOpponent, events };
}

export function resolveTriadTurn(input: TriadTurnInput): TriadTurnResult {
  const prioritySide = input.prioritySide || "player";
  const skippedSkillCardNos = new Set((input.skippedSkillCardNos || []).map((cardNo) => normalizeCardNo(cardNo)));
  const skillCancels = collectSkillCancels(input.player, input.opponent, input.turn, prioritySide, skippedSkillCardNos);
  const blockedSkillCardNos = new Set([...skippedSkillCardNos, ...skillCancels.cancelledSkillCardNos]);
  const statUseBlocks = collectStatUseBlockers(input.player, input.opponent, input.turn, blockedSkillCardNos);
  const preScore = applyPreScoreSkills(input.player, input.opponent, input.turn, blockedSkillCardNos);
  const statGainBlockers: StatGainBlocker[] = [];
  const playerScore = baseScore(
    preScore.player,
    input.turn,
    statUseBlocks.blockers.filter((blocker) => blocker.targetSide === "player").map((blocker) => blocker.metric)
  );
  const opponentScore = baseScore(
    preScore.opponent,
    input.turn,
    statUseBlocks.blockers.filter((blocker) => blocker.targetSide === "opponent").map((blocker) => blocker.metric)
  );
  const applySide = (side: "player" | "opponent") =>
    side === "player"
      ? applySkill(
          input.player,
          playerScore,
          opponentScore,
          input.turn,
          "player",
          statGainBlockers,
          skippedSkillCardNos,
          skillCancels.cancelledSkillCardNos,
          prioritySide === "player",
          input.skillTargets?.player?.[getCard(input.player[selectedLane(input.turn)])?.cardNo || ""]
        )
      : applySkill(
          input.opponent,
          opponentScore,
          playerScore,
          input.turn,
          "opponent",
          statGainBlockers,
          skippedSkillCardNos,
          skillCancels.cancelledSkillCardNos,
          prioritySide === "opponent",
          input.skillTargets?.opponent?.[getCard(input.opponent[selectedLane(input.turn)])?.cardNo || ""]
        );
  const orderedApplied =
    prioritySide === "player"
      ? [applySide("player"), applySide("opponent")]
      : [applySide("opponent"), applySide("player")];
  const playerTotal = playerScore.total;
  const opponentTotal = opponentScore.total;

  return {
    turn: input.turn,
    prioritySide,
    metric: playerScore.metric,
    playerTotal,
    opponentTotal,
    winner: playerTotal > opponentTotal ? "player" : opponentTotal > playerTotal ? "opponent" : "draw",
    effectivePlayer: preScore.player,
    effectiveOpponent: preScore.opponent,
    playerBreakdown: playerScore.breakdown,
    opponentBreakdown: opponentScore.breakdown,
    unresolvedSkills: orderedApplied.flatMap((item) => item.unresolved),
    skillEvents: [...statUseBlocks.events, ...preScore.events, ...orderedApplied.flatMap((item) => item.events)],
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
