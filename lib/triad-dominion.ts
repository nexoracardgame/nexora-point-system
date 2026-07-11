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
const ELEMENT_CRYSTAL_CARD_NOS = new Set(["001", "002", "003", "004", "005"]);

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

function firstThaiToken(value: string) {
  return value.match(/[\u0E00-\u0E7F]+/)?.[0] || "";
}

function displayCardName(card: SourceCard, kind: TriadCardKind) {
  const fallback = String(card.cardName || `Card ${card.cardNo}`).trim();
  if (kind !== "skill") return fallback;

  const slashName = fallback.split(/[\/|]/).map((item) => firstThaiToken(item)).find(Boolean);
  if (slashName) return slashName;
  const directThaiName = firstThaiToken(fallback);
  if (directThaiName) return directThaiName;

  const normalizedNo = normalizeCardNo(card.cardNo);
  const rawOriginal = String(card.rawText || "").trim();
  const raw = rawOriginal.replace(/\s+/g, " ").trim();
  const numericNo = Number.parseInt(normalizedNo, 10);
  const cardNoPattern = Number.isFinite(numericNo) ? `0*${numericNo}` : normalizedNo;
  const afterCardNoSource = raw.match(new RegExp(`Card\\s*No\\.?\\s*${cardNoPattern}\\s+(.{0,90})`, "i"))?.[1] || "";
  const afterCardNo = firstThaiToken(afterCardNoSource);
  if (afterCardNo) return afterCardNo;
  const afterLeadingCode = raw.match(/^[A-Z0-9\s/.-]+(?:\d+)?\s+([\u0E00-\u0E7F]+)/i)?.[1];
  if (afterLeadingCode) return afterLeadingCode;
  return fallback;
}

export const triadCards: TriadCard[] = sourceCards.map((card) => {
  const kind = getKind(card);
  return {
    cardNo: normalizeCardNo(card.cardNo),
    name: displayCardName(card, kind),
    kind,
    attack: parseNumber(card.atk),
    support: parseNumber(card.sup),
    element: normalizeElement(
      `${card.element || ""} ${card.type || ""} ${card.cardName || ""} ${card.rawText || ""} ${card.notes || ""}`,
      card.cardNo
    ),
    skillText: normalizeSkillElementText(String(card.skill || "").replace(/\s+/g, " ").trim()),
    sourceImage: card.sourceImage || `/cards/${normalizeCardNo(card.cardNo)}.jpg`,
  };
});

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

function hasExplicitElementCondition(text: string) {
  const explicitElementMarker =
    /(?:\u0e18\u0e32\u0e15\u0e38|Element|Symbol|icon|\u{1F534}|\u{1F535}|\u{1F7E2}|\u2660|coin|triangle)/iu;
  const explicitExclusion =
    /(?:\u0e44\u0e21\u0e48\u0e43\u0e0a\u0e48|\u0e22\u0e01\u0e40\u0e27\u0e49\u0e19|except|non[-\s]?)[\s\S]{0,36}(?:\u0e18\u0e32\u0e15\u0e38|Element|Symbol|icon|Fire|Water|Wood|Gold|Earth|\u{1F534}|\u{1F535}|\u{1F7E2}|\u2660|coin|triangle)/iu;
  return explicitElementMarker.test(text) || explicitExclusion.test(text);
}

