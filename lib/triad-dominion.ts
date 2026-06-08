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
  skippedSkillCardNos?: string[];
};

export type TriadTurnResult = {
  turn: TriadTurn;
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

function makeSkillRule(card: TriadCard): TriadSkillRule | null {
  if (card.kind !== "skill") return null;

  const effects = statEffects(card.skillText);
  const inferredShape = inferSkillShape(card.skillText, effects);
  const shape: TriadSkillShape = card.cardNo === "284" ? "swap-control" : inferredShape;
  const blockedMetric = /Buff|บัฟ|พลังเสริม/i.test(card.skillText)
    ? undefined
    : /ATTACK/i.test(card.skillText)
    ? "attack"
    : /SUPPORT|SUP\b/i.test(card.skillText)
      ? "support"
      : undefined;
  const needsReview =
    shape === "unparsed" ||
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
  ownScore: ReturnType<typeof baseScore>,
  opponentScore: ReturnType<typeof baseScore>,
  turn: TriadTurn,
  side: "player" | "opponent",
  blockers: StatGainBlocker[] = [],
  skippedSkillCardNos: Set<string> = new Set()
) {
  const laneCard = getCard(triangle[selectedLane(turn)]);
  const unresolved: TriadSkillRule[] = [];
  const events: TriadSkillEvent[] = [];
  if (!laneCard || laneCard.kind !== "skill") return { unresolved, events };

  const rule = triadSkillRuleByNo.get(laneCard.cardNo);
  if (!rule) return { unresolved, events };

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

  if (rule.shape === "block-stat-gain") {
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
      const effectTargetSide = targetIsOpponent ? (side === "player" ? "opponent" : "player") : side;
      const blockedBy = effect.delta > 0
        ? blockers.find((blocker) => blocker.targetSide === effectTargetSide && (!blocker.metric || blocker.metric === effect.metric))
        : undefined;
      if (blockedBy) {
        const label = effect.metric === "attack" ? "ATK" : "SUP";
        events.push({
          cardNo: rule.cardNo,
          name: rule.name,
          side,
          type: rule.shape,
          text: rule.text,
          summary: `บัฟ ${label} +${effect.delta.toLocaleString()} ถูกบล็อกโดย No.${blockedBy.rule.cardNo} ${blockedBy.rule.name} ค่าเดิมไม่เปลี่ยน`,
          blocked: true,
        });
        ownScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${label} +${effect.delta} ถูกบล็อก`);
        continue;
      }
      targetScore.total += effect.delta;
      const label = effect.metric === "attack" ? "ATK" : "SUP";
      targetScore.breakdown.push(`No.${rule.cardNo} ${rule.name}: ${label} ${effect.delta >= 0 ? "+" : ""}${effect.delta}`);
      const metricLabel = effect.metric === "attack" ? "โจมตี" : "ช่วยเหลือ";
      const directionLabel = effect.delta >= 0 ? "เพิ่ม" : "ลด";
      const targetLabel = targetIsOpponent ? "ฝั่งตรงข้าม" : "ฝั่งผู้ใช้สกิล";
      events.push({
        cardNo: rule.cardNo,
        name: rule.name,
        side,
        type: rule.shape,
        text: rule.text,
        summary: `${targetLabel} ${directionLabel}${metricLabel} ${Math.abs(effect.delta).toLocaleString()} แต้ม`,
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

function getLaneSkillRule(triangle: TriadTriangle, turn: TriadTurn) {
  const laneCard = getCard(triangle[selectedLane(turn)]);
  if (!laneCard || laneCard.kind !== "skill") return undefined;
  return triadSkillRuleByNo.get(laneCard.cardNo);
}

type StatGainBlocker = {
  sourceSide: "player" | "opponent";
  targetSide: "player" | "opponent";
  metric?: TriadMetric;
  rule: TriadSkillRule;
};

function collectStatGainBlockers(player: TriadTriangle, opponent: TriadTriangle, turn: TriadTurn) {
  const blockers: StatGainBlocker[] = [];
  const events: TriadSkillEvent[] = [];
  const items = [
    { side: "player" as const, rule: getLaneSkillRule(player, turn) },
    { side: "opponent" as const, rule: getLaneSkillRule(opponent, turn) },
  ].filter(
    (item): item is { side: "player" | "opponent"; rule: TriadSkillRule } =>
      item.rule?.shape === "block-stat-gain" && item.rule.allowedTurns.includes(turn)
  );

  for (const item of items) {
    const targetSide =
      item.rule.target.startsWith("own")
        ? item.side
        : item.side === "player"
          ? "opponent"
          : "player";
    const metricLabel = item.rule.blockedMetric === "attack" ? "ATK" : item.rule.blockedMetric === "support" ? "SUP" : "ATK/SUP";
    const targetLabel = targetSide === item.side ? "มอนสเตอร์หลักฝั่งผู้ใช้สกิล" : "มอนสเตอร์หลักฝั่งตรงข้าม";
    blockers.push({ sourceSide: item.side, targetSide, metric: item.rule.blockedMetric, rule: item.rule });
    events.push({
      cardNo: item.rule.cardNo,
      name: item.rule.name,
      side: item.side,
      type: item.rule.shape,
      text: item.rule.text,
      summary: `ล็อกเป้า ${targetLabel} แล้ว บล็อกบัฟเพิ่ม ${metricLabel} จากสกิลทั้งหมดในตานี้`,
      targetLabel,
    });
  }

  return { blockers, events };
}

function applyPreScoreSkills(player: TriadTriangle, opponent: TriadTriangle, turn: TriadTurn) {
  const effectivePlayer = { ...player };
  const effectiveOpponent = { ...opponent };
  const events: TriadSkillEvent[] = [];

  const swapSkills = [
    { side: "player" as const, rule: getLaneSkillRule(player, turn) },
    { side: "opponent" as const, rule: getLaneSkillRule(opponent, turn) },
  ].filter(
    (item): item is { side: "player" | "opponent"; rule: TriadSkillRule } =>
      item.rule?.shape === "swap-control" && item.rule.allowedTurns.includes(turn)
  );

  for (const item of swapSkills) {
    const playerTop = effectivePlayer.top;
    effectivePlayer.top = effectiveOpponent.top;
    effectiveOpponent.top = playerTop;
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
  const skippedSkillCardNos = new Set((input.skippedSkillCardNos || []).map((cardNo) => normalizeCardNo(cardNo)));
  const preScore = applyPreScoreSkills(input.player, input.opponent, input.turn);
  const statGainBlocks = collectStatGainBlockers(input.player, input.opponent, input.turn);
  const playerScore = baseScore(preScore.player, input.turn);
  const opponentScore = baseScore(preScore.opponent, input.turn);
  const playerApplied = applySkill(input.player, playerScore, opponentScore, input.turn, "player", statGainBlocks.blockers, skippedSkillCardNos);
  const opponentApplied = applySkill(input.opponent, opponentScore, playerScore, input.turn, "opponent", statGainBlocks.blockers, skippedSkillCardNos);
  const playerTotal = playerScore.total;
  const opponentTotal = opponentScore.total;

  return {
    turn: input.turn,
    metric: playerScore.metric,
    playerTotal,
    opponentTotal,
    winner: playerTotal > opponentTotal ? "player" : opponentTotal > playerTotal ? "opponent" : "draw",
    effectivePlayer: preScore.player,
    effectiveOpponent: preScore.opponent,
    playerBreakdown: playerScore.breakdown,
    opponentBreakdown: opponentScore.breakdown,
    unresolvedSkills: [...playerApplied.unresolved, ...opponentApplied.unresolved],
    skillEvents: [...preScore.events, ...statGainBlocks.events, ...playerApplied.events, ...opponentApplied.events],
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