function inferElementCondition(card: TriadCard): TriadSkillRule["elementCondition"] {
  if (ELEMENT_CRYSTAL_CARD_NOS.has(card.cardNo) && card.element !== "unknown") {
    return { mode: "include", elements: [card.element] };
  }

  const text = card.skillText;
  if (!hasExplicitElementCondition(text)) return undefined;

  const explicitElements = inferElementsFromText(text);
  const elements = explicitElements;
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
    card.cardNo === "245" || card.cardNo === "284"
      ? "swap-control"
      : card.cardNo === "259" || card.cardNo === "255" || card.cardNo === "223" || card.cardNo === "238" || card.cardNo === "239" || card.cardNo === "243"
        ? "stat"
      : card.cardNo === "227"
        ? "stat"
        : card.cardNo === "236"
        ? "skill-cancel"
        : card.cardNo === "244" || card.cardNo === "234"
          ? "block-stat-gain"
          : inferredShape;
  const blockedMetric = card.cardNo === "244" || card.cardNo === "234"
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
    card.cardNo !== "234" &&
    card.cardNo !== "259" &&
    card.cardNo !== "227" &&
    card.cardNo !== "245" &&
    (shape === "unparsed" ||
      shape === "element-transform" ||
      /ไม่ใช่|หรือมากกว่า|หรือต่ำกว่า|จบไฟต์|ยกเลิก|ทำลาย/.test(card.skillText));

  return {
    cardNo: card.cardNo,
    name: card.name,
    shape,
    effects,
    target: card.cardNo === "222" || card.cardNo === "242" ? "all" : ELEMENT_CRYSTAL_CARD_NOS.has(card.cardNo) ? "own-all" : card.cardNo === "225" ? "own-one" : card.cardNo === "255" || card.cardNo === "223" || card.cardNo === "238" || card.cardNo === "239" || card.cardNo === "243" ? "own-main" : card.cardNo === "258" ? "opponent-main" : card.cardNo === "234" ? "own-main" : inferTarget(card.skillText),
    duration: "turn",
    allowedTurns: inferAllowedTurns(card.skillText, shape),
    elementHint: card.element,
    elementCondition: card.cardNo === "016" ? { mode: "include", elements: ["earth"] } : card.cardNo === "019" || card.cardNo === "291" ? { mode: "include", elements: ["wood"] } : card.cardNo === "222" ? { mode: "exclude", elements: ["earth"] } : card.cardNo === "242" ? { mode: "exclude", elements: ["gold"] } : inferElementCondition(card),
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

function parseBoardTargetSequence(value = "") {
  return value
    .split(">")
    .map((item) => item.trim())
    .filter((item): item is "player-top" | "bot-top" => item === "player-top" || item === "bot-top");
}

function applyMetalSword(
  rule: TriadSkillRule,
  side: "player" | "opponent",
  targetId: string | undefined,
  playerScore: ReturnType<typeof baseScore>,
  opponentScore: ReturnType<typeof baseScore>,
  blockers: StatGainBlocker[] = []
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
  const targetSide = normalizedTarget === "player-top" ? "player" : "opponent";
  const blocker = blockers.find((item) =>
    item.targetSide === targetSide &&
    statGainBlockerApplies(item, { metric, delta }, { lane: "top" })
  );
  if (blocker) {
    return {
      event: {
        cardNo: rule.cardNo,
        name: rule.name,
        side,
        type: rule.shape,
        text: rule.text,
        summary: `No.${blocker.rule.cardNo} ${blocker.rule.name} ป้องกัน ${targetLabel} ไว้ ค่า ${metric.toUpperCase()} จึงไม่เปลี่ยนแปลง`,
        targetLabel,
        blocked: true,
      } satisfies TriadSkillEvent,
    };
  }
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

function applyPowerSeal(
  rule: TriadSkillRule,
  side: "player" | "opponent",
  selectedTarget: string,
  ownScore: ReturnType<typeof baseScore>,
  opponentScore: ReturnType<typeof baseScore>,
  blockers: StatGainBlocker[]
) {
  const events: TriadSkillEvent[] = [];
  const targets = parseBoardTargetSequence(selectedTarget);
  const [drainTarget, boostTarget] = targets;
  const uniqueTargets = new Set(targets);

  if (!drainTarget || !boostTarget || uniqueTargets.size < 2) {
    events.push({
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "ต้องเลือกมอนสเตอร์ 2 ตัวตามลำดับ: ตัวแรก ATK -2000 และตัวที่สอง ATK +2000 สกิลจึงไม่ทำงาน",
      blocked: true,
    });
    return events;
  }

  const scoreForTarget = (target: "player-top" | "bot-top") => {
    if (target === "player-top") return side === "player" ? ownScore : opponentScore;
    return side === "player" ? opponentScore : ownScore;
  };
  const sideForTarget = (target: "player-top" | "bot-top"): "player" | "opponent" =>
    target === "player-top" ? "player" : "opponent";
  const labelForTarget = (target: "player-top" | "bot-top") =>
    target === (side === "player" ? "player-top" : "bot-top")
      ? "มอนสเตอร์หลักฝ่ายผู้ใช้สกิล"
      : "มอนสเตอร์หลักฝ่ายตรงข้าม";

  const applyTargetDelta = (target: "player-top" | "bot-top", delta: number, order: 1 | 2) => {
    const targetScore = scoreForTarget(target);
    const contribution = targetScore.contributions.find((item) => item.lane === "top");
    const targetLabel = labelForTarget(target);
    const orderLabel = order === 1 ? "ตัวที่ 1" : "ตัวที่ 2";
    if (!contribution) {
      events.push({
        cardNo: rule.cardNo,
        name: rule.name,
        side,
        type: rule.shape,
        text: rule.text,
        summary: `${orderLabel} ไม่พบมอนสเตอร์เป้าหมาย สกิลส่วนนี้ไม่ทำงาน`,
        targetLabel,
        blocked: true,
      });
      return;
    }

    const blocker = blockers.find((item) =>
      item.targetSide === sideForTarget(target) &&
      statGainBlockerApplies(item, { metric: "attack", delta }, { lane: "top" })
    );
    if (blocker) {
      events.push({
        cardNo: rule.cardNo,
        name: rule.name,
        side,
        type: rule.shape,
        text: rule.text,
        summary: `${orderLabel} ${delta > 0 ? "เพิ่ม" : "ลด"} ATK ${Math.abs(delta).toLocaleString()} ถูกล็อคโดย No.${blocker.rule.cardNo} ${blocker.rule.name} ค่าพลังไม่เปลี่ยน`,
        targetLabel,
        blocked: true,
      });
      return;
    }

    if (targetScore.metric === "attack") {
      targetScore.total += delta;
      contribution.value += delta;
      targetScore.breakdown.push(
        `No.${rule.cardNo} ${rule.name}: ${orderLabel} ${targetLabel} ATK ${delta >= 0 ? "+" : ""}${delta.toLocaleString()}`
      );
    }
    events.push({
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `${orderLabel} ${targetLabel} ${delta > 0 ? "เพิ่ม" : "ลด"} ATK ${Math.abs(delta).toLocaleString()} จนจบตา`,
      targetLabel,
    });
  };

  applyTargetDelta(drainTarget, -2000, 1);
  applyTargetDelta(boostTarget, 2000, 2);
  return events;
}

function applyGravityField(
  rule: TriadSkillRule,
  side: "player" | "opponent",
  targetId: string | undefined,
  ownScore: ReturnType<typeof baseScore>,
  opponentScore: ReturnType<typeof baseScore>,
  blockers: StatGainBlocker[] = []
) {
  const ownTarget = side === "player" ? "player-top" : "bot-top";
  const opponentTarget = side === "player" ? "bot-top" : "player-top";
  const normalizedTarget = targetId === ownTarget || targetId === opponentTarget ? targetId : opponentTarget;
  const targetScore = normalizedTarget === ownTarget ? ownScore : opponentScore;
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

  const targetSide = normalizedTarget === ownTarget ? side : side === "player" ? "opponent" : "player";
  const qualifyingMetrics: TriadMetric[] = [];
  if (targetContribution.card.attack >= 7000) qualifyingMetrics.push("attack");
  if (targetContribution.card.support >= 7000) qualifyingMetrics.push("support");

  if (qualifyingMetrics.length === 0) {
    return {
      event: {
        cardNo: rule.cardNo,
        name: rule.name,
        side,
        type: rule.shape,
        text: rule.text,
        summary: `No.${targetContribution.card.cardNo} ${targetContribution.card.name} ไม่มี ATK หรือ SUP ตั้งแต่ 7,000 ขึ้นไป สกิลไม่เกิดผล`,
        targetLabel,
        blocked: true,
      } satisfies TriadSkillEvent,
    };
  }

  const applied: string[] = [];
  const blocked: string[] = [];

  for (const metric of qualifyingMetrics) {
    const originalValue = targetContribution.card[metric];
    const effect = { metric, delta: -originalValue };
    const blocker = blockers.find((item) =>
      item.targetSide === targetSide &&
      statGainBlockerApplies(item, effect, { lane: "top" })
    );
    const label = metric === "attack" ? "ATK" : "SUP";
    if (blocker) {
      blocked.push(`${label} ถูกล็อคโดย No.${blocker.rule.cardNo}`);
      continue;
    }
    if (targetScore.metric === metric) {
      targetScore.total -= originalValue;
      targetContribution.value = 0;
      targetScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${targetLabel} ${label} ${originalValue.toLocaleString()} -> 0`);
    }
    applied.push(`${label} ${originalValue.toLocaleString()} -> 0`);
  }

  if (applied.length === 0) {
    return {
      event: {
        cardNo: rule.cardNo,
        name: rule.name,
        side,
        type: rule.shape,
        text: rule.text,
        summary: `${targetLabel} เข้าเงื่อนไขแต่ค่าที่ลดถูกสกิลป้องกันไว้ (${blocked.join(", ")})`,
        targetLabel,
        blocked: true,
      } satisfies TriadSkillEvent,
    };
  }

  const extra = blocked.length > 0 ? ` ส่วนที่ถูกกันไว้: ${blocked.join(", ")}` : "";
  return {
    event: {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `เลือก ${targetLabel} No.${targetContribution.card.cardNo} ลดค่าที่เข้าเงื่อนไขเหลือ 0 จนจบตา (${applied.join(", ")})${extra}`,
      targetLabel,
    } satisfies TriadSkillEvent,
  };
}

type TriadScoreState = ReturnType<typeof baseScore>;

type TriadEffectiveBoardState = {
  player: TriadTriangle;
  opponent: TriadTriangle;
};

function cloneTopContribution(score: TriadScoreState) {
  const contribution = score.contributions.find((item) => item.lane === "top");
  return contribution ? { ...contribution, lane: "top" as TriadLane } : null;
}

function replaceTopContribution(score: TriadScoreState, next: ReturnType<typeof cloneTopContribution>) {
  const withoutTop = score.contributions.filter((item) => item.lane !== "top");
  score.contributions = next ? [next, ...withoutTop] : withoutTop;
}

function applyScoreStateTopSwap(
  rule: TriadSkillRule,
  side: "player" | "opponent",
  playerScore: TriadScoreState,
  opponentScore: TriadScoreState,
  boardState: TriadEffectiveBoardState
) {
  const playerTop = cloneTopContribution(playerScore);
  const opponentTop = cloneTopContribution(opponentScore);
  if (!playerTop || !opponentTop) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "ไม่พบมอนสเตอร์หลักครบทั้งสองฝ่าย จึงสลับไม่ได้",
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  playerScore.total += opponentTop.value - playerTop.value;
  opponentScore.total += playerTop.value - opponentTop.value;
  replaceTopContribution(playerScore, opponentTop);
  replaceTopContribution(opponentScore, playerTop);

  const effectivePlayerTop = boardState.player.top;
  boardState.player.top = boardState.opponent.top;
  boardState.opponent.top = effectivePlayerTop;

  const summary =
    `สลับมอนสเตอร์หลักพร้อมค่าพลังปัจจุบันที่ถูกบัฟ/ดีบัฟแล้ว: ` +
    `ฝ่ายเราได้ No.${opponentTop.card.cardNo} (${opponentTop.value.toLocaleString()}) ` +
    `ฝ่ายตรงข้ามได้ No.${playerTop.card.cardNo} (${playerTop.value.toLocaleString()})`;
  playerScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: swapped top state with opponent`);
  opponentScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: swapped top state with opponent`);

  return {
    cardNo: rule.cardNo,
    name: rule.name,
    side,
    type: rule.shape,
    text: rule.text,
    summary,
  } satisfies TriadSkillEvent;
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

function applyAllFieldStatRule(
  rule: TriadSkillRule,
  side: "player" | "opponent",
  ownScore: ReturnType<typeof baseScore>,
  opponentScore: ReturnType<typeof baseScore>,
  blockers: StatGainBlocker[]
) {
  const scoreItems = [
    { score: ownScore, targetSide: side, label: "user" },
    { score: opponentScore, targetSide: side === "player" ? "opponent" as const : "player" as const, label: "opponent" },
  ];
  const events: TriadSkillEvent[] = [];

  for (const effect of rule.effects) {
    const applied: string[] = [];
    const blocked: string[] = [];

    for (const item of scoreItems) {
      if (item.score.metric !== effect.metric) continue;
      const eligible = item.score.contributions.filter((contribution) => elementConditionMatches(rule, contribution.card));
      const unblocked = eligible.filter((contribution) => {
        const blocker = blockers.find((candidate) =>
          candidate.targetSide === item.targetSide &&
          statGainBlockerApplies(candidate, effect, contribution)
        );
        if (blocker) blocked.push(`${item.label} No.${contribution.card.cardNo} by No.${blocker.rule.cardNo}`);
        return !blocker;
      });
      if (unblocked.length === 0) continue;

      const totalDelta = effect.delta * unblocked.length;
      item.score.total += totalDelta;
      unblocked.forEach((contribution) => {
        contribution.value += effect.delta;
      });
      item.score.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${effect.metric.toUpperCase()} ${totalDelta.toLocaleString()} (${item.label}, ${unblocked.length})`);
      applied.push(`${item.label} ${unblocked.length}`);
    }

    const metricLabel = effect.metric === "attack" ? "ATTACK" : "SUPPORT";
    if (applied.length === 0) {
      events.push({
        cardNo: rule.cardNo,
        name: rule.name,
        side,
        type: rule.shape,
        text: rule.text,
        summary: blocked.length > 0
          ? `${metricLabel} change found valid targets, but was blocked (${blocked.join(", ")})`
          : `No valid ${metricLabel} targets matched this turn`,
        blocked: true,
      });
      continue;
    }

    const condition = elementConditionLabel(rule);
    events.push({
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `${metricLabel} ${effect.delta >= 0 ? "+" : ""}${effect.delta.toLocaleString()} applies to all matching monsters on both fields${condition ? ` (${condition})` : ""}: ${applied.join(", ")}${blocked.length > 0 ? `; blocked ${blocked.join(", ")}` : ""}`,
    });
  }

  return events;
}

function applyTidebomb(
  rule: TriadSkillRule,
  side: "player" | "opponent",
  selectedTarget: string,
  ownScore: ReturnType<typeof baseScore>,
  opponentScore: ReturnType<typeof baseScore>,
  blockers: StatGainBlocker[]
) {
  const ownTarget = side === "player" ? "player-top" : "bot-top";
  const opponentTarget = side === "player" ? "bot-top" : "player-top";
  const normalizedTarget = selectedTarget === ownTarget || selectedTarget === opponentTarget ? selectedTarget : opponentTarget;
  const targetScore = normalizedTarget === ownTarget ? ownScore : opponentScore;
  const targetSide = normalizedTarget === "player-top" ? "player" : "opponent";
  const targetContribution = targetScore.contributions.find((item) => item.lane === "top");
  const targetLabel = normalizedTarget === ownTarget ? "มอนสเตอร์หลักฝ่ายผู้ใช้สกิล" : "มอนสเตอร์หลักฝ่ายตรงข้าม";

  if (!targetContribution) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "ใบ 259 ไม่ทำงาน เพราะไม่พบมอนสเตอร์หลักที่ถูกเลือกเป็นเป้าหมาย",
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  if (targetContribution.card.attack < 5000 && targetContribution.card.support < 5000) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `No.${targetContribution.card.cardNo} ${targetContribution.card.name} ไม่เข้าเงื่อนไข เพราะไม่มีค่า ATK หรือ SUP ตั้งแต่ 5,000 ขึ้นไป`,
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  const applied: string[] = [];
  const blocked: string[] = [];
  const metrics: TriadMetric[] = ["attack", "support"];
  for (const metric of metrics) {
    const metricLabel = metric === "attack" ? "ATK" : "SUP";
    const originalValue = targetContribution.card[metric];
    const delta = 3000 - originalValue;
    if (delta === 0) {
      applied.push(`${metricLabel} คงไว้ที่ 3,000`);
      continue;
    }
    const effect = { metric, delta };
    const blocker = blockers.find((item) =>
      item.targetSide === targetSide &&
      statGainBlockerApplies(item, effect, { lane: "top" })
    );
    if (blocker) {
      blocked.push(`${metricLabel} ถูกบล็อกโดย No.${blocker.rule.cardNo}`);
      continue;
    }
    if (targetScore.metric === metric) {
      targetScore.total += delta;
      targetContribution.value = 3000;
      targetScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${targetLabel} ${metricLabel} ${originalValue.toLocaleString()} -> 3,000`);
    }
    applied.push(`${metricLabel} ${originalValue.toLocaleString()} -> 3,000`);
  }

  if (applied.length === 0) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `${targetLabel} เข้าเงื่อนไขใบ 259 แล้ว แต่การเปลี่ยนค่าสเตตัสทั้งหมดถูกบล็อก (${blocked.join(", ")})`,
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  return {
    cardNo: rule.cardNo,
    name: rule.name,
    side,
    type: rule.shape,
    text: rule.text,
    summary: `ใบ 259 ปรับ No.${targetContribution.card.cardNo} ${targetLabel} ให้ ATK และ SUP เป็น 3,000 จนจบเทิร์น (${applied.join(", ")}${blocked.length > 0 ? `; ถูกบล็อก ${blocked.join(", ")}` : ""})`,
    targetLabel,
  } satisfies TriadSkillEvent;
}

function applyHydroburst255(
  rule: TriadSkillRule,
  side: "player" | "opponent",
  ownScore: TriadScoreState,
  blockers: StatGainBlocker[] = []
) {
  const targetContribution = ownScore.contributions.find((item) => item.lane === "top");
  const targetLabel = "มอนสเตอร์หลักฝั่งผู้ใช้สกิล";
  if (!targetContribution) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "ไม่พบมอนสเตอร์หลักฝั่งตัวเอง สกิลจึงไม่ทำงาน",
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  if (targetContribution.value > 5000) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `No.${targetContribution.card.cardNo} ${targetContribution.card.name} มีแต้ม ${targetContribution.value.toLocaleString()} เกิน 5,000 จึงไม่เข้าเงื่อนไขบัฟ`,
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  const effects: TriadSkillEffect[] = [
    { metric: "attack", delta: 2500 },
    { metric: "support", delta: 2500 },
  ];
  const applied: string[] = [];
  const blocked: string[] = [];
  for (const effect of effects) {
    if (ownScore.metric !== "total" && ownScore.metric !== effect.metric) continue;
    const blocker = blockers.find((item) =>
      item.targetSide === side &&
      statGainBlockerApplies(item, effect, { lane: "top" })
    );
    const label = effect.metric === "attack" ? "ATK" : "SUP";
    if (blocker) {
      blocked.push(`${label} ถูกบล็อกโดย No.${blocker.rule.cardNo}`);
      continue;
    }
    ownScore.total += effect.delta;
    targetContribution.value += effect.delta;
    ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${targetLabel} ${label} +${effect.delta.toLocaleString()}`);
    applied.push(`${label} +${effect.delta.toLocaleString()}`);
  }

  if (applied.length === 0) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: blocked.length > 0 ? `เข้าเงื่อนไขแล้วแต่ถูกบล็อก (${blocked.join(", ")})` : "ตานี้ไม่มีค่าสเตตัสที่สกิลนี้บัฟได้",
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  return {
    cardNo: rule.cardNo,
    name: rule.name,
    side,
    type: rule.shape,
    text: rule.text,
    summary: `No.${targetContribution.card.cardNo} ${targetContribution.card.name} แต้มไม่เกิน 5,000 ได้รับบัฟ ${applied.join(", ")}${blocked.length > 0 ? `; ${blocked.join(", ")}` : ""}`,
    targetLabel,
  } satisfies TriadSkillEvent;
}

function applyEarthRebirth225Strict(
  rule: TriadSkillRule,
  side: "player" | "opponent",
  ownScore: TriadScoreState,
  blockers: StatGainBlocker[] = []
) {
  const targetContribution = ownScore.contributions.find((item) => item.card.kind === "monster" && item.card.attack <= 5000);
  const targetLabel = "มอนสเตอร์ฝั่งผู้ใช้สกิลที่ ATK ไม่เกิน 5,000";
  if (!targetContribution) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "ไม่พบมอนสเตอร์ฝั่งผู้ใช้สกิลที่มี ATK 5,000 หรือต่ำกว่า ใบ 225 จึงไม่ทำงาน",
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  const effects: TriadSkillEffect[] = [
    { metric: "attack", delta: 2500 },
    { metric: "support", delta: 2500 },
  ];
  const applied: string[] = [];
  const blocked: string[] = [];
  for (const effect of effects) {
    if (ownScore.metric !== "total" && ownScore.metric !== effect.metric) continue;
    const label = effect.metric === "attack" ? "ATK" : "SUP";
    const blocker = blockers.find((item) =>
      item.targetSide === side &&
      statGainBlockerApplies(item, effect, targetContribution)
    );
    if (blocker) {
      blocked.push(`${label} ถูกบล็อกโดย No.${blocker.rule.cardNo}`);
      continue;
    }
    ownScore.total += effect.delta;
    targetContribution.value += effect.delta;
    ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: No.${targetContribution.card.cardNo} ${label} +${effect.delta.toLocaleString()}`);
    applied.push(`${label} +${effect.delta.toLocaleString()}`);
  }

  if (applied.length === 0) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: blocked.length > 0
        ? `No.${targetContribution.card.cardNo} เข้าเงื่อนไข ATK ไม่เกิน 5,000 แต่บัฟถูกบล็อก (${blocked.join(", ")})`
        : "เข้าเงื่อนไข ATK ไม่เกิน 5,000 แต่ตานี้ไม่มีค่าสเตตัสที่ใบ 225 ใช้บัฟได้",
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  return {
    cardNo: rule.cardNo,
    name: rule.name,
    side,
    type: rule.shape,
    text: rule.text,
    summary: `No.${targetContribution.card.cardNo} ${targetContribution.card.name} มี ATK ${targetContribution.card.attack.toLocaleString()} ไม่เกิน 5,000 ใบ 225 บัฟ ${applied.join(", ")}${blocked.length > 0 ? `; ${blocked.join(", ")}` : ""}`,
    targetLabel,
  } satisfies TriadSkillEvent;
}

function applyElementCrystalStrict(
  rule: TriadSkillRule,
  side: "player" | "opponent",
  ownScore: TriadScoreState,
  blockers: StatGainBlocker[] = []
) {
  const effect: TriadSkillEffect = { metric: "attack", delta: 3000 };
  const crystalElement = rule.elementHint;
  const elementLabel = formatElementName(crystalElement);
  const targetLabel = `มอนสเตอร์ธาตุ${elementLabel}ฝั่งผู้ใช้สกิล`;

  if (ownScore.metric !== "total" && ownScore.metric !== effect.metric) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `ใบ ${rule.cardNo} เป็นบัฟ ATK จึงทำงานเฉพาะตาที่ใช้ค่า ATK คิดคะแนน`,
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  if (crystalElement === "unknown") {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `ใบ ${rule.cardNo} ไม่พบธาตุประจำ Crystal จึงไม่เกิดผล`,
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  const matchingContributions = ownScore.contributions.filter((item) => item.card.element === crystalElement);
  if (matchingContributions.length === 0) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `ใบ ${rule.cardNo} ไม่พบมอนสเตอร์ธาตุ${elementLabel}ฝั่งผู้ใช้สกิล จึงไม่เกิดผล`,
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  const applied: string[] = [];
  const blocked: string[] = [];
  for (const contribution of matchingContributions) {
    const blocker = blockers.find((item) =>
      item.targetSide === side &&
      statGainBlockerApplies(item, effect, contribution)
    );
    if (blocker) {
      blocked.push(`No.${contribution.card.cardNo} ถูกบล็อกโดย No.${blocker.rule.cardNo}`);
      continue;
    }
    ownScore.total += effect.delta;
    contribution.value += effect.delta;
    ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: No.${contribution.card.cardNo} ${crystalElement} ATK +${effect.delta.toLocaleString()}`);
    applied.push(`No.${contribution.card.cardNo} +${effect.delta.toLocaleString()}`);
  }

  if (applied.length === 0) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `ใบ ${rule.cardNo} เจอมอนสเตอร์ธาตุ${elementLabel}แล้ว แต่บัฟถูกบล็อกทั้งหมด (${blocked.join(", ")})`,
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  return {
    cardNo: rule.cardNo,
    name: rule.name,
    side,
    type: rule.shape,
    text: rule.text,
    summary: `ใบ ${rule.cardNo} บัฟ ATK +3,000 ให้มอนสเตอร์ธาตุ${elementLabel}ฝั่งผู้ใช้สกิลครบตามเงื่อนไข: ${applied.join(", ")}${blocked.length > 0 ? `; ถูกบล็อก ${blocked.join(", ")}` : ""}`,
    targetLabel,
  } satisfies TriadSkillEvent;
}

function applyPitfall223Strict(
  rule: TriadSkillRule,
  side: "player" | "opponent",
  ownScore: TriadScoreState,
  blockers: StatGainBlocker[] = []
) {
  const targetContribution = ownScore.contributions.find((item) => item.lane === "top");
  const targetLabel = "own main monster";
  if (!targetContribution) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "No own main monster found. No.223 does not activate.",
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  if (targetContribution.card.attack > 2000) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `No.${targetContribution.card.cardNo} ${targetContribution.card.name} ATK ${targetContribution.card.attack.toLocaleString()} is over 2,000, so No.223 cannot buff it.`,
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  const effect: TriadSkillEffect = { metric: "attack", delta: 5000 };
  if (ownScore.metric !== "total" && ownScore.metric !== effect.metric) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "No.223 condition passed, but this turn is not using ATK for scoring.",
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  const blocker = blockers.find((item) =>
    item.targetSide === side &&
    statGainBlockerApplies(item, effect, { lane: "top" })
  );
  if (blocker) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `No.223 condition passed, but ATK +5,000 was blocked by No.${blocker.rule.cardNo} ${blocker.rule.name}.`,
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  ownScore.total += effect.delta;
  targetContribution.value += effect.delta;
  ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${targetLabel} ATK +${effect.delta.toLocaleString()}`);
  return {
    cardNo: rule.cardNo,
    name: rule.name,
    side,
    type: rule.shape,
    text: rule.text,
    summary: `No.${targetContribution.card.cardNo} ${targetContribution.card.name} has ATK ${targetContribution.card.attack.toLocaleString()} or lower, so No.223 gives ATK +5,000.`,
    targetLabel,
  } satisfies TriadSkillEvent;
}

function applyMetalShield238Strict(
  rule: TriadSkillRule,
  side: "player" | "opponent",
  ownScore: TriadScoreState,
  blockers: StatGainBlocker[] = []
) {
  const targetContribution = ownScore.contributions.find((item) => item.lane === "top");
  const targetLabel = "own main monster";
  if (!targetContribution) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "No own main monster found. No.238 does not activate.",
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  if (targetContribution.card.support > 2000) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `No.${targetContribution.card.cardNo} ${targetContribution.card.name} SUP ${targetContribution.card.support.toLocaleString()} is over 2,000, so No.238 cannot buff it.`,
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  const effect: TriadSkillEffect = { metric: "support", delta: 5000 };
  if (ownScore.metric !== "total" && ownScore.metric !== effect.metric) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "No.238 condition passed, but this turn is not using SUP for scoring.",
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  const blocker = blockers.find((item) =>
    item.targetSide === side &&
    statGainBlockerApplies(item, effect, { lane: "top" })
  );
  if (blocker) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `No.238 condition passed, but SUP +5,000 was blocked by No.${blocker.rule.cardNo} ${blocker.rule.name}.`,
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  ownScore.total += effect.delta;
  targetContribution.value += effect.delta;
  ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${targetLabel} SUP +${effect.delta.toLocaleString()}`);
  return {
    cardNo: rule.cardNo,
    name: rule.name,
    side,
    type: rule.shape,
    text: rule.text,
    summary: `No.${targetContribution.card.cardNo} ${targetContribution.card.name} has SUP ${targetContribution.card.support.toLocaleString()} or lower, so No.238 gives SUP +5,000.`,
    targetLabel,
  } satisfies TriadSkillEvent;
}

function applyIronWings239Strict(
  rule: TriadSkillRule,
  side: "player" | "opponent",
  ownScore: TriadScoreState,
  blockers: StatGainBlocker[] = []
) {
  const targetContribution = ownScore.contributions.find((item) => item.lane === "top");
  const targetLabel = "มอนสเตอร์หลักฝ่ายผู้ใช้สกิล";
  if (!targetContribution) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "ไม่พบมอนสเตอร์หลักฝั่งตัวเอง ใบ 239 จึงไม่ทำงาน",
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  if (targetContribution.card.support > 1000) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `No.${targetContribution.card.cardNo} ${targetContribution.card.name} มี SUP ${targetContribution.card.support.toLocaleString()} เกิน 1,000 จึงไม่เข้าเงื่อนไขใบ 239`,
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  const effects: TriadSkillEffect[] = [
    { metric: "attack", delta: 7000 },
    { metric: "support", delta: 3000 },
  ];
  const applied: string[] = [];
  const blocked: string[] = [];

  for (const effect of effects) {
    const label = effect.metric === "attack" ? "ATK" : "SUP";
    if (ownScore.metric !== "total" && ownScore.metric !== effect.metric) continue;
    const blocker = blockers.find((item) =>
      item.targetSide === side &&
      statGainBlockerApplies(item, effect, { lane: "top" })
    );
    if (blocker) {
      blocked.push(`${label} ถูกบล็อกโดย No.${blocker.rule.cardNo}`);
      continue;
    }
    ownScore.total += effect.delta;
    targetContribution.value += effect.delta;
    ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${targetLabel} ${label} +${effect.delta.toLocaleString()}`);
    applied.push(`${label} +${effect.delta.toLocaleString()}`);
  }

  if (applied.length === 0) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: blocked.length > 0
        ? `เข้าเงื่อนไขแล้วแต่บัฟถูกบล็อก (${blocked.join(", ")})`
        : "เข้าเงื่อนไขแล้ว แต่ตานี้ไม่มีค่าสเตตัสที่ใบ 239 ใช้บัฟได้",
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  return {
    cardNo: rule.cardNo,
    name: rule.name,
    side,
    type: rule.shape,
    text: rule.text,
    summary: `No.${targetContribution.card.cardNo} ${targetContribution.card.name} มี SUP ไม่เกิน 1,000 ใบ 239 บัฟ ${applied.join(", ")}${blocked.length > 0 ? `; ${blocked.join(", ")}` : ""}`,
    targetLabel,
  } satisfies TriadSkillEvent;
}

function applyCounterBlade243Strict(
  rule: TriadSkillRule,
  side: "player" | "opponent",
  ownScore: TriadScoreState,
  blockers: StatGainBlocker[] = []
) {
  const targetContribution = ownScore.contributions.find((item) => item.lane === "top");
  const targetLabel = "มอนสเตอร์หลักฝ่ายผู้ใช้สกิล";
  if (!targetContribution) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "ไม่พบมอนสเตอร์หลักฝ่ายตัวเอง ใบ 243 จึงไม่ทำงาน",
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  if (targetContribution.card.support > 3000) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `No.${targetContribution.card.cardNo} ${targetContribution.card.name} มี SUP ${targetContribution.card.support.toLocaleString()} เกิน 3,000 จึงไม่เข้าเงื่อนไขใบ 243`,
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  const effect: TriadSkillEffect = { metric: "support", delta: 4000 };
  if (ownScore.metric !== "total" && ownScore.metric !== effect.metric) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "ใบ 243 เข้าเงื่อนไขแล้ว แต่ตานี้ไม่ได้ใช้ค่า SUP ในการคิดคะแนน",
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  const blocker = blockers.find((item) =>
    item.targetSide === side &&
    statGainBlockerApplies(item, effect, { lane: "top" })
  );
  if (blocker) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `ใบ 243 เข้าเงื่อนไขแล้ว แต่ SUP +4,000 ถูกบล็อกโดย No.${blocker.rule.cardNo} ${blocker.rule.name}`,
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  ownScore.total += effect.delta;
  targetContribution.value += effect.delta;
  ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${targetLabel} SUP +${effect.delta.toLocaleString()}`);
  return {
    cardNo: rule.cardNo,
    name: rule.name,
    side,
    type: rule.shape,
    text: rule.text,
    summary: `No.${targetContribution.card.cardNo} ${targetContribution.card.name} มี SUP ไม่เกิน 3,000 ใบ 243 บัฟ SUP +4,000`,
    targetLabel,
  } satisfies TriadSkillEvent;
}

function applyPitfall223(
  rule: TriadSkillRule,
  side: "player" | "opponent",
  ownScore: TriadScoreState,
  blockers: StatGainBlocker[] = []
) {
  const targetContribution = ownScore.contributions.find((item) => item.lane === "top");
  const targetLabel = "เธกเธญเธเธชเน€เธ•เธญเธฃเนเธซเธฅเธฑเธเธเธฑเนเธเธเธนเนเนเธเนเธชเธเธดเธฅ";
  if (!targetContribution) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "เนเธกเนเธเธเธกเธญเธเธชเน€เธ•เธญเธฃเนเธซเธฅเธฑเธเธเธฑเนเธเธ•เธฑเธงเน€เธญเธ เธชเธเธดเธฅเธเธถเธเนเธกเนเธ—เธณเธเธฒเธ",
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  if (targetContribution.card.attack > 2000) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `No.${targetContribution.card.cardNo} ${targetContribution.card.name} ATK ${targetContribution.card.attack.toLocaleString()} เน€เธเธดเธ 2,000 เธเธถเธเนเธกเนเน€เธเนเธฒเน€เธเธทเนเธญเธเนเธเธเธฑเธ`,
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  const effect: TriadSkillEffect = { metric: "attack", delta: 5000 };
  if (ownScore.metric !== "total" && ownScore.metric !== effect.metric) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: "เน€เธเนเธฒเน€เธเธทเนเธญเธเนเธเนเธฅเนเธง เนเธ•เนเธ•เธฒเธเธตเนเนเธกเนเนเธ”เนเนเธเนเธเนเธฒ ATK เนเธเธเธฒเธฃเธเธดเธ”เธเธฐเนเธเธ",
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  const blocker = blockers.find((item) =>
    item.targetSide === side &&
    statGainBlockerApplies(item, effect, { lane: "top" })
  );
  if (blocker) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: `เน€เธเนเธฒเน€เธเธทเนเธญเธเนเธเนเธฅเนเธงเนเธ•เน ATK +5,000 เธ–เธนเธเธเธฅเนเธญเธเนเธ”เธข No.${blocker.rule.cardNo} ${blocker.rule.name}`,
      targetLabel,
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  ownScore.total += effect.delta;
  targetContribution.value += effect.delta;
  ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${targetLabel} ATK +${effect.delta.toLocaleString()}`);
  return {
    cardNo: rule.cardNo,
    name: rule.name,
    side,
    type: rule.shape,
    text: rule.text,
    summary: `No.${targetContribution.card.cardNo} ${targetContribution.card.name} ATK เนเธกเนเน€เธเธดเธ 2,000 เนเธ”เนเธฃเธฑเธเธเธฑเธ ATK +5,000`,
    targetLabel,
  } satisfies TriadSkillEvent;
}

function applyMechanicalTrap(
  rule: TriadSkillRule,
  side: "player" | "opponent",
  ownScore: ReturnType<typeof baseScore>,
  opponentScore: ReturnType<typeof baseScore>,
  blockers: StatGainBlocker[]
) {
  const effect = rule.effects.find((item) => item.metric === "support" && item.delta < 0) || { metric: "support" as const, delta: -3000 };
  const scoreItems = [
    { score: ownScore, targetSide: side, label: "user" },
    { score: opponentScore, targetSide: side === "player" ? "opponent" as const : "player" as const, label: "opponent" },
  ];
  const applied: string[] = [];
  const blocked: string[] = [];

  for (const item of scoreItems) {
    if (item.score.metric !== effect.metric) continue;
    const eligible = item.score.contributions.filter((contribution) => elementConditionMatches(rule, contribution.card));
    const unblocked = eligible.filter((contribution) => {
      const blocker = blockers.find((candidate) =>
        candidate.targetSide === item.targetSide &&
        statGainBlockerApplies(candidate, effect, contribution)
      );
      if (blocker) blocked.push(`${item.label} No.${contribution.card.cardNo} by No.${blocker.rule.cardNo}`);
      return !blocker;
    });
    if (unblocked.length === 0) continue;

    const totalDelta = effect.delta * unblocked.length;
    item.score.total += totalDelta;
    unblocked.forEach((contribution) => {
      contribution.value += effect.delta;
    });
    item.score.breakdown.push(`No.${rule.cardNo} ${rule.name}: SUP ${totalDelta.toLocaleString()} (${item.label}, ${unblocked.length} non-gold)`);
    applied.push(`${item.label} ${unblocked.length}`);
  }

  if (applied.length === 0) {
    return {
      cardNo: rule.cardNo,
      name: rule.name,
      side,
      type: rule.shape,
      text: rule.text,
      summary: blocked.length > 0
        ? `Mechanical Trap found non-gold targets, but the SUPPORT reduction was blocked (${blocked.join(", ")})`
        : "Mechanical Trap found no non-gold monster using SUPPORT this turn",
      blocked: true,
    } satisfies TriadSkillEvent;
  }

  const blockedText = blocked.length > 0 ? ` Blocked: ${blocked.join(", ")}` : "";
  return {
    cardNo: rule.cardNo,
    name: rule.name,
    side,
    type: rule.shape,
    text: rule.text,
    summary: `Mechanical Trap: every non-gold monster on both fields gets SUPPORT ${effect.delta.toLocaleString()} until end of turn (${applied.join(", ")}).${blockedText}`,
  } satisfies TriadSkillEvent;
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
  ownScore: TriadScoreState,
  opponentScore: TriadScoreState,
  turn: TriadTurn,
  side: "player" | "opponent",
  blockers: StatGainBlocker[] = [],
  skippedSkillCardNos: Set<string> = new Set(),
  cancelledSkillCardNos: Set<string> = new Set(),
  canCancelOpponentSkill = false,
  selectedTarget = "",
  overrideRule?: TriadSkillRule,
  boardState?: TriadEffectiveBoardState
) {
  const laneCard = getCard(triangle[selectedLane(turn)]);
  const unresolved: TriadSkillRule[] = [];
  const events: TriadSkillEvent[] = [];
  if ((!laneCard || laneCard.kind !== "skill") && !overrideRule) return { unresolved, events };

  const rule = overrideRule || (laneCard ? triadSkillRuleByNo.get(laneCard.cardNo) : undefined);
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

  if (rule.cardNo === "265") {
    return { unresolved, events };
  }

  if (rule.cardNo === "227") {
    const result = applyGravityField(
      rule,
      side,
      selectedTarget,
      ownScore,
      opponentScore,
      blockers
    );
    ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${result.event.summary}`);
    events.push(result.event);
    return { unresolved, events };
  }

  if (rule.cardNo === "259") {
    const event = applyTidebomb(rule, side, selectedTarget, ownScore, opponentScore, blockers);
    ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${event.summary}`);
    events.push(event);
    return { unresolved, events };
  }

  if (rule.cardNo === "222") {
    const rockspineEvents = applyAllFieldStatRule(rule, side, ownScore, opponentScore, blockers);
    events.push(...rockspineEvents);
    ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: applied all-field non-earth ATTACK change`);
    return { unresolved, events };
  }

  if (rule.cardNo === "242") {
    const event = applyMechanicalTrap(rule, side, ownScore, opponentScore, blockers);
    ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${event.summary}`);
    events.push(event);
    return { unresolved, events };
  }

  if (rule.cardNo === "231") {
    const result = applyMetalSword(
      rule,
      side,
      selectedTarget,
      side === "player" ? ownScore : opponentScore,
      side === "player" ? opponentScore : ownScore,
      blockers
    );
    ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${result.event.summary}`);
    events.push(result.event);
    return { unresolved, events };
  }

  if (rule.cardNo === "232") {
    const powerSealEvents = applyPowerSeal(rule, side, selectedTarget, ownScore, opponentScore, blockers);
    events.push(...powerSealEvents);
    ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: applied ordered two-target seal`);
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
    if (rule.cardNo === "234" && !canCancelOpponentSkill) {
      ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: armor opened after the opposing skill already resolved`);
      events.push({
        cardNo: rule.cardNo,
        name: rule.name,
        side,
        type: rule.shape,
        text: rule.text,
        summary: "เปิดเกราะช้ากว่าอีกฝ่าย ผลสกิลที่กระทบมอนสเตอร์หลักถูกใช้งานไปแล้ว จึงไม่เกิดผลในตานี้",
        blocked: true,
      });
      return { unresolved, events };
    }
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
      summary: rule.cardNo === "234"
        ? "สวมเกราะให้มอนสเตอร์หลักฝ่ายผู้ใช้สกิล ผลสกิลของอีกฝ่ายที่กระทบมอนสเตอร์นี้จะไร้ผลทันทีจนจบตา"
        : rule.cardNo === "244"
          ? `ล็อกค่า ${metricLabel} ของ ${targetLabel} ไว้เท่าเดิมจนจบตา อีกฝ่ายไม่สามารถบัฟ ลด หรือเปลี่ยนค่านี้ได้`
          : `ล็อกเป้า ${targetLabel} แล้ว บล็อกบัฟเพิ่ม ${metricLabel} จากสกิลทั้งหมดในตานี้`,
      targetLabel,
    });
    ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: locked ${metricLabel} changes on ${targetSide}${targetLane ? ` ${targetLane}` : ""}`);
    return { unresolved, events };
  }

  if (rule.cardNo === "245") {
    return { unresolved, events };
  }

  if (ELEMENT_CRYSTAL_CARD_NOS.has(rule.cardNo)) {
    events.push(applyElementCrystalStrict(rule, side, ownScore, blockers));
    return { unresolved, events };
  }

  if (rule.shape === "swap-control") {
    if (boardState) {
      events.push(applyScoreStateTopSwap(rule, side, side === "player" ? ownScore : opponentScore, side === "player" ? opponentScore : ownScore, boardState));
      return { unresolved, events };
    }
    return { unresolved, events };
  }

  if (rule.cardNo === "255") {
    events.push(applyHydroburst255(rule, side, ownScore, blockers));
    return { unresolved, events };
  }

  if (rule.cardNo === "225") {
    events.push(applyEarthRebirth225Strict(rule, side, ownScore, blockers));
    return { unresolved, events };
  }

  if (rule.cardNo === "223") {
    events.push(applyPitfall223Strict(rule, side, ownScore, blockers));
    return { unresolved, events };
  }

  if (rule.cardNo === "238") {
    events.push(applyMetalShield238Strict(rule, side, ownScore, blockers));
    return { unresolved, events };
  }

  if (rule.cardNo === "239") {
    events.push(applyIronWings239Strict(rule, side, ownScore, blockers));
    return { unresolved, events };
  }

  if (rule.cardNo === "243") {
    events.push(applyCounterBlade243Strict(rule, side, ownScore, blockers));
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
      intendedContributions.forEach((contribution) => {
        const isBlocked = blockedContributions.some((blocked) => blocked.contribution === contribution);
        if (!isBlocked) contribution.value += effect.delta;
      });
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

function getEnergyReversalRule(triangle: TriadTriangle, turn: TriadTurn, skippedSkillCardNos: Set<string> = new Set()) {
  const rule = getLaneSkillRule(triangle, turn, skippedSkillCardNos);
  return rule?.cardNo === "245" && rule.allowedTurns.includes(turn) ? rule : undefined;
}

function getOpposingSkillRuleForEnergyReversal(
  triangle: TriadTriangle,
  turn: TriadTurn,
  skippedSkillCardNos: Set<string> = new Set()
) {
  const rule = getLaneSkillRule(triangle, turn, skippedSkillCardNos);
  if (!rule || rule.cardNo === "245") return undefined;
  return rule;
}

function applyEnergyReversal(
  side: "player" | "opponent",
  ownTriangle: TriadTriangle,
  opposingTriangle: TriadTriangle,
  ownScore: TriadScoreState,
  opponentScore: TriadScoreState,
  turn: TriadTurn,
  blockers: StatGainBlocker[],
  skippedSkillCardNos: Set<string>,
  cancelledSkillCardNos: Set<string>,
  selectedTarget = "",
  boardState?: TriadEffectiveBoardState
) {
  const unresolved: TriadSkillRule[] = [];
  const events: TriadSkillEvent[] = [];
  const reversalRule = getEnergyReversalRule(ownTriangle, turn, skippedSkillCardNos);
  if (!reversalRule) return { unresolved, events };
  if (cancelledSkillCardNos.has(reversalRule.cardNo)) return { unresolved, events };

  const copiedRule = getOpposingSkillRuleForEnergyReversal(opposingTriangle, turn);
  if (!copiedRule) {
    events.push({
      cardNo: reversalRule.cardNo,
      name: reversalRule.name,
      side,
      type: reversalRule.shape,
      text: reversalRule.text,
      summary: "Energy Reversal found no opposing skill to copy this turn.",
      blocked: true,
    });
    ownScore.breakdown.push(`No.${reversalRule.cardNo} ${reversalRule.name}: no opposing skill to copy`);
    return { unresolved, events };
  }

  events.push({
    cardNo: reversalRule.cardNo,
    name: reversalRule.name,
    side,
    type: reversalRule.shape,
    text: reversalRule.text,
    summary: `Energy Reversal copies No.${copiedRule.cardNo} ${copiedRule.name} and uses it for this side.`,
    targetLabel: `No.${copiedRule.cardNo}`,
  });
  ownScore.breakdown.push(`No.${reversalRule.cardNo} ${reversalRule.name}: copied No.${copiedRule.cardNo} ${copiedRule.name}`);

  const copied = applySkill(
    opposingTriangle,
    ownScore,
    opponentScore,
    turn,
    side,
    blockers,
    new Set(),
    new Set(),
    false,
    selectedTarget,
    copiedRule,
    boardState
  );

  return {
    unresolved: [...unresolved, ...copied.unresolved],
    events: [...events, ...copied.events],
  };
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
  if (rule.cardNo === "234") {
    return { targetSide: side, targetLane: "top" as TriadLane };
  }
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
  if (blocker.rule.cardNo === "244" || blocker.rule.cardNo === "234") return effect.delta !== 0;
  return effect.delta > 0;
}

function deterministicHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickFlashZoomMonster(seed: string, excludedCardNos: string[]) {
  const excluded = new Set(excludedCardNos.map((cardNo) => normalizeCardNo(cardNo)).filter(Boolean));
  const pool = triadCards.filter((card) => card.kind === "monster" && !excluded.has(card.cardNo));
  if (pool.length === 0) return null;
  return pool[deterministicHash(seed) % pool.length] || null;
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
  const flashZoomSkills = [
    { side: "player" as const, triangle: player, target: effectiveOpponent, targetLabel: "มอนสเตอร์หลักฝ่ายตรงข้าม" },
    { side: "opponent" as const, triangle: opponent, target: effectivePlayer, targetLabel: "มอนสเตอร์หลักฝ่ายตรงข้าม" },
  ]
    .map((item) => ({
      ...item,
      rule: getLaneSkillRule(item.triangle, turn, skippedSkillCardNos),
    }))
    .filter(
      (item): item is {
        side: "player" | "opponent";
        triangle: TriadTriangle;
        target: TriadTriangle;
        targetLabel: string;
        rule: TriadSkillRule;
      } => item.rule?.cardNo === "265" && item.rule.allowedTurns.includes(turn)
    );

  for (const item of flashZoomSkills) {
    const originalTop = item.target.top;
    const replacement = pickFlashZoomMonster(
      `flash-zoom:${turn}:${item.side}:${player.top}:${player.left}:${player.right}:${opponent.top}:${opponent.left}:${opponent.right}`,
      [player.top, player.left || "", player.right || "", opponent.top, opponent.left || "", opponent.right || ""]
    );
    if (!originalTop || !replacement) {
      events.push({
        cardNo: item.rule.cardNo,
        name: item.rule.name,
        side: item.side,
        type: item.rule.shape,
        text: item.rule.text,
        summary: "ไม่พบมอนสเตอร์หลักฝ่ายตรงข้ามหรือไม่มีมอนสเตอร์ใหม่ให้สุ่ม ใบ 265 จึงไม่เปลี่ยนสนามในตานี้",
        targetLabel: item.targetLabel,
        blocked: true,
      });
      continue;
    }
    item.target.top = replacement.cardNo;
    events.push({
      cardNo: item.rule.cardNo,
      name: item.rule.name,
      side: item.side,
      type: item.rule.shape,
      text: item.rule.text,
      summary: `ทำลายมอนสเตอร์หลักฝ่ายตรงข้าม No.${originalTop} ชั่วคราว แล้วสุ่ม No.${replacement.cardNo} ${replacement.name} ขึ้นมาแทนเฉพาะตานี้ จบตาแล้วมอนสเตอร์เดิมกลับมา`,
      targetLabel: item.targetLabel,
    });
  }

  const swapSkills = [
    { side: "player" as const, rule: getLaneSkillRule(player, turn, skippedSkillCardNos) },
    { side: "opponent" as const, rule: getLaneSkillRule(opponent, turn, skippedSkillCardNos) },
  ].filter(
    (item): item is { side: "player" | "opponent"; rule: TriadSkillRule } =>
      item.rule?.shape === "swap-control" && item.rule.cardNo !== "245" && item.rule.allowedTurns.includes(turn)
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

function collectEnergyReversalLocks(
  player: TriadTriangle,
  opponent: TriadTriangle,
  turn: TriadTurn,
  prioritySide: "player" | "opponent",
  skippedSkillCardNos: Set<string> = new Set()
) {
  const lockedSkillCardNos = new Set<string>();
  const priorityTriangle = prioritySide === "player" ? player : opponent;
  const opposingTriangle = prioritySide === "player" ? opponent : player;
  const reversalRule = getEnergyReversalRule(priorityTriangle, turn, skippedSkillCardNos);
  const copiedRule = reversalRule ? getOpposingSkillRuleForEnergyReversal(opposingTriangle, turn) : undefined;
  if (copiedRule) lockedSkillCardNos.add(copiedRule.cardNo);
  return { lockedSkillCardNos };
}

export function resolveTriadTurn(input: TriadTurnInput): TriadTurnResult {
  const prioritySide = input.prioritySide || "player";
  const skippedSkillCardNos = new Set((input.skippedSkillCardNos || []).map((cardNo) => normalizeCardNo(cardNo)));
  const skillCancels = collectSkillCancels(input.player, input.opponent, input.turn, prioritySide, skippedSkillCardNos);
  const energyReversalLocks = collectEnergyReversalLocks(input.player, input.opponent, input.turn, prioritySide, skippedSkillCardNos);
  const cancelledOrLockedSkillCardNos = new Set([
    ...skillCancels.cancelledSkillCardNos,
    ...energyReversalLocks.lockedSkillCardNos,
  ]);
  const blockedSkillCardNos = new Set([
    ...skippedSkillCardNos,
    ...cancelledOrLockedSkillCardNos,
    ...energyReversalLocks.lockedSkillCardNos,
  ]);
  const statUseBlocks = collectStatUseBlockers(input.player, input.opponent, input.turn, blockedSkillCardNos);
  const preScore = applyPreScoreSkills(input.player, input.opponent, input.turn, blockedSkillCardNos);
  const boardState: TriadEffectiveBoardState = {
    player: preScore.player,
    opponent: preScore.opponent,
  };
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
          cancelledOrLockedSkillCardNos,
          prioritySide === "player",
          input.skillTargets?.player?.[getCard(input.player[selectedLane(input.turn)])?.cardNo || ""],
          undefined,
          boardState
        )
      : applySkill(
          input.opponent,
          opponentScore,
          playerScore,
          input.turn,
          "opponent",
          statGainBlockers,
          skippedSkillCardNos,
          cancelledOrLockedSkillCardNos,
          prioritySide === "opponent",
          input.skillTargets?.opponent?.[getCard(input.opponent[selectedLane(input.turn)])?.cardNo || ""],
          undefined,
          boardState
        );
  const applySideWithEnergyReversal = (side: "player" | "opponent") => {
    const base = applySide(side);
    const ownTriangle = side === "player" ? input.player : input.opponent;
    const opposingTriangle = side === "player" ? input.opponent : input.player;
    const ownScore = side === "player" ? playerScore : opponentScore;
    const opposingScore = side === "player" ? opponentScore : playerScore;
    const selectedTarget = input.skillTargets?.[side]?.[getCard(ownTriangle[selectedLane(input.turn)])?.cardNo || ""];
    const copied = applyEnergyReversal(
      side,
      ownTriangle,
      opposingTriangle,
      ownScore,
      opposingScore,
      input.turn,
      statGainBlockers,
      skippedSkillCardNos,
      cancelledOrLockedSkillCardNos,
      selectedTarget,
      boardState
    );
    return {
      unresolved: [...base.unresolved, ...copied.unresolved],
      events: [...base.events, ...copied.events],
    };
  };
  const orderedApplied =
    prioritySide === "player"
      ? [applySideWithEnergyReversal("player"), applySideWithEnergyReversal("opponent")]
      : [applySideWithEnergyReversal("opponent"), applySideWithEnergyReversal("player")];
  const playerTotal = playerScore.total;
  const opponentTotal = opponentScore.total;

  return {
    turn: input.turn,
    prioritySide,
    metric: playerScore.metric,
    playerTotal,
    opponentTotal,
    winner: playerTotal > opponentTotal ? "player" : opponentTotal > playerTotal ? "opponent" : "draw",
    effectivePlayer: boardState.player,
    effectiveOpponent: boardState.opponent,
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
