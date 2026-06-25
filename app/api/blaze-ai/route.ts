import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { authOptions } from "@/lib/auth";
import {
  getCollectionCardIds,
  nexoraCollectionSets,
  NEXORA_COLLECTION_SOURCE_URL,
} from "@/lib/nexora-collection-sets";
import {
  nexoraCoinRewards,
  nexoraSingleCardNexRewards,
  NEXORA_SINGLE_CARD_REWARD_SOURCE_URL,
} from "@/lib/nexora-card-rewards";
import bundledCardSkillDbJson from "@/public/cards/card-skill-db.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 30;

const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_MESSAGE_LENGTH = 5000;
const MAX_HISTORY_ITEMS = 10;
const DEFAULT_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbw8RJSG7jX4wKKSApM3q7M630zLQzLla-MEUZKyMN_uYc2BvFeNPchxUt9hBg3fgzaU/exec";
const DEFAULT_DATA_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1Ux_JZKUbhJLPNa2lLZdaBljXH-17bff9AdFzwXBcaGg/export?format=csv&gid=400649088";
const DEFAULT_CARD_DB_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1zXG8UycndiDuehWQNfqXMvMWrnEoxuqjn_NURWSa7-0/export?format=csv&gid=0";
const KNOWLEDGE_CACHE_MS = 5 * 60 * 1000;
const CARD_DB_CACHE_MS = 5 * 60 * 1000;
const SITE_CACHE_MS = 30 * 60 * 1000;
const MAX_SHEET_CONTEXT_CHARS = 60000;
const MAX_CARD_DB_CONTEXT_CHARS = 50000;
const MAX_SITE_CONTEXT_CHARS = 30000;
const CARD_IMAGE_SCAN_CACHE_MS = 24 * 60 * 60 * 1000;

type BlazeHistoryItem = {
  role: "user" | "model";
  text: string;
};

type GeminiPart = {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
};

type GeminiCandidate = {
  content?: {
    parts?: GeminiPart[];
  };
  finishReason?: string;
};

type BlazeResult = {
  reply: string;
  source: "gemini" | "apps-script" | "card-db" | "canonical";
};

type KnowledgeRow = {
  key: string;
  value: string;
  category: string;
  sourceUrl: string;
  priority: number;
  notes: string;
};

type BlazeImagePayload = {
  mimeType: string;
  base64Data: string;
  size: number;
  name: string;
};

type CardDbRow = {
  cardNo: string;
  cardNoNormalized: string;
  cardName: string;
  reward: string;
  value: string;
  imageUrl: string;
  skill: string;
  atk: string;
  sup: string;
  element: string;
  rawText: string;
  searchText: string;
};

type CardKind = "monster" | "skill" | "unknown";
type CardElement = "earth" | "water" | "fire" | "wood" | "gold" | "unknown";

type CardSkillDbEntry = {
  cardNo: string;
  cardName: string;
  skill: string;
  atk: string;
  sup: string;
  element: string;
  rarity: string;
  type: string;
  rawText: string;
  confidence: string;
  reviewed: boolean;
  sourceImage: string;
  scannedAt: string;
  notes: string;
};

type CollectionSetRecord = {
  id: number;
  name: string;
  aliases: string[];
  reward: string;
  rewardAliases: string[];
  level: string;
  rarity: string;
  cardCount: number;
  cards: string[];
  cardNumberLines?: string[];
  rule?: string;
  statusNote?: string;
  sourceUrl: string;
};

type KnowledgeCache = {
  expiresAt: number;
  rows: KnowledgeRow[];
  text: string;
};

type CardDbCache = {
  expiresAt: number;
  rows: CardDbRow[];
};

type CardSkillDbCache = {
  expiresAt: number;
  rows: CardSkillDbEntry[];
  byNo: Map<string, CardSkillDbEntry>;
};

type SiteCacheEntry = {
  expiresAt: number;
  text: string;
};

const OFFICIAL_SITE_PAGES = [
  {
    title: "หน้าหลัก",
    url: "https://www.nexoracardgame.com/",
    keywords: ["nexora", "หน้าหลัก", "ภาพรวม", "รางวัลรวม", "ซอง", "กล่อง"],
  },
  {
    title: "NEXORA คืออะไร",
    url: "https://www.nexoracardgame.com/what-is-nexora",
    keywords: ["nexora คือ", "คืออะไร", "ภาพรวม", "serial", "293", "999999"],
  },
  {
    title: "ข้อมูลการ์ดและเนื้อเรื่อง",
    url: "https://www.nexoracardgame.com/card-information",
    keywords: ["เนื้อเรื่อง", "lore", "ธาตุ", "first ember", "sigil", "card of origin"],
  },
  {
    title: "การ์ดหายากพิเศษ",
    url: "https://www.nexoracardgame.com/jackpot-cards",
    keywords: ["การ์ดหายาก", "jackpot", "รางวัลการ์ด", "nex", "แลกการ์ด"],
  },
  {
    title: "Legend Cards",
    url: "https://www.nexoracardgame.com/legend-cards",
    keywords: ["legend", "legend cards", "การ์ดหายาก", "รางวัลการ์ด", "jackpot", "nex"],
  },
  {
    title: "ชุดคอลเลกชั่นการ์ด",
    url: "https://www.nexoracardgame.com/card-collections",
    keywords: ["collection", "คอลเลกชั่น", "เซ็ต", "set", "ครบชุด"],
  },
  {
    title: "รางวัลจำนวนการ์ดและ NEX",
    url: "https://www.nexoracardgame.com/card-count-rewards",
    keywords: ["nex", "จำนวนการ์ด", "แลกรางวัล", "bronze", "silver", "gold"],
  },
  {
    title: "รางวัล COIN",
    url: "https://www.nexoracardgame.com/coin-rewards",
    keywords: ["coin", "เหรียญ", "ดรอป", "รางวัลเหรียญ"],
  },
  {
    title: "แลกสินค้า No Limit",
    url: "https://www.nexoracardgame.com/unlimited-redemption",
    keywords: ["no limit", "แลกสินค้า", "redemption", "สินค้า", "รางวัล"],
  },
  {
    title: "กติกาแบทเทิล",
    url: "https://www.nexoracardgame.com/game-rules",
    keywords: ["กติกา", "battle", "ดวล", "easy", "normal", "hard", "พนัน"],
  },
  {
    title: "ตัวแทนจำหน่าย",
    url: "https://www.nexoracardgame.com/contact",
    keywords: ["ตัวแทน", "dealer", "สมาชิก", "member", "คอมมิชชั่น"],
  },
  {
    title: "งานเปิดตัว NEXORA",
    url: "https://www.nexoracardgame.com/งานเปิดตัว-nexora",
    keywords: ["งานเปิดตัว", "ลงทะเบียน", "event", "ซองฟรี", "first release"],
  },
] as const;

let sheetKnowledgeCache: KnowledgeCache | null = null;
let cardDbCache: CardDbCache | null = null;
let cardSkillDbCache: CardSkillDbCache | null = null;
const siteKnowledgeCache = new Map<string, SiteCacheEntry>();
const cardImageScanCache = new Map<string, SiteCacheEntry>();
const BUNDLED_CARD_SKILL_DB = bundledCardSkillDbJson as { cards?: unknown };

const BLAZE_RESPONSE_POLICY = [
  "Blaze answer policy:",
  "- Answer the exact user question first. Do not add sales closing lines, examples, or unrelated suggestions unless the user asks.",
  "- Do not automatically start factual answers with 'ข้า'. Use 'ข้า' only when Blaze is explicitly referring to himself, introducing himself, apologizing, or describing an action he is taking. Card facts, set facts, rules, counts, and database answers should start directly with the answer.",
  "- If the user asks for a list, all options, every matching item, 'what are they', 'which sets', rewards, or conditions, enumerate every matching record found in the provided DATA/context. Never give only examples or a partial list when the data contains more matches.",
  "- For set/collection overview questions, answer only the count and the set names. Do not list sample cards inside each set unless the user specifically asks for cards or details.",
  "- For list/count questions, do not add motivational outros, marketing copy, or closing suggestions after the list.",
  "- For reward-filter questions such as 100,000, 1 แสน, PlayStation, Gold One, or any reward value, include every set/collection/product row that matches that reward.",
  "- The canonical collection index is the highest-priority source for collection set rewards, set counts, and card numbers inside sets. Use it before live site snippets.",
  "- If the user asks which collection sets a card belongs to, answer from the canonical card-to-collection membership derived from the collection index.",
  "- NEXORA cards have two card types: monster cards have ATK and SUP only with no skill text; skill cards have effect/skill text only and no direct ATK/SUP stat. Never show 'ยังไม่มีข้อมูลใน Card DB' placeholders for fields that do not belong to that card type.",
  "- NEXORA has five elements shown by crystal color: brown = earth, blue = water, dark orange/red = fire, green = wood, yellow/gold = gold. When answering about a card, include its element when known or inferred from the card index.",
  "- For deck advice, buffs, combo, strong/annoying/control skill questions, behave like a knowledgeable game friend: recommend cards from CARD DB, explain why they fit, mention element/type, and keep the advice practical.",
  "- For broad gameplay questions such as combos, deck building, element strategy, 'use with what', or 'how to play this line', do not require an exact skill keyword match. Build practical advice from card element, card type, ATK/SUP, and skill text.",
  "- For precise skill questions with a clear ability, answer the exact matching card first and keep it short. Only add nearby skill suggestions under a clearly labeled 'similar/nearby' section, and never present nearby cards as the exact answer.",
  "- Mention Line Official @Nexoracard only for purchase, sales, product order, dealer, shipping, or product price questions. Never mention Line for lore, rules, rewards, collection sets, card facts, or general knowledge questions.",
  "- If the provided DATA/context is incomplete or ambiguous, say that the answer is based on the records currently found, then list all found records without inventing missing ones.",
  "- Prefer complete factual answers over short marketing summaries. Use as much length as needed to be complete.",
].join("\n");

const BLAZE_FORMATTING_POLICY = [
  "Blaze formatting policy:",
  "- Always make long answers easy to scan. Put the direct answer in the first 1-2 lines, then split details into short labeled sections.",
  "- For card answers, use this plain-text structure when relevant: ข้อมูลการ์ด, ค่าสเตตัส, รางวัล/ชุดสะสม, สกิล/วิธีใช้, หมายเหตุ.",
  "- Put each field on its own line. Never pack card number, name, type, element, rarity, ATK, SUP, rewards, and sets into one long paragraph.",
  "- For lists, put one item per line with a simple number like 1. 2. 3. or a hyphen. Do not separate many items with commas in one paragraph.",
  "- For collection/set answers, list each set on its own line with set number, name when known, card count/rarity when useful, and reward.",
  "- Keep paragraphs under 2 short sentences. Add blank lines between major sections.",
  "- Do not use Markdown styling characters such as **, *, #, or code fences. Plain text with line breaks is the standard.",
].join("\n");

const NEXORA_CARD_FEST_KNOWLEDGE = [
  "NEXORA Card Fest / เนคโชร่าเฟส canonical event update:",
  "- Nexora Card Fest คือคอนเสิร์ตการ์ดเกมครั้งแรกของเมืองไทยในโลก NEXORA รวมบรรยากาศการ์ดเกม คอนเสิร์ต กิจกรรมแฟนด้อม และความสนุกแบบเฟสติวัลไว้ในงานเดียว",
  "- ชื่องานที่ใช้สื่อสาร: เนคโชร่าเฟส, Nexora Card Fest, NEXORA Card Fest",
  "- วันที่จัดงาน: 24 ตุลาคม 2569",
  "- สถานที่: แฟชั่น ไอส์แลนด์ ฮอลล์ ชั้น 3 / ไอส์แลนด์ ฮอลล์ แฟชั่นไอส์แลนด์ รามอินทรา ชั้น 3",
  "- ภายในงานมีคอนเสิร์ตการ์ดเกมในฮอลล์ติดแอร์ รวมสายการ์ดเกมและศิลปิน",
  "- มีการจัดแข่งขันหรือประกวดคอสเพลย์ภายในงาน",
  "- รายชื่อศิลปิน/ไลน์อัปเบื้องต้นที่ประกาศ: DAOU, PIXXIE, MEAN, WONDERFRAME, F.HERO",
  "- เปิดจำหน่ายบัตรวันที่ 1 กรกฎาคม 2569 เวลา 09:09 น.",
  "- ช่องทางจำหน่ายบัตรที่ประกาศ: alticket ทั่วประเทศ, เคาน์เตอร์เซอร์วิสที่ 7-11 ทุกสาขา, เพจ Nexora เนคโชร่าการ์ดเกมส์, จุดจำหน่ายตัวแทนเนคโชร่าการ์ดมากกว่า 10 สาขา และ QR code ตามสื่อประชาสัมพันธ์",
  "- ราคาบัตรเบื้องต้น: โซน A 4,500 บาท; โซน B/C/D 3,500 บาท; โซน F 2,500 บาท; โซน G/H 2,000 บาท; โซน J 1,500 บาท. จำนวนบัตรมีจำกัด",
  "- จุดขายของงาน: ครั้งแรกในประเทศสำหรับคอนเสิร์ตการ์ดเกม, งานสบายๆ ในฮอลล์ติดแอร์, เดินทางง่าย ใกล้ถนนหลัก และมีป้ายบอกทางชัดเจน",
  "- ข้อมูลคอนเสิร์ต ตาราง ศิลปิน กิจกรรม คอสเพลย์ ราคาบัตร ช่องทางจอง และรายละเอียดหน้างานอาจอัปเดตได้ตลอดเวลา ให้แนะนำติดตามประกาศล่าสุดจากเพจ Facebook ทางการ Nexora เนคโชร่าการ์ดเกมส์เสมอ: https://www.facebook.com/NexoraCardGame/",
  "- เมื่อตอบเรื่อง Nexora Card Fest หรือคอนเสิร์ต ให้แปะลิงก์เพจ https://www.facebook.com/NexoraCardGame/ เป็นช่องทางอัปเดตล่าสุดเสมอ",
].join("\n");

const POINT_REDEMPTION_LOCATION_URL = "https://maps.app.goo.gl/oUfs7y5LtNaBTSzm7";

function createRewardAliases(amount: string, ...extraAliases: string[]) {
  const numeric = amount.replace(/[^0-9]/g, "");
  return [numeric, amount, amount.replace(/,/g, ""), ...extraAliases].filter(Boolean);
}

function formatCollectionCardNumberForAi(cardId: number) {
  return String(cardId).padStart(3, "0");
}

function createCollectionRewardAliases(
  reward: string,
  finish: "normal" | "foil"
) {
  const amountAliases = Array.from(
    new Set(
      Array.from(reward.matchAll(/[0-9][0-9,]*/g))
        .map((match) => match[0])
        .flatMap((amount) => createRewardAliases(amount))
    )
  );

  return Array.from(
    new Set(
      [
        reward,
        ...amountAliases,
        finish === "foil" ? "foil" : "normal",
        finish === "foil" ? "ฟอยล์" : "ธรรมดา",
      ].filter(Boolean)
    )
  );
}

const COLLECTION_SETS: CollectionSetRecord[] = nexoraCollectionSets.map((set) => {
  const finish = set.finish || "normal";
  const cardIds = getCollectionCardIds(set);
  const finishLabel = finish === "foil" ? "foil / การ์ดฟอยล์" : "normal / การ์ดธรรมดา";
  const cards = set.groups.map(
    (group) =>
      `${group.label}: ${group.cardIds.map(formatCollectionCardNumberForAi).join(", ")}`
  );

  return {
    id: set.order,
    name: set.name || `Collection Set ${set.order}`,
    aliases: [
      `ชุดการ์ดสะสมที่ ${set.order}`,
      `เซ็ต ${set.order}`,
      `ชุด ${set.order}`,
      `set ${set.order}`,
      set.subtitle,
      finish === "foil" ? `ชุดฟอยล์ ${set.order}` : `ชุดธรรมดา ${set.order}`,
    ].filter(Boolean),
    reward: set.reward,
    rewardAliases: createCollectionRewardAliases(set.reward, finish),
    level: set.tier,
    rarity: `${set.stars}; finish ${finishLabel}`,
    cardCount: set.officialTotal || cardIds.length,
    cards,
    cardNumberLines: cards,
    rule: set.story,
    statusNote:
      set.appVisible === false
        ? "AI canonical only; hidden from the app Collections page by request"
        : undefined,
    sourceUrl: NEXORA_COLLECTION_SOURCE_URL,
  };
});

const BLAZE_COLLECTION_REWARD_INDEX = buildCollectionCanonicalIndex();
const BLAZE_CARD_REWARD_INDEX = buildCardRewardCanonicalIndex();

function sanitizeText(value: unknown) {
  return String(value || "").trim();
}

function isErrorLikeReply(value: unknown) {
  const text = sanitizeText(value).toLowerCase();

  if (!text) {
    return true;
  }

  return [
    "error:",
    "temporary service disruptions",
    "unrestricted key",
    "api key",
    "invalid api key",
    "permission denied",
    "forbidden",
    "unauthenticated",
    "quota",
    "rate limit",
    "missing api key",
    "api_fail",
    "invalid_json_response",
  ].some((needle) => text.includes(needle));
}

function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GENERATIVE_LANGUAGE_API_KEY ||
    ""
  ).trim();
}

function normalizeHistory(value: unknown): BlazeHistoryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const maybeItem = item as { role?: unknown; text?: unknown };
      const role = maybeItem?.role === "model" ? "model" : "user";
      const text = sanitizeText(maybeItem?.text).slice(0, 1800);
      return text ? { role, text } : null;
    })
    .filter(Boolean)
    .slice(-MAX_HISTORY_ITEMS) as BlazeHistoryItem[];
}

function normalizeImagePayload(value: unknown): BlazeImagePayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const mimeType = sanitizeText(record.mimeType).toLowerCase();
  const rawBase64 = sanitizeText(record.base64Data);
  const base64Data = rawBase64.includes(",")
    ? rawBase64.slice(rawBase64.indexOf(",") + 1)
    : rawBase64;
  const size = Math.max(0, Number(record.size || 0) || 0);
  const name = sanitizeText(record.name) || "card-image";

  if (!mimeType.startsWith("image/") || !base64Data) {
    return null;
  }

  if (size > 8 * 1024 * 1024 || base64Data.length > 11_500_000) {
    throw new Error("รูปใหญ่เกินไป กรุณาใช้รูปไม่เกิน 8MB หลังบีบอัด");
  }

  return {
    mimeType,
    base64Data,
    size,
    name,
  };
}

async function loadLocalCardImagePayload(cardNoNormalized: string) {
  const cleanNo = sanitizeText(cardNoNormalized).padStart(3, "0");

  if (!/^\d{3}$/.test(cleanNo)) {
    return null;
  }

  const candidates = [
    { ext: "jpg", mimeType: "image/jpeg" },
    { ext: "jpeg", mimeType: "image/jpeg" },
    { ext: "png", mimeType: "image/png" },
    { ext: "webp", mimeType: "image/webp" },
  ];

  for (const candidate of candidates) {
    try {
      const filePath = path.join(
        process.cwd(),
        "public",
        "cards",
        `${cleanNo}.${candidate.ext}`
      );
      const buffer = await readFile(filePath);

      return {
        mimeType: candidate.mimeType,
        base64Data: buffer.toString("base64"),
        size: buffer.byteLength,
        name: `${cleanNo}.${candidate.ext}`,
      };
    } catch {
      // Try the next supported image extension.
    }
  }

  return null;
}

function trimOverusedBlazeOpening(text: string) {
  return String(text || "")
    .replace(
      /^ข้า\s+(?=(?:จาก|ชุด|Set|การ์ด|ใบ|No\.|พบ|ไม่พบ|ยังไม่พบ|ตรวจ|ค้น|สรุป|ตาม|ใน|ธาตุ|ประเภท|ระดับ|รางวัล|คำตอบ|ระบบ|สำหรับ|ต้องขอ|ต้องแจ้ง|รับคำถาม|เชื่อมต่อ))/u,
      ""
    )
    .replace(
      /^ข้า(?=(?:ตรวจ|ค้น|สรุป|พบ|ไม่พบ|ยังไม่พบ|จาก|ต้องขอ|ต้องแจ้ง|รับคำถาม|เชื่อมต่อ))/u,
      ""
    );
}

function enforceBlazeStyle(text: string) {
  let value = sanitizeText(text)
    .replace(/ค่ะ|คะ|นะคะ|เจ้าค่ะ|เพคะ|พะยะค่ะ|พ่ะย่ะค่ะ|ดิฉัน|หนู/g, "")
    .replace(/\bฉัน\b/g, "ท่านเบลซ")
    .replace(/\bผม\b/g, "ท่านเบลซ")
    .replace(/\bกระผม\b/g, "ท่านเบลซ")
    .replace(/\*\*|```|###|##|#/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  value = trimOverusedBlazeOpening(value);

  return value || "พร้อมแล้ว ถามท่านเบลซมาได้เลย";
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNexoraCardFestQuestion(message: string) {
  const text = normalizeSearchText(message);

  return [
    "nexora card fest",
    "card fest",
    "nexora fest",
    "เนคโชร่าเฟส",
    "เนคโชร่า เฟส",
    "คอนเสิร์ตการ์ด",
    "คอนเสิร์ต การ์ด",
    "งานคอนเสิร์ต",
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));
}

function buildDirectNexoraCardFestReply(message: string) {
  if (!isNexoraCardFestQuestion(message)) {
    return "";
  }

  return [
    "Nexora Card Fest หรือ เนคโชร่าเฟส คือคอนเสิร์ตการ์ดเกมครั้งแรกของเมืองไทยในโลก NEXORA ที่รวมคอนเสิร์ต การ์ดเกม กิจกรรมแฟนด้อม และบรรยากาศเฟสติวัลไว้ในงานเดียว",
    "",
    "ข้อมูลเบื้องต้น",
    "- วันที่: 24 ตุลาคม 2569",
    "- สถานที่: แฟชั่น ไอส์แลนด์ ฮอลล์ ชั้น 3 / ไอส์แลนด์ ฮอลล์ แฟชั่นไอส์แลนด์ รามอินทรา",
    "- ภายในงานมีคอนเสิร์ตการ์ดเกมในฮอลล์ติดแอร์",
    "- มีการแข่งขันหรือประกวดคอสเพลย์ภายในงาน",
    "- ศิลปินเบื้องต้น: DAOU, PIXXIE, MEAN, WONDERFRAME, F.HERO",
    "",
    "บัตร",
    "- เปิดจำหน่ายวันที่ 1 กรกฎาคม 2569 เวลา 09:09 น.",
    "- ช่องทางที่ประกาศ: alticket, เคาน์เตอร์เซอร์วิสที่ 7-11, เพจ Nexora, จุดจำหน่ายตัวแทน และ QR code ตามสื่อประชาสัมพันธ์",
    "- ราคาเบื้องต้น: โซน A 4,500 / B-C-D 3,500 / F 2,500 / G-H 2,000 / J 1,500 บาท",
    "",
    "ข้อมูลคอนเสิร์ต ศิลปิน ตาราง กิจกรรม คอสเพลย์ ราคาบัตร และช่องทางจองอาจอัปเดตได้ตลอดเวลา ให้ติดตามประกาศล่าสุดจากเพจทางการเสมอ:",
    "https://www.facebook.com/NexoraCardGame/",
  ].join("\n");
}

function normalizeThaiDigits(value: string) {
  const thaiDigits: Record<string, string> = {
    "๐": "0",
    "๑": "1",
    "๒": "2",
    "๓": "3",
    "๔": "4",
    "๕": "5",
    "๖": "6",
    "๗": "7",
    "๘": "8",
    "๙": "9",
  };

  return value.replace(/[๐-๙]/g, (digit) => thaiDigits[digit] || digit);
}

function normalizeCardNumber(value: string) {
  const digits = normalizeThaiDigits(value).replace(/[^0-9]/g, "");

  if (!digits) {
    return "";
  }

  const number = Number(digits.slice(-3));
  if (!Number.isFinite(number) || number < 1 || number > 293) {
    return "";
  }

  return String(number).padStart(3, "0");
}

function buildCollectionCanonicalIndex() {
  const rewardGroups = COLLECTION_SETS.reduce<Record<string, number[]>>(
    (groups, set) => {
      const key = set.reward;
      groups[key] = [...(groups[key] || []), set.id];
      return groups;
    },
    {}
  );

  const rewardLines = Object.entries(rewardGroups).map(
    ([reward, ids]) => `${reward} = เซ็ต ${ids.join(", ")}`
  );

  return [
    "NEXORA canonical collection set index from official card-collections page:",
    `- Total collection sets: ${COLLECTION_SETS.length}`,
    ...COLLECTION_SETS.map((set) => `- ${formatCollectionSetSummary(set)}`),
    `- Reward groups: ${rewardLines.join("; ")}`,
    "- Canonical update: NEXORA now has 40 collection sets in the AI index. Sets 20-40 are special foil collection sets from the official card-collections page.",
    "- Canonical update: Set 40 is the special 36-copy foil rule: choose one eligible foil card number, then collect that exact same foil card number repeatedly until reaching 36 copies. Do not treat the number 36 as a card number.",
    "- Canonical rule: ถ้าถามว่าเซ็ตใดตรงกับรางวัลใด ให้ใช้ดัชนีนี้ก่อน DATA/web snippet เสมอ และตอบครบทุกเซ็ตที่ match",
    "- Canonical rule: ถ้าถามภาพรวมชุดสะสม ให้ตอบจำนวนเซ็ตและชื่อ/เลขเซ็ตก่อน ไม่ต้องยกตัวอย่างการ์ด เว้นแต่ผู้ใช้ถามรายละเอียดหรือถามว่าในเซ็ตมีการ์ดอะไร",
  ].join("\n");
}

function buildCardRewardCanonicalIndex() {
  const coinLines = nexoraCoinRewards.map(
    (reward) =>
      `- No.${reward.cardNo} ${reward.cardName}: ${reward.coinValue.toLocaleString("th-TH")} COIN (${reward.confidence})`
  );
  const singleCardLines = nexoraSingleCardNexRewards.map(
    (reward) =>
      `- No.${reward.cardNo}: ${reward.nexValue.toLocaleString("th-TH")} NEX`
  );

  return [
    "NEXORA canonical card reward index:",
    `- COIN card count: ${nexoraCoinRewards.length}`,
    "- COIN rule: coin values are printed at the upper-left coin marker on the physical card image. Use this canonical index before guessing from card text.",
    ...coinLines,
    `- Single-card NEX reward source: ${NEXORA_SINGLE_CARD_REWARD_SOURCE_URL}`,
    `- Single-card NEX reward count: ${nexoraSingleCardNexRewards.length}`,
    ...singleCardLines,
  ].join("\n");
}

function formatCollectionSetOverview(set: CollectionSetRecord) {
  const alias = set.name === `ชุดการ์ดสะสมที่ ${set.id}` ? "" : ` / ${set.name}`;
  const note = set.statusNote ? ` (${set.statusNote})` : "";
  return `Set ${set.id} / ชุดการ์ดสะสมที่ ${set.id}${alias}${note}`;
}

function formatCollectionSetSummary(set: CollectionSetRecord) {
  const alias = set.name === `ชุดการ์ดสะสมที่ ${set.id}` ? "" : ` / ${set.name}`;
  const rule = set.rule ? `, rule ${set.rule}` : "";
  const note = set.statusNote ? `, note ${set.statusNote}` : "";
  return `Set ${set.id} / ชุดการ์ดสะสมที่ ${set.id}${alias}: ${set.level}, ${set.rarity}, ${set.cardCount} ใบ, reward ${set.reward}${rule}${note}`;
}

function formatCollectionSetDetail(set: CollectionSetRecord) {
  return [
    formatCollectionSetSummary(set),
    `รายการการ์ด: ${set.cards.join(" | ")}`,
    set.rule ? `กติกาพิเศษ: ${set.rule}` : "",
    set.statusNote ? `หมายเหตุ: ${set.statusNote}` : "",
    `แหล่งข้อมูล: ${set.sourceUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function collectionSearchText(set: CollectionSetRecord) {
  return normalizeSearchText(
    [
      `set ${set.id}`,
      `เซ็ต ${set.id}`,
      `ชุด ${set.id}`,
      `ชุดการ์ดสะสมที่ ${set.id}`,
      set.name,
      set.reward,
      set.level,
      set.rarity,
      set.rule,
      set.statusNote,
      ...set.aliases,
      ...set.rewardAliases,
      ...set.cards,
    ].join(" ")
  );
}

function hasCollectionIntent(message: string) {
  const text = normalizeSearchText(message);
  return [
    "เซ็ต",
    "ชุด",
    "ชุดสะสม",
    "ชุดการ์ด",
    "คอลเลกชั่น",
    "collection",
    "set",
    "ครบชุด",
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));
}

function wantsCollectionCardList(message: string) {
  const text = normalizeSearchText(message);
  return [
    "มีใบ",
    "มีใบอะไร",
    "ใบอะไร",
    "ใบอะไรบ้าง",
    "มีการ์ด",
    "การ์ดอะไร",
    "ใบไหน",
    "เลขอะไร",
    "เลขการ์ด",
    "ลำดับ",
    "รายละเอียด",
    "ข้างใน",
    "ประกอบด้วย",
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));
}

function wantsCollectionOverview(message: string) {
  const text = normalizeSearchText(message);
  return [
    "ทั้งหมด",
    "ทุกเซ็ต",
    "ทุกชุด",
    "กี่เซ็ต",
    "กี่ชุด",
    "อะไรบ้าง",
    "ไหนบ้าง",
    "รายชื่อ",
    "รายการ",
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));
}

function hasSingleCardRewardIntent(message: string) {
  const text = normalizeSearchText(message);
  return [
    "การ์ดใบเดียว",
    "การ์ด 1 ใบ",
    "การ์ดหนึ่งใบ",
    "ใบเดียว",
    "jackpot",
    "การ์ดหายาก",
    "รางวัลการ์ด",
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));
}

function extractCollectionSetId(message: string) {
  const normalized = normalizeThaiDigits(message);
  const match = normalized.match(
    /(?:set|เซ็ต|ชุด(?:การ์ดสะสม)?(?:ที่)?)\s*0*([1-9]\d?)/iu
  );
  const id = match?.[1] ? Number(match[1]) : 0;
  return id >= 1 && id <= COLLECTION_SETS.length ? id : 0;
}

function extractRewardFilter(message: string) {
  const raw = normalizeThaiDigits(message).toLowerCase();
  const digits = raw.replace(/[^0-9]/g, "");
  const text = normalizeSearchText(raw);
  const digitRewards = [
    "1500000",
    "1000000",
    "900000",
    "400000",
    "200000",
    "100000",
    "90000",
    "80000",
    "79000",
    "70000",
    "65000",
    "50000",
    "35000",
    "25000",
    "20000",
    "19000",
    "15000",
    "14000",
    "12000",
    "10000",
    "7000",
    "6000",
    "5000",
    "4500",
    "4000",
    "3500",
    "3200",
    "3000",
    "2500",
  ];

  for (const reward of digitRewards) {
    if (digits === reward || digits.endsWith(reward)) {
      return reward;
    }
  }

  if (/1\s*แสน|หนึ่งแสน|แสน/.test(raw)) return "100000";
  if (/ห้าหมื่น|50\s*,?\s*000/.test(raw)) return "50000";
  if (/เจ็ดหมื่น|70\s*,?\s*000/.test(raw)) return "70000";
  if (/หนึ่งหมื่นห้าพัน|15\s*,?\s*000/.test(raw)) return "15000";
  if (/หนึ่งหมื่นสองพัน|12\s*,?\s*000/.test(raw)) return "12000";
  if (/หนึ่งหมื่น|10\s*,?\s*000/.test(raw)) return "10000";
  if (/เจ็ดพัน|7\s*,?\s*000/.test(raw)) return "7000";
  if (/หกพัน|6\s*,?\s*000/.test(raw)) return "6000";
  if (/ห้าพัน|5\s*,?\s*000/.test(raw)) return "5000";
  if (/สี่พันห้าร้อย|4\s*,?\s*500/.test(raw)) return "4500";
  if (/สี่พัน|4\s*,?\s*000/.test(raw)) return "4000";
  if (/สามพันห้าร้อย|3\s*,?\s*500/.test(raw)) return "3500";
  if (/สามพันสองร้อย|3\s*,?\s*200/.test(raw)) return "3200";
  if (/สามพัน|3\s*,?\s*000/.test(raw)) return "3000";
  if (/สองพันห้าร้อย|2\s*,?\s*500/.test(raw)) return "2500";
  if (text.includes("gold one") || text.includes("โกลด์วัน") || text.includes("ทองคำ")) return "gold one";
  if (text.includes("playstation") || text.includes("ps5") || text.includes("เพลย์")) return "playstation";

  return "";
}

function collectionSetMatchesReward(set: CollectionSetRecord, rewardFilter: string) {
  if (!rewardFilter) {
    return false;
  }

  if (/^\d+$/.test(rewardFilter)) {
    const numericAliases = [set.reward, ...set.rewardAliases]
      .map((value) => normalizeThaiDigits(value).replace(/[^0-9]/g, ""))
      .filter(Boolean);
    return numericAliases.includes(rewardFilter);
  }

  const needle = normalizeSearchText(rewardFilter);
  const haystack = normalizeSearchText(
    [set.reward, ...set.rewardAliases].join(" ")
  );

  return haystack.includes(needle);
}

function buildDirectCollectionReply(message: string) {
  const setId = extractCollectionSetId(message);
  const rewardFilter = extractRewardFilter(message);
  const collectionIntent = hasCollectionIntent(message);
  const overview = wantsCollectionOverview(message);
  const wantsCards =
    wantsCollectionCardList(message) ||
    Boolean(setId && /\b(?:มี)?อะไรบ้าง\b|อะไรบ้าง|ข้างใน|ประกอบด้วย/u.test(message));

  if (!collectionIntent && hasSingleCardRewardIntent(message)) {
    return "";
  }

  if (!collectionIntent && !rewardFilter) {
    return "";
  }

  if (setId) {
    const set = COLLECTION_SETS.find((item) => item.id === setId);
    if (!set) {
      return "";
    }

    return enforceBlazeStyle(
      wantsCards ? formatCollectionSetDetail(set) : formatCollectionSetSummary(set)
    );
  }

  if (rewardFilter) {
    const matches = COLLECTION_SETS.filter((set) =>
      collectionSetMatchesReward(set, rewardFilter)
    );

    if (matches.length) {
      const lines = matches.map((set) =>
        wantsCards ? formatCollectionSetDetail(set) : formatCollectionSetSummary(set)
      );
      return enforceBlazeStyle(
        [`พบ ${matches.length} เซ็ตที่ตรงกับรางวัลนี้`, ...lines].join("\n")
      );
    }
  }

  if (overview) {
    return enforceBlazeStyle(
      [
        `ชุดการ์ดสะสม NEXORA มีทั้งหมด ${COLLECTION_SETS.length} เซ็ต`,
        ...COLLECTION_SETS.map((set) => formatCollectionSetOverview(set)),
      ].join("\n")
    );
  }

  return "";
}

function buildDirectCardCollectionReply(message: string) {
  if (!hasCollectionIntent(message)) {
    return "";
  }

  const cardNo = extractExplicitCardNumber(message) || normalizeCardNumber(message);
  if (!cardNo) {
    return "";
  }

  const memberships = getCardCollectionMemberships(cardNo);
  if (!memberships.length) {
    return enforceBlazeStyle(
      `การ์ด ${cardNo} ยังไม่พบในชุดสะสม canonical จากหน้าชุดคอลเลกชั่น`
    );
  }

  return enforceBlazeStyle(
    [
      `การ์ด ${cardNo} อยู่ในชุดสะสม ${memberships.length} เซ็ต`,
      ...memberships.map((set) => formatCollectionSetSummary(set)),
    ].join("\n")
  );
}

function hasPointRedemptionProcessIntent(message: string) {
  const text = normalizeSearchText(message);
  const raw = normalizeThaiDigits(message).toLowerCase();
  const hasPointSubject = [
    "nex",
    "coin",
    "แต้ม",
    "พอยท์",
    "point",
    "nexora tcg",
    "การ์ด",
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));
  const hasRedemptionIntent =
    text.includes("แลก") ||
    text.includes("เพิ่มแต้ม") ||
    text.includes("เข้าระบบ") ||
    text.includes("สะสมแต้ม");
  const hasProcessIntent = [
    "ยังไง",
    "อย่างไร",
    "วิธี",
    "ขั้นตอน",
    "ทำไง",
    "ทำยังไง",
    "ทำอย่างไร",
    "ได้ไหม",
    "ที่ไหน",
    "นำการ์ด",
    "ส่งการ์ด",
    "ส่งมา",
    "ขนส่ง",
    "พัสดุ",
    "เปิดกล่อง",
    "วิดีโอ",
    "วีดีโอ",
    "สภาพการ์ด",
    "ตรวจสภาพ",
    "หน้าร้าน",
    "ที่ร้าน",
    "พิกัด",
    "แผนที่",
    "รับความเสี่ยง",
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));

  return (
    hasPointSubject &&
    (hasRedemptionIntent || raw.includes("redeem")) &&
    hasProcessIntent
  );
}

function buildDirectPointRedemptionReply(message: string) {
  if (!hasPointRedemptionProcessIntent(message)) {
    return "";
  }

  return enforceBlazeStyle(
    [
      "การแลกแต้ม NEX / COIN เข้าระบบ NEXORA TCG ต้องนำการ์ดจริงให้บริษัทตรวจสอบก่อนเพิ่มแต้มเข้าบัญชี",
      "ขั้นตอนหลักมีดังนี้",
      "1. ลูกค้าสามารถนำการ์ดมาที่หน้าร้านด้วยตนเองได้ วิธีนี้เป็นทางเลือกที่แนะนำที่สุด เพราะปลอดภัยต่อสภาพการ์ดมากที่สุด",
      "2. หากไม่สะดวกมาหน้าร้าน ลูกค้าสามารถส่งการ์ดมาทางขนส่งได้ แต่ลูกค้าต้องรับความเสี่ยงเรื่องสภาพการ์ดระหว่างขนส่งเอง",
      "3. เมื่อบริษัทได้รับพัสดุแล้ว บริษัทจะถ่ายวิดีโอขณะเปิดกล่องพัสดุ และตรวจสภาพการ์ดอย่างละเอียดให้ลูกค้าดูเพื่อใช้ยืนยันร่วมกัน",
      "4. หากการ์ดเป็นของแท้และสภาพสมบูรณ์ประมาณ 90-100% บริษัทจะเพิ่มแต้ม NEX / COIN เข้าบัญชีของลูกค้าในแอพ NEXORA TCG ทันที",
      "5. หากลูกค้าสะดวกเดินทางมาเอง ควรนำการ์ดมาที่หน้าร้านโดยตรงเพื่อความปลอดภัยสูงสุดของการ์ด",
      `พิกัดหน้าร้าน: ${POINT_REDEMPTION_LOCATION_URL}`,
      "ข้อแนะนำ: หากเลือกส่งพัสดุ ควรแพ็กการ์ดให้แน่นหนา ป้องกันการงอ กระแทก ความชื้น และรอยเสียหายระหว่างขนส่ง",
    ].join("\n")
  );
}

function hasNexPointRewardCouponIntent(message: string) {
  const text = normalizeSearchText(message);
  const raw = normalizeThaiDigits(message).toLowerCase();
  const hasRewardSubject = [
    "รางวัล",
    "ของรางวัล",
    "คูปอง",
    "coupon",
    "แลกรางวัล",
    "รับรางวัล",
    "nexora tcg",
    "แอพ",
    "app",
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));
  const hasCouponProcess = [
    "คูปอง",
    "coupon",
    "qr",
    "คิวอาร์",
    "สแกน",
    "ยิง",
    "พนักงาน",
    "หน้าร้าน",
    "ที่ร้าน",
    "หัก ณ ที่จ่าย",
    "หักภาษี",
    "ตามกฎหมาย",
    "ใช้คูปอง",
    "ยืนยันคูปอง",
    "รับของ",
    "รับรางวัล",
    "แลกจริง",
    "แลกรางวัลจริง",
    "หมดก่อน",
    "ใครไว",
    "limited",
    "ลิมิเต็ด",
    "จำนวนจำกัด",
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));

  return hasRewardSubject && (hasCouponProcess || raw.includes("reward"));
}

function buildDirectNexPointRewardCouponReply(message: string) {
  if (!hasNexPointRewardCouponIntent(message)) {
    return "";
  }

  return enforceBlazeStyle(
    [
      "ในแอพ NEXORA TCG จะมีรางวัลให้แลกหลายระดับ ตั้งแต่รางวัลเล็ก รางวัลลิมิเต็ดจำนวนจำกัดจาก NEXORA แบบใครแลกก่อนได้ก่อนจนกว่าคูปองจะหมด ไปจนถึงรางวัลใหญ่",
      "ขั้นตอนการแลกรางวัลจริงมีดังนี้",
      "1. ลูกค้ากดแลกรางวัลในแอพ NEXORA TCG ให้สำเร็จก่อน ระบบจะออกคูปองสำหรับรางวัลนั้นให้ในแอพ",
      "2. ลูกค้านำคูปองที่กดแลกได้มาแสดงที่หน้าร้าน",
      "3. พนักงานตรวจสอบคูปอง แล้วสแกนหรือยิง QR Code บนคูปองเพื่อยืนยันการใช้งาน",
      "4. เมื่อยืนยันคูปองสำเร็จ บริษัทจะดำเนินการหัก ณ ที่จ่ายสำหรับการแลกรางวัลตามที่กฎหมายกำหนด",
      "5. หลังจากดำเนินการครบถ้วน พนักงานจะมอบรางวัลให้ลูกค้า ถือว่าการแลกรางวัลเสร็จสมบูรณ์",
      "หมายเหตุ: รางวัลบางรายการมีจำนวนจำกัด หากคูปองหมดแล้วจะไม่สามารถแลกรายการนั้นได้ ต้องยึดสถานะคูปองและสต็อกในแอพเป็นหลัก",
    ].join("\n")
  );
}

function extractCardNumbersFromCollectionSet(set: CollectionSetRecord) {
  const lines = set.cardNumberLines ?? set.cards;
  return lines.flatMap((line) =>
    Array.from(line.matchAll(/\b0*([1-9]\d{0,2})\b/g))
      .map((match) => normalizeCardNumber(match[1] || ""))
      .filter(Boolean)
  );
}

function getCardCollectionMemberships(cardNo: string) {
  const normalized = normalizeCardNumber(cardNo);
  if (!normalized) {
    return [];
  }

  return COLLECTION_SETS.filter((set) =>
    extractCardNumbersFromCollectionSet(set).includes(normalized)
  );
}

function formatCardCollectionMemberships(cardNo: string) {
  const memberships = getCardCollectionMemberships(cardNo);
  if (!memberships.length) {
    return "";
  }

  return memberships
    .map((set) => `Set ${set.id} (${set.reward})`)
    .join(", ");
}

function normalizeHeaderKey(value: string) {
  return normalizeSearchText(value).replace(/\s+/g, "_");
}

function getDataSheetCsvUrl() {
  return (
    process.env.BLAZE_DATA_SHEET_CSV_URL ||
    process.env.NEXORA_DATA_SHEET_CSV_URL ||
    DEFAULT_DATA_SHEET_CSV_URL
  ).trim();
}

function getCardDbCsvUrl() {
  return (
    process.env.BLAZE_CARD_DB_CSV_URL ||
    process.env.NEXORA_CARD_DB_CSV_URL ||
    DEFAULT_CARD_DB_CSV_URL
  ).trim();
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let line = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      line += char + next;
      index++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      line += char;
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (line.trim()) {
        rows.push(parseCsvLine(line));
      }
      line = "";
      if (char === "\r" && next === "\n") {
        index++;
      }
      continue;
    }

    line += char;
  }

  if (line.trim()) {
    rows.push(parseCsvLine(line));
  }

  return rows;
}

function csvRowsToKnowledgeRows(csv: string): KnowledgeRow[] {
  const rows = parseCsv(csv);
  const [header, ...body] = rows;

  if (!header || !header.some((cell) => cell.toLowerCase() === "key")) {
    return [];
  }

  const indexOf = (name: string) =>
    header.findIndex((cell) => cell.trim().toLowerCase() === name);

  const keyIndex = indexOf("key");
  const valueIndex = indexOf("value");
  const categoryIndex = indexOf("category");
  const sourceIndex = indexOf("source_url");
  const priorityIndex = indexOf("priority");
  const notesIndex = indexOf("notes");

  return body
    .map((row) => {
      const key = sanitizeText(row[keyIndex]);
      const value = sanitizeText(row[valueIndex]);

      if (!key || !value || key.toLowerCase() === "key") {
        return null;
      }

      return {
        key,
        value,
        category: sanitizeText(row[categoryIndex]),
        sourceUrl: sanitizeText(row[sourceIndex]),
        priority: Math.max(1, Number(row[priorityIndex] || 2) || 2),
        notes: sanitizeText(row[notesIndex]),
      };
    })
    .filter(Boolean) as KnowledgeRow[];
}

function csvRowsToCardDbRows(csv: string): CardDbRow[] {
  const rows = parseCsv(csv);
  const [header, ...body] = rows;

  if (!header?.length) {
    return [];
  }

  const headers = header.map((cell) => normalizeHeaderKey(cell));
  const findIndex = (aliases: string[]) =>
    headers.findIndex((headerName) => aliases.includes(headerName));

  const noIndex = findIndex([
    "card_no",
    "cardno",
    "card_number",
    "number",
    "no",
    "เลขการ์ด",
    "หมายเลข",
  ]);
  const nameIndex = findIndex([
    "card_name",
    "cardname",
    "name",
    "ชื่อการ์ด",
    "ชื่อ",
  ]);
  const rewardIndex = findIndex(["reward", "รางวัล"]);
  const valueIndex = findIndex(["value", "rarity", "ระดับ", "ชนิด"]);
  const skillIndex = findIndex(["skill", "skills", "ability", "effect", "สกิล", "ความสามารถ"]);
  const atkIndex = findIndex(["atk", "attack", "โจมตี", "พลังโจมตี"]);
  const supIndex = findIndex(["sup", "support", "สนับสนุน", "พลังสนับสนุน"]);
  const elementIndex = findIndex(["element", "ธาตุ"]);
  const imageIndex = findIndex([
    "image_url",
    "image",
    "img",
    "url",
    "รูป",
    "รูปภาพ",
  ]);

  if (noIndex < 0 || nameIndex < 0) {
    return [];
  }

  return body
    .map((row) => {
      const cardNo = sanitizeText(row[noIndex]);
      const cardNoNormalized = normalizeCardNumber(cardNo);
      const cardName = sanitizeText(row[nameIndex]);

      if (!cardNoNormalized || !cardName) {
        return null;
      }

      const reward = sanitizeText(row[rewardIndex]);
      const value = sanitizeText(row[valueIndex]);
      const skill = sanitizeText(row[skillIndex]);
      const atk = sanitizeText(row[atkIndex]);
      const sup = sanitizeText(row[supIndex]);
      const element = sanitizeText(row[elementIndex]);
      const rawText = "";
      const imageUrl = sanitizeText(row[imageIndex]);
      const searchText = normalizeSearchText(
        `${cardNo} ${cardNoNormalized} ${cardName} ${reward} ${value} ${skill} ${atk} ${sup} ${element} ${rawText}`
      );

      return {
        cardNo,
        cardNoNormalized,
        cardName,
        reward,
        value,
        imageUrl,
        skill,
        atk,
        sup,
        element,
        rawText,
        searchText,
      };
    })
    .filter(Boolean) as CardDbRow[];
}

function normalizeCardSkillDbEntry(value: unknown): CardSkillDbEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const cardNoNormalized = normalizeCardNumber(sanitizeText(record.cardNo));

  if (!cardNoNormalized) {
    return null;
  }

  return {
    cardNo: cardNoNormalized,
    cardName: sanitizeText(record.cardName),
    skill: sanitizeText(record.skill),
    atk: sanitizeText(record.atk),
    sup: sanitizeText(record.sup),
    element: sanitizeText(record.element),
    rarity: sanitizeText(record.rarity),
    type: sanitizeText(record.type),
    rawText: sanitizeText(record.rawText),
    confidence: sanitizeText(record.confidence) || "pending",
    reviewed: record.reviewed === true,
    sourceImage: sanitizeText(record.sourceImage) || `/cards/${cardNoNormalized}.jpg`,
    scannedAt: sanitizeText(record.scannedAt),
    notes: sanitizeText(record.notes),
  };
}

function buildCardSkillDbCacheFromSource(source: unknown, now: number) {
  const parsed = source as { cards?: unknown };
  const rows = Array.isArray(parsed.cards)
    ? parsed.cards.map(normalizeCardSkillDbEntry).filter(Boolean)
    : [];
  const normalizedRows = rows as CardSkillDbEntry[];
  const byNo = new Map(normalizedRows.map((row) => [row.cardNo, row]));

  return {
    expiresAt: now + CARD_DB_CACHE_MS,
    rows: normalizedRows,
    byNo,
  };
}

async function loadCardSkillDb() {
  const now = Date.now();

  if (cardSkillDbCache && cardSkillDbCache.expiresAt > now) {
    return cardSkillDbCache;
  }

  try {
    const filePath = path.join(process.cwd(), "public", "cards", "card-skill-db.json");
    const raw = await readFile(filePath, "utf8");
    cardSkillDbCache = buildCardSkillDbCacheFromSource(JSON.parse(raw), now);
    return cardSkillDbCache;
  } catch (error) {
    console.warn("BLAZE card skill DB fallback:", error);
    cardSkillDbCache = buildCardSkillDbCacheFromSource(BUNDLED_CARD_SKILL_DB, now);
    return cardSkillDbCache;
  }
}

function isUsefulCardSkillEntry(entry: CardSkillDbEntry) {
  return Boolean(
    entry.cardName ||
      entry.skill ||
      entry.atk ||
      entry.sup ||
      entry.element ||
      entry.rarity ||
      entry.rawText
  );
}

function buildCardRowSearchText(row: Omit<CardDbRow, "searchText">) {
  return normalizeSearchText(
    [
      row.cardNo,
      row.cardNoNormalized,
      row.cardName,
      row.reward,
      row.value,
      row.skill,
      row.atk,
      row.sup,
      row.element,
      row.rawText,
    ].join(" ")
  );
}

function mergeCardSkillDbRows(
  rows: CardDbRow[],
  skillByNo: Map<string, CardSkillDbEntry>
) {
  if (!skillByNo.size) {
    return rows;
  }

  return rows.map((row) => {
    const skillRow = skillByNo.get(row.cardNoNormalized);

    if (!skillRow || !isUsefulCardSkillEntry(skillRow)) {
      return row;
    }

    const merged = {
      ...row,
      cardName: row.cardName || skillRow.cardName,
      value: row.value || skillRow.rarity,
      imageUrl: row.imageUrl || skillRow.sourceImage,
      skill: row.skill || skillRow.skill,
      atk: row.atk || skillRow.atk,
      sup: row.sup || skillRow.sup,
      element: row.element || skillRow.element,
      rawText: row.rawText || skillRow.rawText,
    };

    return {
      ...merged,
      searchText: buildCardRowSearchText(merged),
    };
  });
}

function cardSkillDbRowsToCardDbRows(rows: CardSkillDbEntry[]): CardDbRow[] {
  return rows.filter(isUsefulCardSkillEntry).map((row) => {
    const cardRow = {
      cardNo: row.cardNo,
      cardNoNormalized: row.cardNo,
      cardName: row.cardName,
      reward: "",
      value: row.rarity,
      imageUrl: row.sourceImage,
      skill: row.skill,
      atk: row.atk,
      sup: row.sup,
      element: row.element,
      rawText: row.rawText,
    };

    return {
      ...cardRow,
      searchText: buildCardRowSearchText(cardRow),
    };
  });
}

async function loadCardDbRows() {
  const now = Date.now();

  if (cardDbCache && cardDbCache.expiresAt > now) {
    return cardDbCache.rows;
  }

  const skillDb = await loadCardSkillDb();

  try {
    const response = await fetchWithTimeout(
      getCardDbCsvUrl(),
      {
        method: "GET",
        headers: {
          "User-Agent": "NEXORA-Blaze-AI/1.0",
        },
      },
      5500
    );
    const csv = await response.text();

    if (!response.ok || !csv.includes("card_no") || !csv.includes("card_name")) {
      throw new Error(`card DB sheet unavailable (${response.status})`);
    }

    const rows = mergeCardSkillDbRows(csvRowsToCardDbRows(csv), skillDb.byNo);
    if (rows.length < 293) {
      throw new Error(`card DB incomplete (${rows.length}/293)`);
    }

    cardDbCache = {
      expiresAt: now + CARD_DB_CACHE_MS,
      rows,
    };

    return rows;
  } catch (error) {
    console.warn("BLAZE card DB fallback:", error);
    return cardDbCache?.rows || cardSkillDbRowsToCardDbRows(skillDb.rows);
  }
}

function isCardDbQuestion(message: string) {
  if (isBlazeIdentityQuestion(message)) {
    return false;
  }

  const text = normalizeSearchText(message);

  return [
    "การ์ด",
    "card",
    "no",
    "เลขการ์ด",
    "หมายเลข",
    "ใบนี้",
    "ใบที่",
    "ชื่อ",
    "รางวัล",
    "แลกรับ",
    "ได้อะไร",
    "ระดับ",
    "rarity",
    "value",
    "สกิล",
    "ความสามารถ",
    "skill",
    "ability",
    "atk",
    "sup",
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));
}

function isBlazeIdentityQuestion(message: string) {
  const text = normalizeSearchText(message);
  const asksIdentity = [
    "ชื่ออะไร",
    "ชื่อไร",
    "คือใคร",
    "เป็นใคร",
    "ใคร",
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));
  const targetsBlaze = [
    "นาย",
    "คุณ",
    "เอไอ",
    "ai",
    "บอท",
    "ท่านเบลซ",
    "เบลซ",
    "blaze",
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));
  const targetsCard = [
    "การ์ด",
    "ใบนี้",
    "ใบที่",
    "เลข",
    "หมายเลข",
    "no",
    "card",
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));

  return asksIdentity && targetsBlaze && !targetsCard;
}

function buildDirectBlazeIdentityReply(message: string) {
  if (!isBlazeIdentityQuestion(message)) {
    return "";
  }

  return enforceBlazeStyle(
    "ข้าคือท่านเบลซ หรือ Blaze Warlock ผู้ช่วย AI ประจำโลก NEXORA พร้อมช่วยตอบเรื่องการ์ด ระบบในแอพ ตลาด คอมมูนิตี้ และเรื่องทั่วไปให้ได้"
  );
}

function isCardLookupQuestion(message: string) {
  const text = normalizeSearchText(message);
  const hasLookupField = [
    "ใบนี้",
    "ใบที่",
    "ชื่อ",
    "รางวัล",
    "แลกรับ",
    "ได้อะไร",
    "ระดับ",
    "rarity",
    "value",
    "no",
    "สกิล",
    "ความสามารถ",
    "skill",
    "ability",
    "atk",
    "sup",
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));
  const looksLikeCountQuestion = [
    "ทั้งหมด",
    "กี่ใบ",
    "มีกี่",
    "จำนวน",
    "รวม",
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));

  if (looksLikeCountQuestion && !hasLookupField) {
    return false;
  }

  return (
    Boolean(extractExplicitCardNumber(message)) ||
    hasLookupField
  );
}

function extractExplicitCardNumber(text: string) {
  const normalized = normalizeThaiDigits(text);
  const patterns = [
    /(?:no\.?|card|#|เลขการ์ด|หมายเลขการ์ด|การ์ด|ใบที่)\s*0*([1-9]\d{0,2})/giu,
    /0*([1-9]\d{0,2})\s*(?:ชื่อ|รางวัล|แลก|ได้อะไร|ระดับ|rarity|value)/giu,
    /(?:ชื่อ|รางวัล|แลก|ได้อะไร|ระดับ|rarity|value)\s*(?:ของ)?\s*(?:การ์ด|card|no\.?|#)?\s*0*([1-9]\d{0,2})/giu,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(normalized);
    if (!match?.[1]) {
      continue;
    }

    const cardNo = normalizeCardNumber(match[1]);
    if (cardNo) {
      return cardNo;
    }
  }

  const standalone = normalized.match(/(?:^|[^\d])0*([1-9]\d{0,2})(?:[^\d]|$)/u);
  if (standalone?.[1] && isCardDbQuestion(text)) {
    return normalizeCardNumber(standalone[1]);
  }

  return "";
}

function extractCardNumberFromConversation(
  message: string,
  history: BlazeHistoryItem[]
) {
  const direct = extractExplicitCardNumber(message);
  if (direct) {
    return direct;
  }

  for (const item of [...history].reverse()) {
    const cardNo = extractExplicitCardNumber(item.text);
    if (cardNo) {
      return cardNo;
    }
  }

  return "";
}

function scoreCardDbRow(row: CardDbRow, message: string) {
  const query = normalizeSearchText(message);
  if (!query) {
    return 0;
  }

  let score = 0;
  const normalizedCardNo = extractExplicitCardNumber(message);
  if (normalizedCardNo && row.cardNoNormalized === normalizedCardNo) {
    score += 2000;
  }

  const cardName = normalizeSearchText(row.cardName);
  if (cardName && query === cardName) {
    score += 1200;
  } else if (cardName && query.includes(cardName)) {
    score += 900;
  }

  const tokens = query
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter(
      (token) =>
        ![
          "การ์ด",
          "card",
          "ชื่อ",
          "รางวัล",
          "อะไร",
          "ได้",
          "แลก",
          "ระดับ",
          "ใบนี้",
          "ใบที่",
        ].includes(token)
    );

  for (const token of tokens) {
    if (row.searchText.includes(token)) {
      score += token.length > 3 ? 35 : 18;
    }
  }

  return score;
}

function findCardDbMatches(
  rows: CardDbRow[],
  message: string,
  history: BlazeHistoryItem[]
) {
  const cardNo = extractCardNumberFromConversation(message, history);
  if (cardNo) {
    const exact = rows.find((row) => row.cardNoNormalized === cardNo);
    return {
      exact,
      matches: exact ? [exact] : [],
      cardNo,
    };
  }

  const matches = rows
    .map((row) => ({
      row,
      score: scoreCardDbRow(row, message),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.row.cardNoNormalized.localeCompare(b.row.cardNoNormalized))
    .slice(0, 8)
    .map((item) => item.row);

  return {
    exact: matches.length === 1 ? matches[0] : null,
    matches,
    cardNo: "",
  };
}

function includesAnyThaiOrEnglish(value: string, terms: string[]) {
  const raw = value.toLowerCase();
  const normalized = normalizeSearchText(value);

  return terms.some((term) => {
    const cleanTerm = term.toLowerCase();
    return raw.includes(cleanTerm) || normalized.includes(normalizeSearchText(term));
  });
}

function getRequestedCardElements(message: string): CardElement[] {
  const elements: CardElement[] = [];
  const add = (element: CardElement) => {
    if (element !== "unknown" && !elements.includes(element)) {
      elements.push(element);
    }
  };

  if (includesAnyThaiOrEnglish(message, ["ธาตุดิน", "สายดิน", "ปฐพี", "สีน้ำตาล", "earth"])) add("earth");
  if (includesAnyThaiOrEnglish(message, ["ธาตุน้ำ", "สายน้ำ", "วารี", "สีฟ้า", "water", "aqua"])) add("water");
  if (includesAnyThaiOrEnglish(message, ["ธาตุไฟ", "สายไฟ", "เพลิง", "สีส้ม", "fire", "flame"])) add("fire");
  if (includesAnyThaiOrEnglish(message, ["ธาตุไม้", "สายไม้", "พฤกษา", "สีเขียว", "wood", "nature", "forest"])) add("wood");
  if (includesAnyThaiOrEnglish(message, ["ธาตุทอง", "สายทอง", "โลหะ", "สีเหลือง", "gold", "metal"])) add("gold");

  return elements;
}

function getCardAdviceIntent(message: string) {
  const wantsAtkBuff = includesAnyThaiOrEnglish(message, [
    "บัฟ at",
    "บัฟ atk",
    "บัฟ attack",
    "บัฟพลังโจมตี",
    "บัฟโจมตี",
    "เพิ่ม atk",
    "เพิ่ม attack",
    "เพิ่มพลังโจมตี",
    "attack +",
    "atk +",
  ]);
  const wantsSupBuff = includesAnyThaiOrEnglish(message, [
    "บัฟ sup",
    "บัฟ support",
    "บัฟพลังรับ",
    "บัฟซัพ",
    "เพิ่ม sup",
    "เพิ่ม support",
    "เพิ่มพลังรับ",
    "support +",
    "sup +",
  ]);
  const wantsBuff =
    wantsAtkBuff ||
    wantsSupBuff ||
    includesAnyThaiOrEnglish(message, ["บัฟ", "buff", "เสริมพลัง", "เพิ่มพลัง", "พลังโหด"]);
  const wantsDebuff = includesAnyThaiOrEnglish(message, [
    "ลดพลัง",
    "ลด atk",
    "ลด attack",
    "ลด sup",
    "ลด support",
    "debuff",
    "เนิร์ฟ",
    "ตัดพลัง",
  ]);
  const wantsControl = includesAnyThaiOrEnglish(message, [
    "เกรียน",
    "ปั่น",
    "โกง",
    "กวน",
    "หยุด",
    "สกัด",
    "แบน",
    "ปิดสกิล",
    "ยกเลิก",
    "ทำลาย",
    "สลับ",
    "ล็อค",
    "control",
    "counter",
  ]);
  const wantsCombo = includesAnyThaiOrEnglish(message, [
    "คอมโบ",
    "combo",
    "จัดเด็ค",
    "เด็ค",
    "เล่นคู่",
    "เข้ากับ",
    "แนะนำ",
    "ใช้ใบไหน",
    "ตัวไหนดี",
  ]);

  return {
    wantsAtkBuff,
    wantsSupBuff,
    wantsBuff,
    wantsDebuff,
    wantsControl,
    wantsCombo,
    requestedElements: getRequestedCardElements(message),
  };
}

function isCardSkillSearchQuestion(message: string) {
  if (isDisableStatUseQuestion(message)) {
    return false;
  }

  if (isPlainCardStatExtremeQuestion(message)) {
    return false;
  }

  if (extractExplicitCardNumber(message)) {
    return false;
  }

  const text = message.toLowerCase();
  const intent = getCardAdviceIntent(message);
  const hasCardIntent =
    includesAnyThaiOrEnglish(message, ["การ์ด", "ใบ", "card", "เด็ค", "คอมโบ"]) ||
    intent.wantsBuff ||
    intent.wantsControl;
  const hasSkillIntent = includesAnyThaiOrEnglish(message, [
    "สกิล",
    "ความสามารถ",
    "เอฟเฟกต์",
    "effect",
    "skill",
    "ability",
    "buff",
    "บัฟ",
    "atk",
    "attack",
    "sup",
    "support",
  ]);
  const hasSearchIntent =
    /ใบไหน|การ์ดไหน|ตัวไหน|อันไหน|อะไรบ้าง|ไหนบ้าง|มีใบ|หา|ค้น|แนะนำ|ตัวไหนดี|ใช้ใบไหน|โหด/.test(text) ||
    includesAnyThaiOrEnglish(message, ["which", "what card", "find", "search", "recommend", "best"]);
  const hasControlIntent = includesAnyThaiOrEnglish(message, [
    "แบน",
    "ห้ามใช้",
    "ใช้ไม่ได้",
    "ไม่สามารถใช้",
    "ยกเลิก",
    "ปิดผนึก",
    "สกัด",
    "หยุด",
    "ลบสกิล",
    "ปิดสกิล",
    "อีกฝ่าย",
    "ฝ่ายตรงข้าม",
    "ศัตรู",
    "คู่แข่ง",
  ]);

  return (
    hasCardIntent &&
    (hasSkillIntent || intent.wantsBuff || intent.wantsControl || intent.wantsCombo) &&
    (hasSearchIntent || hasControlIntent || intent.wantsBuff || intent.wantsControl || intent.wantsCombo)
  );
}

function scoreCardSkillSearchRow(row: CardDbRow, message: string) {
  const query = normalizeSearchText(message);
  const rawMessage = message.toLowerCase();
  const skillText = [row.cardName, row.skill, row.rawText, row.searchText]
    .filter(Boolean)
    .join(" ");
  const haystack = normalizeSearchText(skillText);
  const rawHaystack = skillText.toLowerCase();
  const intent = getCardAdviceIntent(message);
  let score = 0;

  const ignoredTokens = new Set(
    [
      "การ์ด",
      "ใบ",
      "ใบไหน",
      "การ์ดไหน",
      "ไหน",
      "อะไร",
      "อะไรบ้าง",
      "มี",
      "หา",
      "ที่",
      "ของ",
      "อีกฝ่าย",
      "ฝ่ายตรงข้าม",
      "card",
      "which",
      "what",
      "find",
      "search",
    ].map((term) => normalizeSearchText(term))
  );

  const tokens = query
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !ignoredTokens.has(token));

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += token.length >= 4 ? 24 : 12;
    }
  }

  const wantsDisable = includesAnyThaiOrEnglish(rawMessage, [
    "แบน",
    "ห้ามใช้",
    "ใช้ไม่ได้",
    "ไม่สามารถใช้",
    "ปิดผนึก",
    "สกัด",
    "หยุด",
    "ปิดสกิล",
    "ลบสกิล",
  ]);
  const wantsCancel = includesAnyThaiOrEnglish(rawMessage, ["ยกเลิก", "cancel"]);
  const wantsOpponent = includesAnyThaiOrEnglish(rawMessage, [
    "อีกฝ่าย",
    "ฝ่ายตรงข้าม",
    "ศัตรู",
    "คู่แข่ง",
    "opponent",
  ]);
  const wantsSkill = includesAnyThaiOrEnglish(rawMessage, [
    "สกิล",
    "skill",
    "ability",
    "effect",
    "buff",
    "บัฟ",
  ]);
  const hasAtkPlus = /(?:attack|atk)\s*\+\s*\d+/i.test(rawHaystack);
  const hasSupPlus = /(?:support|sup)\s*\+\s*\d+/i.test(rawHaystack);
  const hasAtkMinus = /(?:attack|atk)\s*-\s*\d+/i.test(rawHaystack);
  const hasSupMinus = /(?:support|sup)\s*-\s*\d+/i.test(rawHaystack);
  const hasDisableAttack = includesAnyThaiOrEnglish(rawHaystack, [
    "ไม่สามารถใช้ค่า attack",
    "ไม่สามารถใช้ attack",
    "ไม่สามารถเพิ่มค่า attack",
  ]);
  const hasDisableSupport = includesAnyThaiOrEnglish(rawHaystack, [
    "ไม่สามารถใช้ค่า support",
    "ไม่สามารถใช้ support",
  ]);
  const hasDestroy = includesAnyThaiOrEnglish(rawHaystack, ["ทำลาย", "destroy"]);
  const hasSwap = includesAnyThaiOrEnglish(rawHaystack, ["สลับ", "swap"]);
  const hasCancel = includesAnyThaiOrEnglish(rawHaystack, ["ยกเลิกผล", "ยกเลิก", "cancel"]);
  const hasRandom = includesAnyThaiOrEnglish(rawHaystack, ["สุ่ม", "random"]);
  const hasBuffLock = includesAnyThaiOrEnglish(rawHaystack, ["ไม่สามารถใช้ buff", "ไม่สามารถใช้บัฟ"]);
  const hasTeamWide = includesAnyThaiOrEnglish(rawHaystack, ["ทุกใบ", "บนสนามเราทุกใบ"]);
  const hasOpponent = includesAnyThaiOrEnglish(rawHaystack, [
    "ฝ่ายตรงข้าม",
    "คู่แข่ง",
    "ศัตรู",
    "opponent",
  ]);
  const requestedElements = intent.requestedElements;
  if (requestedElements.length) {
    score += requestedElements.includes(getCardElement(row)) ? 120 : -45;
  }

  if (wantsSkill && includesAnyThaiOrEnglish(rawHaystack, ["สกิล", "skill", "buff", "บัฟ"])) {
    score += 70;
  }
  if (intent.wantsAtkBuff && hasAtkPlus) {
    score += 150;
  }
  if (intent.wantsSupBuff && hasSupPlus) {
    score += 150;
  }
  if (intent.wantsBuff && (hasAtkPlus || hasSupPlus)) {
    score += 95;
  }
  if (intent.wantsDebuff && (hasAtkMinus || hasSupMinus)) {
    score += 125;
  }
  if (intent.wantsControl) {
    if (hasDisableAttack || hasDisableSupport || hasBuffLock) score += 135;
    if (hasDestroy) score += 130;
    if (hasSwap) score += 120;
    if (hasCancel) score += 105;
    if (hasRandom) score += 80;
    if (hasAtkMinus || hasSupMinus) score += 75;
    if (hasOpponent) score += 40;
  }
  if (intent.wantsCombo) {
    if (hasAtkPlus || hasSupPlus) score += 55;
    if (hasDisableAttack || hasDisableSupport || hasBuffLock || hasDestroy || hasSwap || hasCancel) score += 55;
  }
  if (hasTeamWide && intent.wantsBuff) {
    score += 50;
  }
  if (wantsDisable && includesAnyThaiOrEnglish(rawHaystack, ["ไม่สามารถใช้", "ปิดผนึก", "สกัด"])) {
    score += 110;
  }
  if (wantsDisable && includesAnyThaiOrEnglish(rawHaystack, ["ยกเลิก"])) {
    score += 90;
  }
  if (wantsCancel && includesAnyThaiOrEnglish(rawHaystack, ["ยกเลิก"])) {
    score += 120;
  }
  if (wantsOpponent && includesAnyThaiOrEnglish(rawHaystack, ["ฝ่ายตรงข้าม", "ศัตรู", "คู่แข่ง"])) {
    score += 70;
  }
  if (wantsOpponent && includesAnyThaiOrEnglish(rawHaystack, ["เรา 1 ใบ", "บนสนามเรา"])) {
    score -= 35;
  }
  if (wantsSkill && !includesAnyThaiOrEnglish(rawHaystack, ["สกิล", "skill", "buff", "บัฟ"])) {
    score -= 35;
  }

  return Math.max(0, score);
}

function formatCardSkillSearchMatches(matches: CardDbRow[], message: string) {
  const intent = getCardAdviceIntent(message);
  const wantsDisable = includesAnyThaiOrEnglish(message, [
    "แบน",
    "ห้ามใช้",
    "ใช้ไม่ได้",
    "ไม่สามารถใช้",
    "ปิดผนึก",
    "สกัด",
    "ปิดสกิล",
    "ลบสกิล",
  ]);
  const title = intent.wantsAtkBuff
    ? "จากฐานการ์ด 293 ใบ การ์ดสกิลสายบัฟ ATK ที่น่าใช้มีดังนี้"
    : intent.wantsSupBuff
      ? "จากฐานการ์ด 293 ใบ การ์ดสกิลสายบัฟ SUP/ตั้งรับที่น่าใช้มีดังนี้"
      : intent.wantsBuff
        ? "จากฐานการ์ด 293 ใบ การ์ดสกิลสายบัฟพลังที่น่าใช้มีดังนี้"
        : intent.wantsControl || wantsDisable
          ? "จากฐานการ์ด 293 ใบ สกิลสายปั่น/เกรียน/คุมเกมที่น่าใช้มีดังนี้"
          : intent.wantsCombo
            ? "จากฐานการ์ด 293 ใบ การ์ดที่เอาไปต่อคอมโบได้ดีมีดังนี้"
            : "จากฐานการ์ด 293 ใบ ใบที่ตรงกับเงื่อนไขสกิลนี้มีดังนี้";

  const describeWhy = (row: CardDbRow) => {
    const text = `${row.skill} ${row.rawText}`.toLowerCase();
    const notes: string[] = [];

    if (/(?:attack|atk)\s*\+\s*\d+/i.test(text)) notes.push("บัฟ ATK");
    if (/(?:support|sup)\s*\+\s*\d+/i.test(text)) notes.push("บัฟ SUP");
    if (/(?:attack|atk)\s*-\s*\d+/i.test(text)) notes.push("ลด ATK");
    if (/(?:support|sup)\s*-\s*\d+/i.test(text)) notes.push("ลด SUP");
    if (includesAnyThaiOrEnglish(text, ["ไม่สามารถใช้ค่า attack", "ไม่สามารถใช้ attack"])) notes.push("ปิดค่า ATK");
    if (includesAnyThaiOrEnglish(text, ["ไม่สามารถใช้ค่า support", "ไม่สามารถใช้ support"])) notes.push("ปิดค่า SUP");
    if (includesAnyThaiOrEnglish(text, ["ไม่สามารถใช้ buff", "ไม่สามารถใช้บัฟ"])) notes.push("กันบัฟ");
    if (includesAnyThaiOrEnglish(text, ["ทำลาย"])) notes.push("ทำลายมอนสเตอร์");
    if (includesAnyThaiOrEnglish(text, ["สลับ"])) notes.push("สลับ/ปั่นตำแหน่ง");
    if (includesAnyThaiOrEnglish(text, ["ยกเลิก"])) notes.push("ล้างผลลบ/ยกเลิกผล");
    if (includesAnyThaiOrEnglish(text, ["ทุกใบ", "บนสนามเราทุกใบ"])) notes.push("มีผลหลายใบ");

    return notes.length ? notes.join(", ") : "ใช้เป็นไพ่เทคนิคตามจังหวะเกม";
  };

  return enforceBlazeStyle(
    [
      title,
      ...matches.map((row, index) => {
        const skill = (row.skill || "-").replace(/\s+/g, " ").trim();
        const prefix = `${index + 1}.`;
        return `${prefix} No.${row.cardNoNormalized} ${row.cardName} | ${formatCardElement(getCardElement(row))} | ${describeWhy(row)}\nสกิล: ${skill}`;
      }),
      intent.wantsCombo || intent.wantsBuff || intent.wantsControl
        ? "หลักเล่นให้โหด: จับคู่สกิลบัฟกับมอนสเตอร์ธาตุเดียวกันหรือมอนสเตอร์ที่มีค่าเด่นอยู่แล้ว ส่วนสกิลปั่นให้เก็บไว้ใช้ตอนอีกฝ่ายกำลังจะปิดเกมหรือกำลังบัฟหนัก"
        : "",
    ].join("\n")
  );
}

async function buildDirectCardSkillSearchReply(message: string) {
  if (!isCardSkillSearchQuestion(message)) {
    return "";
  }

  const rows = await loadCardDbRows();
  if (!rows.length) {
    return "";
  }

  const scored = rows
    .map((row) => ({
      row,
      score: scoreCardSkillSearchRow(row, message),
    }))
    .filter((item) => item.score >= 90 && item.row.skill)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.row.cardNoNormalized.localeCompare(b.row.cardNoNormalized)
    );
  const topScore = scored[0]?.score || 0;
  const matches = scored
    .filter((item) => item.score >= Math.max(90, topScore - 80))
    .slice(0, 8)
    .map((item) => item.row);

  if (!matches.length) {
    return enforceBlazeStyle(
      "ข้าค้นจากฐานการ์ด 293 ใบแล้ว ยังไม่พบการ์ดที่สกิลตรงเงื่อนไขนี้แบบชัดเจน"
    );
  }

  return formatCardSkillSearchMatches(matches, message);
}

function isAtkSupSwapQuestion(message: string) {
  const raw = message.toLowerCase();
  const hasSwapIntent = includesAnyThaiOrEnglish(message, [
    "สลับ",
    "swap",
    "reverse",
    "กลับค่า",
    "เปลี่ยนสลับ",
  ]);
  const hasAtk = /(?:\batk\b|\battack\b|พลังโจมตี|ค่าโจมตี)/i.test(raw);
  const hasSup = /(?:\bsup\b|\bsupport\b|พลังรับ|ค่ารับ|ซัพ)/i.test(raw);
  const hasCardIntent = includesAnyThaiOrEnglish(message, [
    "การ์ด",
    "เลขไหน",
    "ใบไหน",
    "หมายเลข",
    "card",
    "no",
  ]);

  return hasSwapIntent && hasAtk && hasSup && hasCardIntent;
}

function hasDirectAtkSupSwapSkill(row: CardDbRow) {
  const text = `${row.skill} ${row.rawText}`.toLowerCase();

  return (
    /สลับ\s*(?:ค่า)?\s*(?:attack|atk)\s*(?:และ|กับ|\/|,)?\s*(?:support|sup)/i.test(text) ||
    /(?:attack|atk)\s*(?:และ|กับ|\/|,)\s*(?:support|sup).*สลับ/i.test(text) ||
    /swap\s*(?:attack|atk)\s*(?:and|with|\/|,)?\s*(?:support|sup)/i.test(text)
  );
}

function getAtkSupNearbySkillNote(row: CardDbRow) {
  const text = `${row.skill} ${row.rawText}`.toLowerCase();

  if (
    includesAnyThaiOrEnglish(text, ["เปลี่ยนค่า attack และ support", "attack และ support เป็น", "attack หรือ support 5000"])
  ) {
    return "ใกล้เคียง: เปลี่ยน/ตั้งค่า ATK และ SUP ไม่ใช่สลับค่าโดยตรง";
  }

  if (includesAnyThaiOrEnglish(text, ["ไม่สามารถเปลี่ยนแปลง attack และ support"])) {
    return "ใกล้เคียง: ล็อคไม่ให้เปลี่ยน ATK/SUP ไม่ใช่สลับค่า";
  }

  if (includesAnyThaiOrEnglish(text, ["สลับตำแหน่ง", "swap position"])) {
    return "ใกล้เคียง: สลับตำแหน่งมอนสเตอร์ ไม่ใช่สลับ ATK/SUP";
  }

  return "";
}

function formatPreciseSkillLine(row: CardDbRow, note = "") {
  const skill = row.skill ? row.skill.replace(/\s+/g, " ").trim() : "-";
  const suffix = note ? `\nเหตุผล: ${note}` : "";

  return `No.${row.cardNoNormalized} ${row.cardName} | ${formatCardElement(getCardElement(row))}\nสกิล: ${skill}${suffix}`;
}

async function buildDirectAtkSupSwapReply(message: string) {
  if (!isAtkSupSwapQuestion(message)) {
    return "";
  }

  const rows = await loadCardDbRows();
  if (!rows.length) {
    return "";
  }

  const exactMatches = rows
    .filter((row) => isSkillCard(row) && hasDirectAtkSupSwapSkill(row))
    .sort((a, b) => a.cardNoNormalized.localeCompare(b.cardNoNormalized));
  const exactNos = new Set(exactMatches.map((row) => row.cardNoNormalized));
  const nearbyMatches = rows
    .map((row) => ({
      row,
      note: exactNos.has(row.cardNoNormalized) ? "" : getAtkSupNearbySkillNote(row),
    }))
    .filter((item) => item.note)
    .sort((a, b) => a.row.cardNoNormalized.localeCompare(b.row.cardNoNormalized))
    .slice(0, 3);

  if (!exactMatches.length) {
    return enforceBlazeStyle(
      [
        "ข้าค้นจากฐานการ์ด 293 ใบแล้ว ยังไม่พบใบที่เขียนว่าสลับ ATK กับ SUP โดยตรง",
        nearbyMatches.length
          ? "แต่มีสกิลใกล้เคียงที่เกี่ยวกับค่า ATK/SUP ดังนี้"
          : "",
        ...nearbyMatches.map((item, index) =>
          `${index + 1}. ${formatPreciseSkillLine(item.row, item.note)}`
        ),
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  return enforceBlazeStyle(
    [
      "ใบที่สลับ ATK กับ SUP โดยตรงคือ",
      ...exactMatches.map((row, index) =>
        `${index + 1}. ${formatPreciseSkillLine(row)}`
      ),
      nearbyMatches.length
        ? "สกิลที่น่าสนใจใกล้เคียง แต่ไม่ใช่สลับค่าโดยตรง:"
        : "",
      ...nearbyMatches.map((item, index) =>
        `${index + 1}. ${formatPreciseSkillLine(item.row, item.note)}`
      ),
    ]
      .filter(Boolean)
      .join("\n")
  );
}

const CARD_ELEMENT_ORDER: CardElement[] = ["fire", "water", "gold", "earth", "wood"];

const CARD_ELEMENT_PLAYBOOK: Record<
  Exclude<CardElement, "unknown">,
  {
    label: string;
    tone: string;
    plan: string;
  }
> = {
  fire: {
    label: "สายไฟ",
    tone: "บุกแรง ปิดเกมไว",
    plan: "ใช้มอนสเตอร์ ATK สูงเป็นตัวปิดเกม แล้วเสริมด้วยสกิลบัฟ ATK หรือสกิลทำลาย/ลดจังหวะอีกฝ่าย",
  },
  water: {
    label: "สายน้ำ",
    tone: "คุมจังหวะ ยื้อเกม แล้วสวนกลับ",
    plan: "ใช้มอนสเตอร์ที่บาลานซ์ดีหรือ SUP สูง คุมเกมด้วยสกิลลดพลัง/กันบัฟ แล้วรอจังหวะสวน",
  },
  gold: {
    label: "สายทอง",
    tone: "มั่นคง คุมกระดาน เล่นเป็นระบบ",
    plan: "ใช้ตัวแกนที่ค่า ATK/SUP แน่น จับคู่กับสกิลบัฟและสกิลยกเลิก/แก้ทางเพื่อรักษาความได้เปรียบ",
  },
  earth: {
    label: "สายดิน",
    tone: "ตั้งรับแน่น หน่วงเกม แล้วบีบพื้นที่",
    plan: "ใช้มอนสเตอร์ SUP หรือค่าสมดุลสูงเป็นกำแพง แล้วเติมสกิลบัฟ/สกิลปิดค่าพลังเพื่อทำให้อีกฝ่ายผ่านยาก",
  },
  wood: {
    label: "สายไม้",
    tone: "เล่นยืดหยุ่น ปั่นเกม และค่อยๆ ได้เปรียบ",
    plan: "ใช้มอนสเตอร์ที่ยืนสนามได้นาน จับคู่สกิลลดพลัง/ปั่นจังหวะ และบัฟเพื่อค่อยๆ ดันเกม",
  },
};

type GameplaySkillTheme =
  | "atkBuff"
  | "supBuff"
  | "debuff"
  | "control"
  | "destroy"
  | "cancel"
  | "lock"
  | "swap"
  | "teamBuff";

function hasGameplayAdvisorIntent(message: string) {
  if (extractExplicitCardNumber(message)) {
    return false;
  }

  const hasGameplayTerm = includesAnyThaiOrEnglish(message, [
    "คอมโบ",
    "combo",
    "จัดเด็ค",
    "เด็ค",
    "บิ้ว",
    "build",
    "เล่นยังไง",
    "เล่นแบบไหน",
    "เล่นธาตุ",
    "ธาตุทำไง",
    "สายไหนดี",
    "สายไหน",
    "ใช้กับอะไร",
    "เข้ากับอะไร",
    "จับคู่",
    "มันส์",
    "แนะนำเล่น",
    "แนะนำเด็ค",
    "ปิดเกม",
    "เปิดเกม",
    "แก้ทาง",
    "คุมเกม",
    "กติกา",
    "ดวล",
    "battle",
    "strategy",
  ]);
  const hasCardGameContext = includesAnyThaiOrEnglish(message, [
    "การ์ด",
    "มอนสเตอร์",
    "สกิล",
    "ธาตุ",
    "atk",
    "sup",
    "card",
    "monster",
    "skill",
  ]);

  return hasGameplayTerm && hasCardGameContext;
}

function getGameplaySkillThemes(row: CardDbRow): GameplaySkillTheme[] {
  const text = `${row.cardName} ${row.skill} ${row.rawText}`.toLowerCase();
  const themes: GameplaySkillTheme[] = [];
  const add = (theme: GameplaySkillTheme) => {
    if (!themes.includes(theme)) {
      themes.push(theme);
    }
  };

  if (/(?:attack|atk)\s*\+\s*\d+/i.test(text)) add("atkBuff");
  if (/(?:support|sup)\s*\+\s*\d+/i.test(text)) add("supBuff");
  if (/(?:attack|atk)\s*-\s*\d+/i.test(text) || /(?:support|sup)\s*-\s*\d+/i.test(text)) add("debuff");
  if (includesAnyThaiOrEnglish(text, ["ทุกใบ", "บนสนามเราทุกใบ"])) add("teamBuff");
  if (includesAnyThaiOrEnglish(text, ["ทำลาย", "destroy"])) add("destroy");
  if (includesAnyThaiOrEnglish(text, ["ยกเลิก", "cancel"])) add("cancel");
  if (
    includesAnyThaiOrEnglish(text, [
      "ไม่สามารถใช้",
      "ห้ามใช้",
      "ปิดผนึก",
      "สกัด",
      "หยุด",
      "ไม่สามารถเพิ่มค่า attack",
      "ไม่สามารถใช้ค่า attack",
      "ไม่สามารถใช้ค่า support",
      "ไม่สามารถใช้ buff",
      "ไม่สามารถใช้บัฟ",
    ])
  ) {
    add("lock");
  }
  if (includesAnyThaiOrEnglish(text, ["สลับ", "swap", "สุ่ม", "random"])) add("swap");
  if (themes.some((theme) => ["debuff", "destroy", "cancel", "lock", "swap"].includes(theme))) {
    add("control");
  }

  return themes;
}

function formatGameplayThemeLabels(row: CardDbRow) {
  const labels = getGameplaySkillThemes(row).map((theme) => {
    if (theme === "atkBuff") return "บัฟ ATK";
    if (theme === "supBuff") return "บัฟ SUP";
    if (theme === "teamBuff") return "บัฟหลายใบ";
    if (theme === "debuff") return "ลดพลัง";
    if (theme === "destroy") return "ทำลาย";
    if (theme === "cancel") return "ยกเลิก/แก้ทาง";
    if (theme === "lock") return "ล็อคจังหวะ";
    if (theme === "swap") return "ปั่นตำแหน่ง";
    return "คุมเกม";
  });

  return labels.filter((label, index) => labels.indexOf(label) === index).join(", ") || "สกิลเทคนิค";
}

function getMonsterGameplayScore(row: CardDbRow, mode: "attack" | "defense" | "balanced") {
  const atk = parseCardStatValue(row.atk) || 0;
  const sup = parseCardStatValue(row.sup) || 0;

  if (mode === "attack") {
    return atk * 1.2 + sup * 0.25;
  }

  if (mode === "defense") {
    return sup * 1.2 + atk * 0.25;
  }

  return atk + sup;
}

function pickGameplayMonsters(
  rows: CardDbRow[],
  element: CardElement,
  mode: "attack" | "defense" | "balanced",
  limit: number
) {
  return rows
    .filter((row) => isMonsterCard(row))
    .filter((row) => element === "unknown" || getCardElement(row) === element)
    .map((row) => ({
      row,
      score: getMonsterGameplayScore(row, mode),
    }))
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.row.cardNoNormalized.localeCompare(b.row.cardNoNormalized)
    )
    .slice(0, limit)
    .map((item) => item.row);
}

function scoreGameplaySkill(
  row: CardDbRow,
  element: CardElement,
  preferredThemes: GameplaySkillTheme[]
) {
  if (!isSkillCard(row)) {
    return 0;
  }

  const themes = getGameplaySkillThemes(row);
  let score = 0;

  if (element !== "unknown" && getCardElement(row) === element) {
    score += 80;
  }

  for (const preferred of preferredThemes) {
    if (themes.includes(preferred)) {
      score += preferred === "control" ? 45 : 70;
    }
  }

  if (themes.includes("teamBuff")) score += 20;
  if (themes.includes("control")) score += 16;
  if (row.cardNoNormalized && Number(row.cardNoNormalized) <= 20) score += 10;

  return score;
}

function pickGameplaySkills(
  rows: CardDbRow[],
  element: CardElement,
  preferredThemes: GameplaySkillTheme[],
  limit: number
) {
  return rows
    .map((row) => ({
      row,
      score: scoreGameplaySkill(row, element, preferredThemes),
    }))
    .filter((item) => item.score >= 55)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.row.cardNoNormalized.localeCompare(b.row.cardNoNormalized)
    )
    .slice(0, limit)
    .map((item) => item.row);
}

function shortenGameplayText(value: string, maxLength = 120) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) {
    return clean;
  }

  return `${clean.slice(0, maxLength - 1).trim()}…`;
}

function formatGameplayMonster(row: CardDbRow) {
  const atk = parseCardStatValue(row.atk);
  const sup = parseCardStatValue(row.sup);
  const stats = [
    atk !== null ? `ATK ${atk.toLocaleString("th-TH")}` : "",
    sup !== null ? `SUP ${sup.toLocaleString("th-TH")}` : "",
  ]
    .filter(Boolean)
    .join(" / ");

  return `No.${row.cardNoNormalized} ${row.cardName} (${formatCardElement(getCardElement(row))}${stats ? `, ${stats}` : ""})`;
}

function formatGameplaySkill(row: CardDbRow) {
  const skill = row.skill ? `: ${shortenGameplayText(row.skill, 90)}` : "";
  return `No.${row.cardNoNormalized} ${row.cardName} (${formatCardElement(getCardElement(row))}, ${formatGameplayThemeLabels(row)})${skill}`;
}

function buildElementGameplayBlock(rows: CardDbRow[], element: Exclude<CardElement, "unknown">) {
  const playbook = CARD_ELEMENT_PLAYBOOK[element];
  const mode = element === "fire" ? "attack" : element === "earth" || element === "water" ? "defense" : "balanced";
  const monsters = pickGameplayMonsters(rows, element, mode, 3);
  const buffSkills = pickGameplaySkills(rows, element, ["atkBuff", "supBuff", "teamBuff"], 3);
  const controlSkills = pickGameplaySkills(rows, element, ["control", "debuff", "destroy", "lock", "cancel", "swap"], 3);
  const mainMonster = monsters[0];
  const mainBuff = buffSkills[0];
  const mainControl = controlSkills[0];
  const comboParts = [mainMonster, mainBuff, mainControl].filter(Boolean);

  return [
    `${playbook.label} - ${playbook.tone}`,
    `แนวเล่น: ${playbook.plan}`,
    monsters.length ? `ตัวแกน: ${monsters.map(formatGameplayMonster).join(" | ")}` : "",
    buffSkills.length ? `ไพ่บัฟ/เร่งพลัง: ${buffSkills.map(formatGameplaySkill).join(" | ")}` : "",
    controlSkills.length ? `ไพ่ปั่น/แก้ทาง: ${controlSkills.map(formatGameplaySkill).join(" | ")}` : "",
    comboParts.length
      ? `คอมโบตัวอย่าง: ${comboParts
          .map((row) => (isMonsterCard(row) ? formatGameplayMonster(row) : formatGameplaySkill(row)))
          .join(" + ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function getRequestedGameplayElements(message: string): Exclude<CardElement, "unknown">[] {
  const requested = getRequestedCardElements(message).filter(
    (element): element is Exclude<CardElement, "unknown"> => element !== "unknown"
  );

  if (requested.length) {
    return requested;
  }

  return CARD_ELEMENT_ORDER.filter(
    (element): element is Exclude<CardElement, "unknown"> => element !== "unknown"
  );
}

function wantsAllElementGameplay(message: string) {
  return (
    getRequestedCardElements(message).length === 0 &&
    includesAnyThaiOrEnglish(message, [
      "ธาตุ",
      "ทุกธาตุ",
      "สายไหนดี",
      "คอมโบการ์ดไหน",
      "คอมโบการ์ดธาตุ",
      "คอมโบ",
      "จัดเด็ค",
      "เด็ค",
    ])
  );
}

async function buildDirectCardGameplayReply(message: string) {
  if (!hasGameplayAdvisorIntent(message)) {
    return "";
  }

  const rows = await loadCardDbRows();
  if (!rows.length) {
    return "";
  }

  const requestedElements = getRequestedGameplayElements(message);
  const elementsToShow = wantsAllElementGameplay(message)
    ? requestedElements
    : requestedElements.slice(0, 2);
  const intent = getCardAdviceIntent(message);
  const wantsCounter = intent.wantsControl || includesAnyThaiOrEnglish(message, ["แก้ทาง", "คุมเกม", "ปั่น", "เกรียน"]);
  const wantsFastKill = includesAnyThaiOrEnglish(message, ["ปิดเกม", "บุก", "แรง", "โหด", "atk", "attack"]);
  const intro = wantsAllElementGameplay(message)
    ? "หลักคอมโบ NEXORA ให้คิดเป็น 3 ชั้น: 1) เลือกธาตุเป็นแกน 2) เลือกมอนสเตอร์ที่ค่าสเตตัสเด่น 3) วางสกิลบัฟหรือสกิลปั่นเพื่อชนะจังหวะสำคัญ"
    : wantsCounter
      ? "ถ้าจะเล่นสายปั่น/แก้ทาง ให้คิดแบบนี้: อย่าทุ่มบัฟก่อน เหลือสกิลล็อค/ยกเลิก/ลดพลังไว้ตอบจังหวะที่อีกฝ่ายกำลังปิดเกม"
      : wantsFastKill
        ? "ถ้าจะเล่นสายบุก ให้ใช้มอนสเตอร์ ATK สูงเป็นตัวปิดเกม แล้วซ้อนบัฟธาตุเดียวกันหรือบัฟหลายใบเพื่อบีบให้อีกฝ่ายต้องแก้ทันที"
        : "คอมโบที่เล่นสนุกให้มองเป็นชุด: ตัวแกนมอนสเตอร์ + ไพ่บัฟ + ไพ่ปั่น/แก้ทาง ไม่ใช่ดูสกิลใบเดียวแยกๆ";

  const blocks = elementsToShow.map((element) => buildElementGameplayBlock(rows, element));
  const generalTips = [
    "สูตรจำง่าย:",
    "- มอนสเตอร์ = ตัวทำคะแนนหลัก ดู ATK/SUP และธาตุ",
    "- สกิลบัฟ = ใช้เร่งจังหวะตอนเรามีตัวแกนพร้อมแล้ว",
    "- สกิลปั่น/แก้ทาง = เก็บไว้ตัดคอมโบอีกฝ่าย ไม่ควรรีบใช้ตั้งแต่ต้นถ้าไม่จำเป็น",
    "- ธาตุเดียวกันมักอ่านเกมง่ายกว่า เพราะสกิลคริสตัล/บัฟธาตุจะเข้ากับตัวแกนได้ตรงกว่า",
  ].join("\n");

  const answer = [
    intro,
    ...blocks,
    generalTips,
  ]
    .filter(Boolean)
    .join("\n\n");

  return enforceBlazeStyle(answer);
}

function parseCardStatValue(value: string) {
  const match = String(value || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function hasCardSkillText(row: CardDbRow) {
  return Boolean(row.skill.trim());
}

function hasMonsterStatPair(row: CardDbRow) {
  return (
    parseCardStatValue(row.atk) !== null &&
    parseCardStatValue(row.sup) !== null
  );
}

function getCardKind(row: CardDbRow): CardKind {
  if (hasCardSkillText(row)) {
    return "skill";
  }

  if (hasMonsterStatPair(row)) {
    return "monster";
  }

  return "unknown";
}

function isMonsterCard(row: CardDbRow) {
  return getCardKind(row) === "monster";
}

function isSkillCard(row: CardDbRow) {
  return getCardKind(row) === "skill";
}

function formatCardKind(kind: CardKind) {
  if (kind === "monster") {
    return "การ์ดมอนสเตอร์";
  }

  if (kind === "skill") {
    return "การ์ดสกิล";
  }

  return "ยังไม่ระบุประเภท";
}

function inferElementFromText(value: string): CardElement {
  const raw = value.toLowerCase();

  if (
    includesAnyThaiOrEnglish(raw, [
      "water",
      "aqua",
      "hydro",
      "ocean",
      "sea",
      "river",
      "wave",
      "tide",
      "mist",
      "rain",
      "droplet",
      "frost",
      "ice",
      "วารี",
      "น้ำ",
      "ทะเล",
      "คลื่น",
      "หยดน้ำ",
      "น้ำแข็ง",
      "สีฟ้า",
    ])
  ) {
    return "water";
  }

  if (
    includesAnyThaiOrEnglish(raw, [
      "fire",
      "flame",
      "blaze",
      "inferno",
      "lava",
      "ember",
      "pyro",
      "ash",
      "solar",
      "hellfire",
      "ไฟ",
      "เพลิง",
      "อัคคี",
      "ลาวา",
      "เถ้าถ่าน",
      "สีส้ม",
      "สีแดง",
    ])
  ) {
    return "fire";
  }

  if (
    includesAnyThaiOrEnglish(raw, [
      "nature",
      "green",
      "plant",
      "forest",
      "leaf",
      "vine",
      "root",
      "tree",
      "seed",
      "thorn",
      "bloom",
      "spring",
      "wood",
      "verdant",
      "ไม้",
      "พฤกษา",
      "ใบไม้",
      "ป่า",
      "ราก",
      "เถาวัลย์",
      "เมล็ด",
      "หนาม",
      "สีเขียว",
    ])
  ) {
    return "wood";
  }

  if (
    includesAnyThaiOrEnglish(raw, [
      "gold",
      "golden",
      "metal",
      "metallic",
      "iron",
      "silver",
      "ore",
      "mech",
      "machine",
      "gear",
      "magnetic",
      "rust",
      "armor",
      "aurex",
      "auron",
      "ทอง",
      "โลหะ",
      "เหล็ก",
      "เงิน",
      "แร่",
      "กลไก",
      "จักรกล",
      "แม่เหล็ก",
      "สีเหลือง",
    ])
  ) {
    return "gold";
  }

  if (
    includesAnyThaiOrEnglish(raw, [
      "earth",
      "rock",
      "stone",
      "sand",
      "soil",
      "mud",
      "cliff",
      "cave",
      "dune",
      "boulder",
      "terra",
      "ปฐพี",
      "ดิน",
      "หิน",
      "ทราย",
      "ภูผา",
      "ธรณี",
      "โคลน",
      "สีน้ำตาล",
      "brown",
      "orange triangle",
    ])
  ) {
    return "earth";
  }

  return "unknown";
}

function inferElementFromCardNo(cardNo: string): CardElement {
  const no = Number(cardNo);
  if (!Number.isFinite(no)) {
    return "unknown";
  }

  const specialElements: Record<number, CardElement> = {
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

  if (specialElements[no]) {
    return specialElements[no];
  }

  if ((no >= 21 && no <= 60) || (no >= 216 && no <= 230)) {
    return "earth";
  }
  if ((no >= 61 && no <= 98) || (no >= 231 && no <= 248)) {
    return "gold";
  }
  if ((no >= 99 && no <= 137) || (no >= 249 && no <= 263)) {
    return "water";
  }
  if ((no >= 138 && no <= 176) || (no >= 264 && no <= 278)) {
    return "fire";
  }
  if ((no >= 177 && no <= 215) || (no >= 279 && no <= 293)) {
    return "wood";
  }

  return "unknown";
}

function getCardElement(row: CardDbRow): CardElement {
  const candidates = [
    inferElementFromText(row.element),
    inferElementFromCardNo(row.cardNoNormalized),
    inferElementFromText(`${row.cardName} ${row.skill} ${row.rawText}`),
  ];

  return candidates.find((element) => element !== "unknown") || "unknown";
}

function formatCardElement(element: CardElement) {
  if (element === "earth") return "ธาตุดิน";
  if (element === "water") return "ธาตุน้ำ";
  if (element === "fire") return "ธาตุไฟ";
  if (element === "wood") return "ธาตุไม้";
  if (element === "gold") return "ธาตุทอง";
  return "ยังไม่ระบุธาตุ";
}

function formatCardElementLine(row: CardDbRow) {
  return `ธาตุ: ${formatCardElement(getCardElement(row))}`;
}

function getRequestedCardStat(message: string): "atk" | "sup" | "" {
  if (
    includesAnyThaiOrEnglish(message, [
      "atk",
      "attack",
      "พลังโจมตี",
      "โจมตี",
      "ค่าโจมตี",
    ])
  ) {
    return "atk";
  }

  if (
    includesAnyThaiOrEnglish(message, [
      "sup",
      "support",
      "พลังรับ",
      "ซัพ",
      "ซัพพอร์ต",
      "สนับสนุน",
      "ค่ารับ",
    ])
  ) {
    return "sup";
  }

  return "";
}

function getRequestedStatDirection(message: string): "highest" | "lowest" | "" {
  if (
    includesAnyThaiOrEnglish(message, [
      "สูงสุด",
      "มากสุด",
      "เยอะสุด",
      "สูงที่สุด",
      "มากที่สุด",
      "highest",
      "max",
      "top",
    ])
  ) {
    return "highest";
  }

  if (
    includesAnyThaiOrEnglish(message, [
      "ต่ำสุด",
      "น้อยสุด",
      "ต่ำที่สุด",
      "น้อยที่สุด",
      "lowest",
      "min",
    ])
  ) {
    return "lowest";
  }

  return "";
}

function isPlainCardStatExtremeQuestion(message: string) {
  const raw = message.toLowerCase();
  const normalized = normalizeSearchText(message);
  const hasStat =
    /(?:^|\s)(?:atk|attack|sup|support)(?:\s|$)/i.test(raw) ||
    normalized.includes("พลังโจมตี") ||
    normalized.includes("ค่าโจมตี") ||
    normalized.includes("พลังรับ") ||
    normalized.includes("ค่ารับ") ||
    normalized.includes("ซัพ") ||
    normalized.includes("ซัพพอร์ต");
  const hasExtreme =
    raw.includes("สูงสุด") ||
    raw.includes("มากสุด") ||
    raw.includes("เยอะสุด") ||
    raw.includes("ต่ำสุด") ||
    raw.includes("น้อยสุด") ||
    /\b(?:highest|max|top|lowest|min)\b/i.test(raw);
  const hasSkillOrBuff =
    raw.includes("สกิล") ||
    raw.includes("ความสามารถ") ||
    raw.includes("บัฟ") ||
    raw.includes("เพิ่ม") ||
    raw.includes("+") ||
    /\b(?:skill|effect|ability|buff)\b/i.test(raw);

  return hasStat && hasExtreme && !hasSkillOrBuff;
}

function isCardStatExtremeQuestion(message: string) {
  if (isPlainCardStatExtremeQuestion(message)) {
    return true;
  }

  const hasCardIntent = includesAnyThaiOrEnglish(message, [
    "การ์ด",
    "ใบ",
    "ตัว",
    "ตัวไหน",
    "ตัวใด",
    "ตัวอะไร",
    "มอนสเตอร์",
    "monster",
    "card",
  ]);
  const hasSkillOrBuffIntent = includesAnyThaiOrEnglish(message, [
    "สกิล",
    "ความสามารถ",
    "บัฟ",
    "เพิ่ม",
    "skill",
    "effect",
    "ability",
    "buff",
    "+",
  ]);

  return Boolean(
    !hasSkillOrBuffIntent &&
      hasCardIntent &&
      getRequestedCardStat(message) &&
      getRequestedStatDirection(message)
  );
}

function getDisableStatUseIntent(message: string) {
  const raw = message.toLowerCase();
  const normalized = normalizeSearchText(message);
  const hasDisableIntent =
    raw.includes("ใช้งาน") ||
    raw.includes("ใช้ค่า") ||
    raw.includes("ใช้คำ") ||
    raw.includes("ใช้ไม่ได้") ||
    raw.includes("ไม่ได้") ||
    raw.includes("ห้ามใช้") ||
    raw.includes("ปิดค่า") ||
    raw.includes("ไม่สามารถใช้") ||
    normalized.includes("ใช้งาน") ||
    normalized.includes("ใช้ค่า") ||
    normalized.includes("ใช้คำ") ||
    normalized.includes("ใช้ไม่ได้") ||
    normalized.includes("ไม่ได้") ||
    normalized.includes("ห้ามใช้") ||
    normalized.includes("ปิดค่า") ||
    normalized.includes("ไม่สามารถใช้");
  const wantsAtk =
    /(?:^|\s)(?:atk|attack)(?:\s|$)/i.test(raw) ||
    normalized.includes("พลังโจมตี") ||
    normalized.includes("ค่าโจมตี");
  const wantsSup =
    /(?:^|\s)(?:sup|support)(?:\s|$)/i.test(raw) ||
    normalized.includes("พลังรับ") ||
    normalized.includes("ค่ารับ") ||
    normalized.includes("ซัพ") ||
    normalized.includes("ซัพพอร์ต");

  return {
    wantsDisableUse: hasDisableIntent && (wantsAtk || wantsSup),
    wantsAtk,
    wantsSup,
  };
}

function isDisableStatUseQuestion(message: string) {
  return getDisableStatUseIntent(message).wantsDisableUse;
}

function rowBlocksAttackUse(row: CardDbRow) {
  const text = `${row.skill} ${row.rawText}`.toLowerCase();
  return (
    /ไม่สามารถใช้(?:ค่า|คำ)?\s*(?:attack|atk)/i.test(text) ||
    includesAnyThaiOrEnglish(text, [
      "ไม่สามารถใช้ค่า attack",
      "ไม่สามารถใช้คำ attack",
      "ไม่สามารถใช้ attack",
      "ไม่สามารถใช้ค่า atk",
      "ไม่สามารถใช้ atk",
    ])
  );
}

function rowBlocksSupportUse(row: CardDbRow) {
  const text = `${row.skill} ${row.rawText}`.toLowerCase();
  return (
    /ไม่สามารถใช้(?:ค่า|คำ)?\s*(?:support|sup)/i.test(text) ||
    includesAnyThaiOrEnglish(text, [
      "ไม่สามารถใช้ค่า support",
      "ไม่สามารถใช้คำ support",
      "ไม่สามารถใช้ support",
      "ไม่สามารถใช้ค่า sup",
      "ไม่สามารถใช้ sup",
    ])
  );
}

function formatStatBlockCard(row: CardDbRow) {
  const skill = (row.skill || "-").replace(/\s+/g, " ").trim();
  return `No.${row.cardNoNormalized} ${row.cardName} | ${formatCardElement(getCardElement(row))}\nสกิล: ${skill}`;
}

async function buildDirectDisableStatUseReply(message: string) {
  const intent = getDisableStatUseIntent(message);
  if (!intent.wantsDisableUse) {
    return "";
  }

  const rows = (await loadCardDbRows()).filter(isSkillCard);
  const attackLocks = rows.filter(rowBlocksAttackUse);
  const supportLocks = rows.filter(rowBlocksSupportUse);
  const bothLocks = rows.filter(
    (row) => rowBlocksAttackUse(row) && rowBlocksSupportUse(row)
  );
  const lines: string[] = [];

  if (intent.wantsAtk && intent.wantsSup) {
    if (bothLocks.length) {
      lines.push("ใบที่ทำให้อีกฝ่ายใช้งาน ATK และ SUP ไม่ได้พร้อมกันคือ");
      lines.push(...bothLocks.map(formatStatBlockCard));
    } else {
      lines.push(
        "ข้าตรวจจากฐานการ์ด 293 ใบแล้ว ยังไม่พบใบเดียวที่ปิดการใช้งานทั้ง ATK และ SUP พร้อมกันโดยตรง"
      );

      if (attackLocks.length) {
        lines.push("ใบที่ปิดการใช้งาน ATK:");
        lines.push(...attackLocks.map(formatStatBlockCard));
      }

      if (supportLocks.length) {
        lines.push("ใบที่ปิดการใช้งาน SUP:");
        lines.push(...supportLocks.map(formatStatBlockCard));
      }

      lines.push(
        "หมายเหตุ: No.244 Time Reverse ทำให้เปลี่ยนแปลง ATTACK และ SUPPORT ไม่ได้ แต่ไม่ใช่การปิดใช้งานค่า ATK/SUP โดยตรง"
      );
    }
  } else if (intent.wantsAtk) {
    lines.push("ใบที่ทำให้อีกฝ่ายใช้งาน ATK ไม่ได้คือ");
    lines.push(...attackLocks.map(formatStatBlockCard));
  } else if (intent.wantsSup) {
    lines.push("ใบที่ทำให้อีกฝ่ายใช้งาน SUP ไม่ได้คือ");
    lines.push(...supportLocks.map(formatStatBlockCard));
  }

  return enforceBlazeStyle(lines.filter(Boolean).join("\n"));
}

function formatCardStatExtremeRows(
  rows: Array<{ row: CardDbRow; value: number }>,
  stat: "atk" | "sup",
  direction: "highest" | "lowest"
) {
  const statLabel = stat === "atk" ? "ATK" : "SUP";
  const directionLabel = direction === "highest" ? "สูงสุด" : "ต่ำสุด";
  const topValue = rows[0]?.value;
  const ties = rows.filter((item) => item.value === topValue);
  const tieLine =
    ties.length > 1
      ? `พบ ${ties.length} ใบที่ค่า ${statLabel} เท่ากัน`
      : "พบ 1 ใบ";

  return enforceBlazeStyle(
    [
      `ข้าตรวจจากฐานการ์ด 293 ใบแล้ว การ์ดที่ ${statLabel} ${directionLabel} คือ`,
      tieLine,
      ...ties.map(({ row, value }) => {
        const otherStat = stat === "atk" ? "SUP" : "ATK";
        const otherValue = parseCardStatValue(stat === "atk" ? row.sup : row.atk);

        return `No.${row.cardNoNormalized} ${row.cardName} | ${formatCardElement(getCardElement(row))} — ${statLabel} ${value.toLocaleString("th-TH")}${
          otherValue !== null
            ? ` / ${otherStat} ${otherValue.toLocaleString("th-TH")}`
            : ""
        }`;
      }),
    ].join("\n")
  );
}

async function buildDirectCardStatExtremeReply(message: string) {
  if (!isCardStatExtremeQuestion(message)) {
    return "";
  }

  const stat = getRequestedCardStat(message);
  const direction = getRequestedStatDirection(message);
  if (!stat || !direction) {
    return "";
  }

  const rows = await loadCardDbRows();
  const ranked = rows
    .map((row) => {
      if (!isMonsterCard(row)) {
        return null;
      }

      const atkValue = parseCardStatValue(row.atk);
      const supValue = parseCardStatValue(row.sup);

      if (
        atkValue === null ||
        supValue === null ||
        atkValue < 0 ||
        supValue < 0
      ) {
        return null;
      }

      return {
        row,
        value: stat === "atk" ? atkValue : supValue,
      };
    })
    .filter((item): item is { row: CardDbRow; value: number } => item !== null)
    .sort((a, b) =>
      direction === "highest"
        ? b.value - a.value ||
          a.row.cardNoNormalized.localeCompare(b.row.cardNoNormalized)
        : a.value - b.value ||
          a.row.cardNoNormalized.localeCompare(b.row.cardNoNormalized)
    );

  if (!ranked.length) {
    return enforceBlazeStyle(
      `ข้าค้นจากฐานการ์ด 293 ใบแล้ว ยังไม่พบข้อมูล ${stat.toUpperCase()} ที่ใช้จัดอันดับได้`
    );
  }

  return formatCardStatExtremeRows(ranked, stat, direction);
}

function isCardTypeCountQuestion(message: string) {
  const hasCardIntent = includesAnyThaiOrEnglish(message, ["การ์ด", "card", "ใบ"]);
  const hasTypeIntent = includesAnyThaiOrEnglish(message, [
    "มอนสเตอร์",
    "monster",
    "สกิล",
    "skill",
    "ประเภท",
    "แยกประเภท",
  ]);
  const hasCountIntent = includesAnyThaiOrEnglish(message, [
    "กี่ใบ",
    "มีกี่",
    "กี่ประเภท",
    "จำนวน",
    "ทั้งหมด",
    "รวม",
    "นับ",
  ]);

  return hasCardIntent && hasTypeIntent && hasCountIntent;
}

async function buildDirectCardTypeCountReply(message: string) {
  if (!isCardTypeCountQuestion(message)) {
    return "";
  }

  const rows = await loadCardDbRows();
  if (!rows.length) {
    return "";
  }

  const monsterCount = rows.filter(isMonsterCard).length;
  const skillCount = rows.filter(isSkillCard).length;
  const unknownCount = rows.length - monsterCount - skillCount;

  return enforceBlazeStyle(
    [
      `จากฐานข้อมูลการ์ด NEXORA ${rows.length} ใบตอนนี้ แยกประเภทได้ดังนี้`,
      `การ์ดมอนสเตอร์: ${monsterCount} ใบ`,
      `การ์ดสกิล: ${skillCount} ใบ`,
      unknownCount > 0 ? `ยังไม่ระบุประเภทชัดเจน: ${unknownCount} ใบ` : "",
      "หลักแยกประเภท: การ์ดมอนสเตอร์มีค่า ATK/SUP และไม่มีข้อความสกิล ส่วนการ์ดสกิลมีข้อความผลสกิลและไม่มีค่า ATK/SUP โดยตรง",
    ]
      .filter(Boolean)
      .join("\n")
  );
}

function getRequestedElementCountKind(message: string): CardKind | "all" {
  if (includesAnyThaiOrEnglish(message, ["การ์ดสกิล", "สกิล", "skill"])) {
    return "skill";
  }

  if (
    includesAnyThaiOrEnglish(message, [
      "การ์ดมอนสเตอร์",
      "มอนสเตอร์",
      "monster",
    ])
  ) {
    return "monster";
  }

  return "all";
}

function isElementCardCountQuestion(message: string) {
  const hasElementIntent = includesAnyThaiOrEnglish(message, [
    "แต่ละธาตุ",
    "แยกธาตุ",
    "ตามธาตุ",
    "ธาตุละ",
    "ธาตุ",
    "element",
  ]);
  const hasCountIntent = includesAnyThaiOrEnglish(message, [
    "กี่ใบ",
    "มีกี่",
    "จำนวน",
    "นับ",
    "รวม",
    "count",
    "how many",
  ]);
  const hasCardIntent = includesAnyThaiOrEnglish(message, [
    "การ์ด",
    "ใบ",
    "มอนสเตอร์",
    "สกิล",
    "card",
    "monster",
    "skill",
  ]);

  return hasElementIntent && hasCountIntent && hasCardIntent;
}

async function buildDirectElementCardCountReply(message: string) {
  if (!isElementCardCountQuestion(message)) {
    return "";
  }

  const rows = await loadCardDbRows();
  if (!rows.length) {
    return "";
  }

  const kind = getRequestedElementCountKind(message);
  const filteredRows = rows.filter((row) => {
    if (kind === "skill") return isSkillCard(row);
    if (kind === "monster") return isMonsterCard(row);
    return isSkillCard(row) || isMonsterCard(row);
  });
  const orderedElements: CardElement[] = [
    "earth",
    "water",
    "fire",
    "wood",
    "gold",
    "unknown",
  ];
  const counts = new Map<CardElement, number>(
    orderedElements.map((element) => [element, 0])
  );

  for (const row of filteredRows) {
    const element = getCardElement(row);
    counts.set(element, (counts.get(element) || 0) + 1);
  }

  const kindLabel =
    kind === "skill"
      ? "การ์ดสกิล"
      : kind === "monster"
        ? "การ์ดมอนสเตอร์"
        : "การ์ดที่ระบุประเภทได้";
  const total = filteredRows.length;
  const lines = [
    `จากฐานการ์ด NEXORA ${rows.length} ใบ ${kindLabel} แยกตามธาตุได้ดังนี้`,
    ...orderedElements
      .map((element) => {
        const count = counts.get(element) || 0;
        if (element === "unknown" && count <= 0) {
          return "";
        }
        return `${formatCardElement(element)}: ${count} ใบ`;
      })
      .filter(Boolean),
    `รวมทั้งหมด: ${total} ใบ`,
  ];

  return enforceBlazeStyle(lines.join("\n"));
}

function wantsCardName(message: string) {
  const text = normalizeSearchText(message);
  return text.includes("ชื่อ") || text.includes("name");
}

function wantsCardReward(message: string) {
  const text = normalizeSearchText(message);
  return (
    text.includes("รางวัล") ||
    text.includes("แลกรับ") ||
    text.includes("ได้อะไร") ||
    text.includes("reward")
  );
}

function wantsCardValue(message: string) {
  const text = normalizeSearchText(message);
  return text.includes("ระดับ") || text.includes("rarity") || text.includes("value");
}

function wantsCardSkillText(message: string) {
  const text = normalizeSearchText(message);
  return [
    "สกิล",
    "ความสามารถ",
    "skill",
    "ability",
    "effect",
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));
}

function wantsCardCombatStats(message: string) {
  const text = normalizeSearchText(message);
  return [
    "atk",
    "attack",
    "โจมตี",
    "sup",
    "support",
    "สนับสนุน",
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));
}

function wantsCardSkillStats(message: string) {
  return wantsCardSkillText(message) || wantsCardCombatStats(message);
}

function wantsCardCollection(message: string) {
  return hasCollectionIntent(message);
}

function formatCardDbRow(row: CardDbRow, message: string) {
  const wantsName = wantsCardName(message);
  const wantsReward = wantsCardReward(message);
  const wantsValue = wantsCardValue(message);
  const wantsSkillStats = wantsCardSkillStats(message);
  const wantsSkillText = wantsCardSkillText(message);
  const wantsCombatStats = wantsCardCombatStats(message);
  const wantsCollection = wantsCardCollection(message);
  const memberships = formatCardCollectionMemberships(row.cardNoNormalized);
  const kind = getCardKind(row);
  const title = `การ์ด ${row.cardNo} ${row.cardName}`.trim();
  const typeLine = `ประเภท: ${formatCardKind(kind)}`;
  const elementLine = formatCardElementLine(row);
  const wantsOnlyName =
    /ชื่อ|name/i.test(message) &&
    !/รางวัล|แลกรับ|ได้อะไร|ระดับ|rarity|value|สกิล|skill|ability|effect|atk|attack|sup|support|เซ็ต|ชุด|collection|set/i.test(
      message
    );
  const monsterStatLines = isMonsterCard(row)
    ? [`ATK: ${row.atk}`, `SUP: ${row.sup}`]
    : [];
  const skillLines = isSkillCard(row) ? [`สกิล/ความสามารถ: ${row.skill}`] : [];

  if (wantsOnlyName) {
    return [`การ์ด ${row.cardNo} ชื่อ ${row.cardName}`, elementLine].join("\n");
  }

  if (wantsSkillStats) {
    if (wantsSkillText && isMonsterCard(row) && !wantsCombatStats) {
      return [
        title,
        typeLine,
        elementLine,
        "ใบนี้เป็นการ์ดมอนสเตอร์ จึงไม่มีข้อความสกิลแบบการ์ดสกิล",
        ...monsterStatLines,
      ]
        .filter(Boolean)
        .join("\n");
    }

    if (wantsCombatStats && isSkillCard(row) && !wantsSkillText) {
      return [
        title,
        typeLine,
        elementLine,
        "ใบนี้เป็นการ์ดสกิล จึงไม่มีค่า ATK/SUP แบบการ์ดมอนสเตอร์",
        ...skillLines,
      ]
        .filter(Boolean)
        .join("\n");
    }

    return [
      title,
      typeLine,
      elementLine,
      wantsValue ? `ระดับ: ${row.value || "-"}` : "",
      wantsReward ? `รางวัล/เงื่อนไขแลกรับ: ${row.reward || "-"}` : "",
      ...(isSkillCard(row) ? skillLines : monsterStatLines),
      kind === "unknown"
        ? "ถ้าผู้ใช้แนบรูปการ์ดมา ข้าจะอ่านประเภทการ์ดและข้อมูลจากภาพให้โดยตรง"
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (wantsCollection && !wantsReward && !wantsValue) {
    return [
      `การ์ด ${row.cardNo} ${row.cardName}`,
      elementLine,
      memberships
        ? `อยู่ในชุดสะสม: ${memberships}`
        : "ยังไม่พบชุดสะสมที่มีการ์ดใบนี้ในดัชนี canonical",
    ].join("\n");
  }

  if (wantsName && !wantsReward && !wantsValue) {
    return [`การ์ด ${row.cardNo} ชื่อ ${row.cardName}`, elementLine].join("\n");
  }

  if (wantsReward && !wantsName && !wantsValue) {
    return [
      `การ์ด ${row.cardNo} ${row.cardName}`,
      elementLine,
      `รางวัล/เงื่อนไขแลกรับ: ${row.reward || "-"}`,
      memberships ? `ชุดสะสมที่เกี่ยวข้อง: ${memberships}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (wantsValue && !wantsName && !wantsReward) {
    return [
      `การ์ด ${row.cardNo} ${row.cardName}`,
      elementLine,
      `ระดับ: ${row.value || "-"}`,
      memberships ? `ชุดสะสมที่เกี่ยวข้อง: ${memberships}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `การ์ด ${row.cardNo}`,
    `ชื่อ: ${row.cardName}`,
    typeLine,
    elementLine,
    `ระดับ: ${row.value || "-"}`,
    ...skillLines,
    ...monsterStatLines,
    `รางวัล/เงื่อนไขแลกรับ: ${row.reward || "-"}`,
    memberships ? `ชุดสะสมที่เกี่ยวข้อง: ${memberships}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function buildCardImageSkillScanReply(
  row: CardDbRow,
  message: string,
  history: BlazeHistoryItem[],
  userName: string
) {
  if (!wantsCardSkillStats(message) || !row.cardNoNormalized) {
    return "";
  }

  if ((isSkillCard(row) && row.skill) || (isMonsterCard(row) && row.atk && row.sup)) {
    return "";
  }

  const cacheKey = `${row.cardNoNormalized}:${normalizeSearchText(message).slice(0, 180)}`;
  const cached = cardImageScanCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.text;
  }

  const imagePayload = await loadLocalCardImagePayload(row.cardNoNormalized);
  if (!imagePayload) {
    return "";
  }

  const scanMessage = [
    `ผู้ใช้ถามเรื่องสกิล/ATK/SUP ของการ์ด No.${row.cardNoNormalized}`,
    `ข้อมูลจาก Card DB: No.${row.cardNo || row.cardNoNormalized} | ชื่อ ${row.cardName || "-"} | ระดับ ${row.value || "-"} | รางวัล ${row.reward || "-"}`,
    "ให้ตรวจรูปการ์ด NEXORA ที่ระบบแนบจาก public/cards โดยอ่าน OCR จากรูปจริง",
    "ตอบให้ตรงคำถามและครบเฉพาะข้อมูลที่เห็น: ชื่อการ์ด, เลขการ์ด, สกิล/ความสามารถ, ATK, SUP และถ้าจุดใดไม่ชัดให้บอกว่าอ่านไม่ชัด ห้ามเดา",
    `คำถามผู้ใช้: ${message}`,
  ].join("\n");

  const result = await askNativeGemini({
    message: scanMessage,
    history: history.slice(-4),
    userName,
    knowledgeContext: [
      "บริบทเฉพาะการ์ดจากฐานข้อมูล NEXORA:",
      `No.${row.cardNo || row.cardNoNormalized}`,
      `ชื่อ: ${row.cardName || "-"}`,
      `ระดับ: ${row.value || "-"}`,
      `รางวัล/เงื่อนไขแลกรับ: ${row.reward || "-"}`,
      "ถ้าข้อมูลสกิล/ATK/SUP ไม่มีในชีท ให้ยึดการอ่านจากรูปการ์ดที่แนบในคำขอนี้เท่านั้น",
    ].join("\n"),
    imagePayload,
  }).catch((error) => {
    console.warn("BLAZE card image scan fallback:", error);
    return null;
  });

  const reply = result?.reply || "";
  if (reply) {
    cardImageScanCache.set(cacheKey, {
      expiresAt: Date.now() + CARD_IMAGE_SCAN_CACHE_MS,
      text: reply,
    });
  }

  return reply;
}

async function buildDirectCardDbReply(
  message: string,
  history: BlazeHistoryItem[],
  userName = "NEXORA User"
) {
  if (!isCardDbQuestion(message) || !isCardLookupQuestion(message)) {
    return "";
  }

  const requestedCardNo = extractCardNumberFromConversation(message, history);
  const rows = await loadCardDbRows();
  if (!rows.length) {
    if (requestedCardNo && wantsCardSkillStats(message)) {
      const scannedReply = await buildCardImageSkillScanReply(
        {
          cardNo: requestedCardNo,
          cardNoNormalized: requestedCardNo,
          cardName: "",
          reward: "",
          value: "",
          imageUrl: "",
          skill: "",
          atk: "",
          sup: "",
          element: "",
          rawText: "",
          searchText: requestedCardNo,
        },
        message,
        history,
        userName
      );

      if (scannedReply) {
        return enforceBlazeStyle(scannedReply);
      }
    }

    return "";
  }

  const { exact, matches, cardNo } = findCardDbMatches(rows, message, history);

  if (exact) {
    const scannedReply = await buildCardImageSkillScanReply(
      exact,
      message,
      history,
      userName
    );

    if (scannedReply) {
      return enforceBlazeStyle(scannedReply);
    }

    return enforceBlazeStyle(formatCardDbRow(exact, message));
  }

  if (cardNo) {
    if (wantsCardSkillStats(message)) {
      const scannedReply = await buildCardImageSkillScanReply(
        {
          cardNo,
          cardNoNormalized: cardNo,
          cardName: "",
          reward: "",
          value: "",
          imageUrl: "",
          skill: "",
          atk: "",
          sup: "",
          element: "",
          rawText: "",
          searchText: cardNo,
        },
        message,
        history,
        userName
      );

      if (scannedReply) {
        return enforceBlazeStyle(scannedReply);
      }
    }

    return enforceBlazeStyle(
      `ข้าไม่พบการ์ด No.${cardNo} ในฐานข้อมูลการ์ด 293 ใบตอนนี้`
    );
  }

  if (matches.length > 1) {
    return enforceBlazeStyle(
      [
        "ข้าพบการ์ดที่ชื่อใกล้เคียงหลายใบ ระบุเลข No. ให้ข้าอีกนิดแล้วข้าจะตอบชื่อ/รางวัลให้เป๊ะ",
        ...matches.slice(0, 6).map((row) => `- ${row.cardNo} ${row.cardName}`),
      ].join("\n")
    );
  }

  return enforceBlazeStyle(
    "ข้าต้องขอเลขการ์ด No.001-No.293 หรือชื่อการ์ดก่อน จึงจะตอบชื่อ ระดับ และรางวัลจากฐานข้อมูลจริงให้เป๊ะได้"
  );
}

async function buildCardDbKnowledgeContext(
  message: string,
  history: BlazeHistoryItem[]
) {
  if (!isCardDbQuestion(message) || !isCardLookupQuestion(message)) {
    return "";
  }

  const rows = await loadCardDbRows();
  if (!rows.length) {
    return "";
  }

  const { exact, matches } = findCardDbMatches(rows, message, history);
  const selectedRows = exact ? [exact] : matches.length ? matches : rows.slice(0, 293);
  const lines = selectedRows.map((row) => {
    const kind = getCardKind(row);
    const coinReward = nexoraCoinRewards.find((reward) => reward.cardNo === row.cardNo);
    const singleCardReward = nexoraSingleCardNexRewards.find(
      (reward) => reward.cardNo === row.cardNo
    );
    return [
      `- ${row.cardNo} | ${row.cardName}`,
      `ประเภท: ${formatCardKind(kind)}`,
      formatCardElementLine(row),
      `ระดับ: ${row.value || "-"}`,
      coinReward ? `COIN: ${coinReward.coinValue.toLocaleString("th-TH")}` : "",
      singleCardReward
        ? `รางวัลใบเดียว: ${singleCardReward.nexValue.toLocaleString("th-TH")} NEX`
        : "",
      isSkillCard(row) && row.skill ? `สกิล/ความสามารถ: ${row.skill}` : "",
      isMonsterCard(row) && row.atk ? `ATK: ${row.atk}` : "",
      isMonsterCard(row) && row.sup ? `SUP: ${row.sup}` : "",
      `รางวัล/เงื่อนไขแลกรับ: ${row.reward || "-"}`,
    ].filter(Boolean).join(" | ");
  });
  let text = [
    `ฐานข้อมูลการ์ดจริงจาก Google Sheet CARD DB: พบ ${rows.length} ใบ`,
    "กฎ: ถ้าถามชื่อ/รางวัล/ระดับของการ์ด ให้ยึดข้อมูล CARD DB นี้ก่อน ห้ามเดา และถ้ามีเลข No. ให้ตอบแถวเดียวแบบเป๊ะ",
    ...lines,
  ].join("\n");

  if (text.length > MAX_CARD_DB_CONTEXT_CHARS) {
    text =
      text.slice(0, MAX_CARD_DB_CONTEXT_CHARS) +
      "\n- [system] CARD DB ถูกย่อ ถ้าคำถามต้องการใบเฉพาะให้ค้นจากเลข No. ก่อนเสมอ";
  }

  return text;
}

function scoreKnowledgeRow(row: KnowledgeRow, message: string) {
  const haystack = normalizeSearchText(
    `${row.key} ${row.value} ${row.category} ${row.notes}`
  );
  const expandedQuery = buildKnowledgeQueryTerms(message);
  const tokens = expandedQuery.filter((token) => token.length >= 2);
  const tokenScore = tokens.reduce(
    (score, token) => score + (haystack.includes(token) ? 12 : 0),
    0
  );

  const priorityScore = row.priority === 1 ? 18 : row.priority === 2 ? 8 : 0;
  const coreScore = [
    "ai_core",
    "core_identity",
    "card_system",
    "ai_behavior",
  ].includes(row.category)
    ? 10
    : 0;

  return tokenScore + priorityScore + coreScore;
}

function buildKnowledgeQueryTerms(message: string) {
  const text = message.toLowerCase();
  const terms = new Set(
    normalizeSearchText(message)
      .split(" ")
      .filter((token) => token.length >= 2)
  );

  if (/100\s*,?\s*000|1\s*แสน|หนึ่งแสน|แสน/.test(text)) {
    ["100000", "100,000", "1 แสน", "หนึ่งแสน", "แสน"].forEach((term) =>
      terms.add(normalizeSearchText(term))
    );
  }

  if (/เซ็ต|set|ชุด|collection|คอลเลก/.test(text)) {
    ["collection", "set", "เซ็ต", "ชุด", "คอลเลกชั่น", "สะสม"].forEach((term) =>
      terms.add(normalizeSearchText(term))
    );
  }

  if (/รางวัล|reward|แลก|nex|เน็ก/.test(text)) {
    ["reward", "รางวัล", "แลก", "nex", "NEX"].forEach((term) =>
      terms.add(normalizeSearchText(term))
    );
  }

  if (/แลกแต้ม|เพิ่มแต้ม|nexora tcg|coin|ส่งการ์ด|หน้าร้าน|พัสดุ|ขนส่ง|สภาพการ์ด/.test(text)) {
    [
      "แลกแต้ม",
      "NEXORA TCG",
      "NEX",
      "COIN",
      "ส่งการ์ด",
      "หน้าร้าน",
      "พัสดุ",
      "ขนส่ง",
      "สภาพการ์ด",
      "ตรวจสภาพ",
    ].forEach((term) => terms.add(normalizeSearchText(term)));
  }

  if (/คูปอง|coupon|แลกรางวัล|รับรางวัล|ของรางวัล|qr|คิวอาร์|หัก ณ ที่จ่าย|ลิมิเต็ด|limited/.test(text)) {
    [
      "คูปอง",
      "coupon",
      "แลกรางวัล",
      "รับรางวัล",
      "ของรางวัล",
      "NEXORA TCG",
      "QR Code",
      "คิวอาร์",
      "หัก ณ ที่จ่าย",
      "รางวัลลิมิเต็ด",
      "จำนวนจำกัด",
    ].forEach((term) => terms.add(normalizeSearchText(term)));
  }

  return Array.from(terms).filter(Boolean);
}

function isExhaustiveKnowledgeQuestion(message: string) {
  const text = message.toLowerCase();
  return (
    /อะไรบ้าง|ไหนบ้าง|ทั้งหมด|ทุก|ครบ|กี่|รายชื่อ|รายการ|เซ็ต|set|collection|คอลเลก|รางวัล|reward|แลก|100\s*,?\s*000|1\s*แสน|หนึ่งแสน/.test(
      text
    )
  );
}

function formatKnowledgeRows(rows: KnowledgeRow[], message: string) {
  const exhaustive = isExhaustiveKnowledgeQuestion(message);
  const scoredRows = [...rows]
    .map((row) => ({
      row,
      score: scoreKnowledgeRow(row, message),
    }))
    .sort((a, b) => b.score - a.score || a.row.priority - b.row.priority);

  const sortedRows = (exhaustive
    ? scoredRows.filter((item) => item.score > 0)
    : scoredRows.slice(0, 120)
  )
    .slice(0, exhaustive ? 180 : 120)
    .map(({ row }) => {
      const source = row.sourceUrl ? ` | source: ${row.sourceUrl}` : "";
      return `- [${row.category || "DATA"}] ${row.key}: ${row.value}${source}`;
    });

  let text = sortedRows.join("\n");
  if (text.length > MAX_SHEET_CONTEXT_CHARS) {
    text = text.slice(0, MAX_SHEET_CONTEXT_CHARS) + "\n- [system] DATA ถูกย่อเพื่อให้ตอบไว";
  }

  return text;
}

async function loadSheetKnowledge(message: string) {
  const now = Date.now();

  if (sheetKnowledgeCache && sheetKnowledgeCache.expiresAt > now) {
    return [
      "ข้อมูลสดจาก Google Sheet DATA ล่าสุด:",
      formatKnowledgeRows(sheetKnowledgeCache.rows, message),
    ].join("\n");
  }

  try {
    const response = await fetchWithTimeout(
      getDataSheetCsvUrl(),
      {
        method: "GET",
        headers: {
          "User-Agent": "NEXORA-Blaze-AI/1.0",
        },
      },
      4500
    );
    const csv = await response.text();

    if (!response.ok || !csv.includes("key") || !csv.includes("value")) {
      throw new Error(`DATA sheet unavailable (${response.status})`);
    }

    const rows = csvRowsToKnowledgeRows(csv);
    if (!rows.length) {
      throw new Error("DATA sheet empty");
    }

    const text = [
      "ข้อมูลสดจาก Google Sheet DATA ล่าสุด:",
      formatKnowledgeRows(rows, message),
    ].join("\n");

    sheetKnowledgeCache = {
      expiresAt: now + KNOWLEDGE_CACHE_MS,
      rows,
      text,
    };

    return text;
  } catch (error) {
    console.warn("BLAZE DATA sheet knowledge fallback:", error);
    return sheetKnowledgeCache?.text || "";
  }
}

function selectOfficialPages(message: string) {
  const query = normalizeSearchText(message);
  const pageLimit = isExhaustiveKnowledgeQuestion(message) || hasCollectionIntent(message) ? 5 : 3;

  return [...OFFICIAL_SITE_PAGES]
    .map((page) => {
      const haystack = normalizeSearchText(
        `${page.title} ${page.url} ${page.keywords.join(" ")}`
      );
      const score = page.keywords.reduce(
        (total, keyword) =>
          total + (query.includes(normalizeSearchText(keyword)) ? 20 : 0),
        0
      );
      return {
        page,
        score:
          score ||
          (query
            .split(" ")
            .some((token) => token.length >= 2 && haystack.includes(token))
            ? 8
            : 0),
      };
    })
    .sort((a, b) => b.score - a.score)
    .filter((item, index) => item.score > 0 || index < 2)
    .slice(0, pageLimit)
    .map((item) => item.page);
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchOfficialPageText(url: string) {
  const now = Date.now();
  const cached = siteKnowledgeCache.get(url);

  if (cached && cached.expiresAt > now) {
    return cached.text;
  }

  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        "User-Agent": "NEXORA-Blaze-AI/1.0",
      },
    },
    4500
  );
  const html = await response.text();

  if (!response.ok) {
    throw new Error(`site ${response.status}`);
  }

  const text = stripHtml(html).slice(0, 16000);
  siteKnowledgeCache.set(url, {
    expiresAt: now + SITE_CACHE_MS,
    text,
  });
  return text;
}

async function loadOfficialSiteKnowledge(message: string) {
  const pages = selectOfficialPages(message);
  const chunks: string[] = [];

  await Promise.all(
    pages.map(async (page) => {
      try {
        const text = await fetchOfficialPageText(page.url);
        if (text) {
          chunks.push(`- ${page.title} (${page.url}): ${text}`);
        }
      } catch (error) {
        console.warn("BLAZE official site knowledge skipped:", page.url, error);
      }
    })
  );

  const context = chunks.join("\n");
  return context.length > MAX_SITE_CONTEXT_CHARS
    ? context.slice(0, MAX_SITE_CONTEXT_CHARS) + "\n- [system] ข้อมูลเว็บถูกย่อเพื่อให้ตอบไว"
    : context;
}

async function buildKnowledgeContext(
  message: string,
  history: BlazeHistoryItem[]
) {
  const [sheetContext, siteContext, cardDbContext] = await Promise.all([
    loadSheetKnowledge(message),
    loadOfficialSiteKnowledge(message),
    buildCardDbKnowledgeContext(message, history),
  ]);

  return [
    BLAZE_CORE_KNOWLEDGE,
    BLAZE_COLLECTION_REWARD_INDEX,
    cardDbContext,
    sheetContext,
    siteContext
      ? `ข้อมูลเสริมจากเว็บทางการ nexoracardgame.com แบบ cache ตามคำถาม:\n${siteContext}`
      : "",
    "กฎสำคัญ: ยึด DATA และเว็บทางการก่อนเดา หากข้อมูลขัดกันให้บอกว่าควรตรวจสอบประกาศล่าสุดก่อน ห้ามโยนไป Line ยกเว้นคำถามซื้อ/ขายสินค้าเท่านั้น",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const BLAZE_CORE_KNOWLEDGE = [
  "ฐานข้อมูล NEXORA สำหรับท่านเบลซ:",
  NEXORA_CARD_FEST_KNOWLEDGE,
  "- NEXORA CARDGAME คือการ์ดเกมสะสมและแข่งขันที่รวมโลกแฟนตาซี 5 ธาตุ การสะสม การดวล การซื้อขาย และระบบรางวัลจริงเข้าไว้ด้วยกัน",
  "- จุดยืนของแบรนด์: Collect Duel Conquer. ทุกการ์ดมีคุณค่า ทุกการครอบครองคือจุดเริ่มต้นของตำนาน",
  "- รางวัลรวมที่สื่อสารบนเว็บหลัก: มากกว่า 10,000,000 บาท",
  "- Ver.1 มีการ์ดทั้งหมด 293 แบบ ผลิตรวม 999,999 ใบ บรรจุภายใน 8,928 กล่อง",
  "- 1 ซองบรรจุการ์ด 7 ใบ และ 1 กล่องบรรจุ 16 ซอง",
  "- ราคาขายปัจจุบันจากฐาน DATA: Bronze Pack 45 บาท, Silver Pack 79 บาท, Gold Pack 115 บาท, Bronze Box 650 บาท, Silver Box 1,100 บาท, Gold Box 1,650 บาท",
  "- ข้อมูลบริษัท: บริษัท เนคโชร่า 63 จำกัด, โทร 080-995-9979, อีเมล contact@nexoracardgame.com. Line Official @Nexoracard ใช้ตอบเฉพาะเรื่องซื้อ/ขายสินค้า/สั่งซื้อ/ตัวแทนจำหน่ายเท่านั้น",
  "- การ์ดทุกใบมี Serial Number เฉพาะ ใช้ตรวจสอบข้อมูลและยืนยันความเป็นของแท้ในระบบ",
  "- ระดับการ์ดที่ต้องรู้: Bronze, Silver, Gold, Diamond. การ์ดใช้สะสม ใช้ดวล ใช้จัดเซ็ต ใช้ซื้อขาย และบางใบใช้เข้าเงื่อนไขแลกรางวัล",
  "- จักรวาล NEXORA มี 5 ธาตุหลัก: ดิน น้ำ ไฟ ไม้ ทอง. เมืองและกลุ่มสำคัญคือ Valecrown/Stoneborne, Thalassus/Mariners, Pyreholm/Pyrekin, Verdelore/Greenwardens, Aurion Spires/Mechanists",
  "- First Ember คือแสงแรกที่แตกออกเป็น 5 ธาตุและให้กำเนิดโลก NEXORA",
  "- Archivists คือบรรพชนผู้ไร้นาม นักบันทึกโบราณและผู้เฝ้าสมดุล ผู้สร้าง Sigil-Card รวม 293 ใบ",
  "- Card of Origin คือการ์ดกำเนิดที่ผนึกกุญแจสมดุลของโลก แต่ถูกเงาปริศนาขโมยไป",
  "- The Spark คือเหตุการณ์ดวลของ Caven กับ Lira ที่ถูกแทรกแซง ทำให้การ์ดหลายสิบใบตื่นพร้อมกันและสงครามธาตุเริ่มปะทุ",
  "- NEX คือหน่วยสะสมแลกรางวัลภายในระบบ ไม่ใช่เงินสด. Bronze = 0.5 NEX, Silver = 1 NEX, Gold = 2 NEX. สูตรคือ (Bronze x 0.5) + (Silver x 1) + (Gold x 2)",
  "- ตัวอย่างรางวัล NEX: Honda PCX, iPhone 17 Pro Max, Honda Scoopy i, ทองคำแท่ง 1 บาท, Apple Watch Ultra 3, PlayStation 5, LG Smart TV 55 นิ้ว, ฟิกเกอร์, เสื้อแจ็คเก็ต, แก้ว YETI, เสื้อยืด, สมุดสะสมหรือกล่องเก็บการ์ด",
  "- COIN คือเหรียญในการ์ดบางใบ ใช้สะสมเพื่อแลกรางวัลเฉพาะในระบบ NEXORA. อัตราดรอปบนเว็บระบุ 5-10% ต่อกล่อง และมูลค่าเหรียญรวม 2,000,000 NEX",
  "- ตัวอย่างรางวัล COIN: ทองคำแท่ง, มอเตอร์ไซค์ไฟฟ้า, iPhone 17 Pro Max, สร้อยทอง, MacBook Air, iPad Pro, PlayStation 5, Apple Watch, จักรยานไฟฟ้า, สกูตเตอร์ไฟฟ้า, เสื้อยืด, กระเป๋า, สมุดสะสมการ์ด, พวงกุญแจ NEXORA",
  "- ระบบแลกสินค้า No Limit ให้ใช้ NEX แลกสินค้าได้หลายประเภทตามมูลค่าและเงื่อนไข เช่น ฟิกเกอร์ เสื้อผ้า อุปกรณ์ไอที โทรศัพท์ เครื่องใช้ไฟฟ้า รถยนต์ รถจักรยานยนต์ ทองคำ และสินค้าอื่นตามความต้องการ",
  "- รางวัลในแอพ NEXORA TCG: มีรางวัลให้แลกหลากหลาย ตั้งแต่รางวัลเล็ก รางวัลลิมิเต็ดจำนวนจำกัดจาก NEXORA แบบใครแลกก่อนได้ก่อนจนกว่าคูปองหมด ไปจนถึงรางวัลใหญ่ วิธีแลกรางวัลจริงคือกดแลกในแอพให้ได้คูปองก่อน จากนั้นนำคูปองมาแสดงที่หน้าร้าน พนักงานจะสแกนหรือยิง QR Code บนคูปองเพื่อยืนยันการใช้งาน เมื่อยืนยันแล้วบริษัทจะดำเนินการหัก ณ ที่จ่ายสำหรับการแลกรางวัลตามกฎหมาย แล้วจึงมอบรางวัลให้ลูกค้าเป็นอันเสร็จสิ้น",
  `- ขั้นตอนการแลกแต้ม NEX / COIN เข้าระบบ NEXORA TCG: ลูกค้าต้องนำการ์ดจริงมาให้บริษัทตรวจสอบก่อนเพิ่มแต้ม สามารถนำการ์ดมาที่หน้าร้านเองหรือส่งมาทางขนส่งได้ แต่ถ้าส่งมาลูกค้าต้องรับความเสี่ยงเรื่องสภาพการ์ดจากขนส่งเอง บริษัทจะถ่ายวิดีโอขณะเปิดกล่องพัสดุและตรวจสภาพการ์ดอย่างละเอียดให้ลูกค้าดู หากการ์ดเป็นของแท้และสภาพสมบูรณ์ 90-100% บริษัทจะเพิ่มแต้มเข้าบัญชีในแอพ NEXORA TCG ให้ทันที ทางที่ดีที่สุดคือมาหน้าร้านด้วยตนเองเพื่อความปลอดภัยของการ์ด พิกัดหน้าร้าน: ${POINT_REDEMPTION_LOCATION_URL}`,
  "- คู่มือแอพ NEXORA TCG: แอพนี้เป็นศูนย์กลางบัญชีผู้เล่น NEXORA ใช้ดูยอด NEX/COIN, สแกนการ์ด, เปิดข้อมูลการ์ด, แลกรางวัล, เก็บคูปอง, ซื้อขายการ์ด, ซื้อขายกล่อง, ตั้งโพสต์รับซื้อ, แชท, คอมมูนิตี้, โปรไฟล์ และระบบพนักงาน/แอดมิน",
  "- การเข้าใช้งาน NEXORA TCG: ผู้ใช้ล็อกอินด้วย LINE หรือ Google. ถ้าขึ้น OAuthAccountNotLinked แปลว่าบัญชีนี้เคยใช้วิธีล็อกอินอื่นไว้ ให้เข้าด้วยวิธีเดิมก่อน หรือเชื่อมบัญชีจากหน้าตั้งค่าโปรไฟล์. ถ้าล็อกอินค้างให้ปิดหน้าแล้วเข้าใหม่ ห้ามกดซ้ำตอนระบบแสดงกำลังเข้าสู่แอพ",
  "- หน้าแรกของแอพมีทางเข้า Marketplace, Community, ติดตั้ง PWA/แอพ, และบางบัญชีแอดมินจะเห็นทางเข้า TEST BATTLE",
  "- กระเป๋า /wallet: แสดงยอด NEX, COIN, โปรไฟล์ผู้ใช้, ประวัติรับแต้มจากการสแกน/เพิ่มแต้ม, ประวัติคูปองล่าสุด, และรายการคืนแต้มจากคูปองที่ถูก rollback โดยแอดมิน",
  "- สแกนการ์ด /scan: เปิดกล้องเพื่อจับภาพการ์ดในกรอบแล้วส่งตรวจจับผ่านระบบ local/AI/hybrid จากนั้นดึงข้อมูลการ์ดจาก /api/card. ถ้ากล้องใช้ไม่ได้ให้ให้ผู้ใช้ตรวจสิทธิ์กล้อง, ใช้ HTTPS/แอพที่รองรับ, ปิดแอพกล้องอื่น, หรือกรอก/ค้นเลขการ์ดแทนเมื่อมีช่องให้ใช้",
  "- รางวัล /rewards: แสดงรายการ Reward จากระบบจริงพร้อมราคา NEX หรือ COIN และ stock. ผู้ใช้ต้องล็อกอินก่อน ถ้าแต้มพอและ stock ยังมีจึงแลกได้ ระบบจะหักยอดและสร้างคูปองให้",
  "- คูปอง /redeem และ /coupon/[code]: หลังแลกรางวัล ผู้ใช้จะได้คูปองพร้อม QR Code. คูปองที่ยังไม่ใช้ให้แสดงกับพนักงานเพื่อสแกนยืนยัน. คูปองที่ used แล้วใช้ซ้ำไม่ได้. คูปองที่ reversed/rollback จะไม่สามารถนำไปใช้ และระบบคืน NEX/COIN ตามรายการ rollback",
  "- การใช้งานคูปองหน้าร้าน: พนักงานเปิด /staff หรือ /admin/staff-scan แล้วสแกน QR หรือกรอกรหัสคูปอง. ระบบจะตรวจสอบเจ้าของ รางวัล สถานะ used/reversed ก่อน พนักงานต้องกดยืนยันใช้จริงอีกครั้งจึงถือว่าใช้คูปองสำเร็จ",
  "- Marketplace /market: ตลาดขายการ์ด ผู้ใช้ดูโพสต์ขายล่าสุด ยอดไลก์ ยอดวิว รายละเอียดผู้ขาย ราคา รูปการ์ด และกดเข้ารายละเอียดการ์ดได้. มีรายการเด่น/ล่าสุด, ปุ่มสร้างโพสต์ขาย, ดีล, wishlist, seller center และ auction",
  "- สร้างโพสต์ขาย /market/create: ผู้ขายลงรายการการ์ด ใส่เลขการ์ด, serial ถ้ามี, ราคา, รูป/ข้อมูลการ์ด. โพสต์จะอยู่สถานะ active จนถูกลบ/ขาย/เปลี่ยนสถานะ",
  "- รายละเอียดการ์ดในตลาด /market/card/[id]: ผู้ซื้อดูข้อมูลการ์ดและผู้ขาย กดถูกใจ เพิ่ม wishlist ส่งคำขอดีลหรือเปิดแชทได้ตามสถานะรายการ",
  "- ดีลตลาด /market/deals: ใช้จัดการคำขอซื้อขายระหว่างผู้ซื้อกับผู้ขาย. มีสถานะ pending/accepted/rejected/cancelled/verified ตาม flow. เมื่อตกลงแล้วสามารถใช้ห้องแชทดีลและหน้า verify เพื่อยืนยันการซื้อขาย",
  "- Seller Center /market/seller-center: ผู้ขายจัดการโพสต์ขายของตัวเอง ดูรายการที่ลงไว้ แก้ไข ลบ และติดตามดีลที่เกี่ยวข้อง. แอดมินหรือ GM มีสิทธิจัดการได้กว้างกว่าผู้ใช้ทั่วไป",
  "- Wishlist /market/wishlist: เก็บการ์ดหรือโพสต์ขายที่สนใจไว้ดูภายหลัง ถ้าหาโพสต์ไม่เจอให้เช็กว่ารายการถูกลบหรือเปลี่ยนสถานะแล้วหรือไม่",
  "- Auction /market/auction: ระบบห้องประมูลการ์ด มีห้อง scheduled/live/ended, ราคาบิทขั้นต่ำ, step การบิท, รายชื่อบิท, เชิญเพื่อนเข้าห้อง, ยืนยันผู้ชนะ และสร้างช่องทางคุยต่อหลังจบ. เจ้าของห้องหรือแอดมินลบห้องได้ตามเงื่อนไข",
  "- Buy Market /buy-market: ตลาดรับซื้อ ใช้สำหรับผู้ซื้อประกาศว่าต้องการซื้อการ์ด. มีหน้าสร้างโพสต์รับซื้อ, ศูนย์รับซื้อ, wishlist, รายละเอียดโพสต์รับซื้อ และดีลรับซื้อแยกจากตลาดขายปกติ",
  "- Box Market /box-market: ตลาดซื้อขายกล่อง/สินค้า NEXORA มีรายการจากผู้ขายและรายการของฉัน. ผู้ใช้สร้างรายการขายกล่องได้ และมีหน้า /box-market/verify สำหรับตรวจสอบหรือยืนยันดีล/ผู้ขายตามระบบ",
  "- DM /dm: ระบบแชทส่วนตัวและแชทจากดีล ใช้คุยกับผู้เล่น ผู้ซื้อ ผู้ขาย หรือคู่ดีล. รองรับรายการห้อง, ห้องแชท, โหลดประวัติเก่า, unread, clear room, ส่งข้อความ และแนบรูปผ่าน upload/chat",
  "- Community /community: ค้นหาผู้เล่น ดูเพื่อน รับ/ส่งคำขอเป็นเพื่อน และดูสถานะความสัมพันธ์. ใช้เพื่อเชื่อมต่อก่อนแชทหรือเชิญเข้าห้องประมูล",
  "- Profile /profile/[id] และ /profile/me: โปรไฟล์ผู้ใช้แสดงชื่อ รูป หน้าปก bio ช่องทางติดต่อ ประวัติ/ความน่าเชื่อถือที่เกี่ยวข้องกับตลาด และลิงก์ไปยังผู้ขาย. /profile/me จะพาไปโปรไฟล์ของตัวเอง",
  "- Settings /settings/profile: แก้ display name, username, รูปโปรไฟล์, cover image, ตำแหน่งภาพปก, bio, Facebook/LINE URL และดู/เชื่อมบัญชี LINE/Google ที่ผูกกับผู้ใช้",
  "- Notifications: ระบบมี notification, wallet notifications, push subscribe และสถานะอ่านแล้ว. ถ้าแจ้งเตือนไม่ขึ้นให้ตรวจสิทธิ์แจ้งเตือนของเบราว์เซอร์/มือถือและลองรีเฟรช",
  "- Live /live: หน้าควบคุมหรือพื้นที่ไลฟ์ของระบบ NEXORA มี API live และ live/ban สำหรับจัดการสถานะ/แบนตามสิทธิ์",
  "- Admin /admin: สำหรับ role admin/gm/superadmin ใช้ดู dashboard จำนวนผู้ใช้ รางวัล คูปอง คูปองที่ใช้แล้ว ยอด NEX/COIN รวม กราฟผู้ใช้ และ point log ล่าสุด",
  "- Admin สมาชิก: /admin/members ใช้ดูสมาชิกและแก้ยอด wallet รายคนผ่าน update-nex, update-coin หรือ adjust-wallet. การปรับยอดควรทำเมื่อมีหลักฐานการตรวจการ์ด/ธุรกรรมจริง",
  "- Admin รางวัล: /admin/rewards ใช้สร้าง แก้ไข ลบ reward ตั้งชื่อ รูป ราคา NEX/COIN และ stock. หากผู้ใช้บอกแลกรางวัลไม่ได้ ให้เช็กแต้มไม่พอ, stock หมด, reward ถูกลบ/แก้, หรือ session ไม่ตรง",
  "- Admin คูปอง: /admin/coupons ใช้ดูคูปองทั้งหมดและ rollback คูปองที่ต้องย้อนกลับ. Rollback ใช้เมื่อคูปองผิดพลาดหรือจำเป็นต้องคืน NEX/COIN ให้ผู้ใช้ และต้องบันทึกเหตุผล",
  "- Admin point logs: /admin/point-logs ใช้ตรวจประวัติการเพิ่มแต้ม/คืนแต้มตาม lineId, type, amount, point และเวลา",
  "- หลักการตอบปัญหาแอพ: ให้ตอบเป็นขั้นตอนสั้น ๆ ก่อน เช่น 1) อยู่หน้าไหน 2) กดอะไร 3) เงื่อนไขที่ต้องมี 4) ถ้าไม่สำเร็จให้เช็ก login/session/สิทธิ์/ยอดแต้ม/stock/สถานะรายการ/อินเทอร์เน็ต/สิทธิ์กล้อง 5) ถ้ายังไม่ได้ให้แนะนำส่งหลักฐานหน้าจอและรหัสรายการหรือรหัสคูปองให้แอดมินตรวจ",
  "- ห้ามบอกให้ผู้ใช้ใช้ Line Official สำหรับปัญหาใช้งานแอพทั่วไป ยกเว้นเรื่องซื้อสินค้า สั่งซื้อ สมัครตัวแทน หรือจัดส่ง. สำหรับปัญหาแอพให้แนะนำตรวจในแอพหรือให้แอดมิน/พนักงานตรวจจากระบบก่อน",
  "- การ์ดหายากพิเศษบางใบมีรางวัลแลกเป็น NEX ตามรายการที่บริษัทกำหนด เช่น 200,000 / 100,000 / 80,000 / 70,000 / 60,000 / 40,000 / 30,000 / 25,000 / 20,000 / 15,000 / 10,000 / 5,000 / 3,000",
  "- Collection: ผู้เล่นสะสมการ์ดให้ครบ Set เพื่อปลดล็อกรางวัล. ฐาน canonical ตอนนี้มีชุดการ์ดสะสมทั้งหมด 40 เซ็ตจากหน้า card-collections. เซ็ต 1-19 เป็นชุดหลัก, เซ็ต 20-40 เป็นชุดฟอยล์พิเศษ และเซ็ต 40 เป็นกติกาพิเศษแบบเลือกการ์ดฟอยล์ 1 แบบแล้วสะสมหมายเลขนั้นซ้ำให้ครบ 36 ใบ",
  "- Battle: มี 3 โหมดหลัก 13 เกม. Easy: RPS Battle, Hand of Fate RPS, Ultimate RPS Showdown, Rock Paper Scissors Royale. Normal: Elemental Chain, Triple Conflict, Decurion Conquest, Power Clash, Power Synergy Battle. Hard: Triad Dominion, Pentad Dominion, Heptad Dominion, Ennead Dominion",
  "- กติกาบนเว็บระบุชัดว่าใช้เพื่อการสะสมและความบันเทิง ห้ามนำไปใช้ในเชิงการพนันหรือการเดิมพันทุกกรณี. เมื่อตอบเรื่องดวลต้องย้ำจุดนี้",
  "- งานเปิดตัว NEXORA: ลงทะเบียนฟรี มีสิทธิ์รับซองสุ่ม 1 ซอง 7 ใบ, สุ่มเสื้อและเข็มกลัด Limited, ทดลองเล่นกับทีมงาน, ลุ้นรางวัล, ซื้อสินค้า First Release, พบทีมผู้สร้าง. ข้อมูลเดิมใน DATA ระบุสถานที่ตลาด Black Market สมุทรปราการ และช่วง 28 มีนาคม 2569 - 1 เมษายน 2569",
  "- ตัวแทนจำหน่าย: สมัครต้องสั่งซื้อขั้นต่ำ 20,000 บาท ได้เสื้อสมาชิก 1 ตัวและ Member ID. สิทธิ์สำคัญคือส่วนลดหรือคอมมิชชั่น 10%, ระบบทีม 2%, ต่ออายุปีละ 200 บาท",
  "- การรับรางวัล: ต้องมารับด้วยตนเอง แสดงบัตรประชาชนตัวจริง ไม่โอนสิทธิ์แทน. การ์ดแลกต้องเป็นของแท้และสมบูรณ์ 90-100% ไม่มีรอยขาด ฉีก เปียกน้ำ หรือบุบ",
  "- Kael Ignivar หมายเลข 006 เป็นการ์ดมอนสเตอร์แรร์หายาก ผลิตจำกัด 5 ใบ มีพลังและเหรียญสูง และอยู่ในเซ็ตสำคัญหลายชุด",
  "กฎการตอบจากฐานความรู้:",
  "- ถ้าถามว่า NEXORA คืออะไร ให้ตอบว่าไม่ใช่แค่เกม แต่คือการ์ดเกมสะสมและแข่งขันที่มีระบบรางวัลจริง มี Serial ตรวจสอบได้ มี 5 ธาตุ และมีระบบ NEX/COIN/Collection/Battle",
  "- ถ้าถามว่าคุ้มไหม ให้ย้ำทุกการ์ดมีค่า NEX, มีเส้นทางสะสม, มี COIN และมีรางวัลจริง แต่ NEX/COIN ไม่ใช่เงินสด",
  "- ถ้าถามซื้อ ขายสินค้า สั่งซื้อ ราคา ซอง กล่อง การจัดส่ง หรือสมัครตัวแทน ให้ตอบข้อมูลสำคัญก่อน แล้วจึงแนะนำ Line Official @Nexoracard ได้",
  "- ถ้าข้อมูลเป็นข่าว ตารางงาน รุ่นสินค้า หรือสิ่งที่เปลี่ยนได้ ให้บอกว่าควรตรวจสอบประกาศล่าสุดก่อนยืนยัน แต่ห้ามโยนไป Line ถ้าไม่ใช่เรื่องซื้อ/ขายสินค้า",
].join("\n");

function buildSystemPrompt(userName: string, knowledgeContext: string) {
  const productContext = [
    knowledgeContext || BLAZE_CORE_KNOWLEDGE,
    NEXORA_CARD_FEST_KNOWLEDGE,
    BLAZE_CARD_REWARD_INDEX,
    process.env.BLAZE_PRODUCT_CONTEXT || "",
  ]
    .filter(Boolean)
    .join("\n\nข้อมูลเสริมจาก ENV:\n");

  return [
    "ชื่อของคุณคือ Blaze Warlock",
    "คุณคือ ท่านเบลซ ผู้ช่วยประจำโลก NEXORA",
    "เมื่อต้องพูดแทนตัวเอง ให้ใช้คำว่า ข้า หรือ ท่านเบลซ เท่านั้น แต่ห้ามยัดคำว่า ข้า นำหน้าคำตอบข้อมูลทั่วไป",
    "ห้ามแทนตัวเองเป็นผู้หญิง และห้ามใช้คำว่า ค่ะ, คะ, ดิฉัน, หนู, ฉัน",
    "น้ำเสียงต้องมั่นใจ น่าเกรงขาม อบอุ่น และเข้าใจง่าย",
    "NEXORA คือภารกิจหลักอันดับ 1 ถ้าผู้ใช้ถามเรื่อง NEXORA ให้ตอบลึก แม่น และช่วยต่อยอด",
    "ถ้าผู้ใช้ถามเรื่องทั่วไป ให้ตอบตรงคำถามก่อน แล้วยังคงบุคลิกท่านเบลซ",
    "ถ้าเป็นข้อมูลปัจจุบัน ข่าว ราคา หุ้น ทอง อากาศ ตารางแข่ง หรือเรื่องที่เปลี่ยนเร็ว ห้ามเดาเอง ให้บอกว่าควรตรวจสอบข้อมูลล่าสุดก่อน",
    "เวลาตอบในแชท ห้ามใช้ Markdown เช่น **, *, #, ``` ให้ตอบเป็นข้อความธรรมดาอ่านง่าย",
    BLAZE_FORMATTING_POLICY,
    "ถ้าคำถามกำกวมหรือสั้น ให้ตอบจากบริบทก่อน ถ้าเดาไม่ได้จริงค่อยถามกลับสั้นๆ",
    BLAZE_RESPONSE_POLICY,
    `ชื่อผู้ใช้ในระบบ: ${userName || "NEXORA User"}`,
    "",
    productContext,
  ].join("\n");
}

function buildGeminiUrl(modelName: string, apiKey: string) {
  return (
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(modelName) +
    ":generateContent?key=" +
    encodeURIComponent(apiKey)
  );
}

function parseGeminiText(data: unknown) {
  const candidate = (data as { candidates?: GeminiCandidate[] } | null)
    ?.candidates?.[0];
  const parts = Array.isArray(candidate?.content?.parts)
    ? candidate.content.parts
    : [];

  return parts
    .map((part) => sanitizeText(part?.text))
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function askNativeGemini({
  message,
  history,
  userName,
  knowledgeContext,
  imagePayload,
}: {
  message: string;
  history: BlazeHistoryItem[];
  userName: string;
  knowledgeContext: string;
  imagePayload?: BlazeImagePayload | null;
}): Promise<BlazeResult | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }

  const modelName = process.env.BLAZE_AI_MODEL || DEFAULT_MODEL;
  const contents: { role: "user" | "model"; parts: GeminiPart[] }[] = history.map((item) => ({
    role: item.role,
    parts: [{ text: item.text }],
  }));

  const userParts: GeminiPart[] = [
    {
      text: imagePayload
        ? [
            "ผู้ใช้แนบรูปการ์ดหรือภาพที่ต้องการให้ตรวจสอบ",
            "งานหลัก: อ่าน OCR จากภาพให้ละเอียดก่อนตอบ โดยเฉพาะเลขการ์ด ชื่อการ์ด สกิล/ความสามารถ ค่า ATK ค่า SUP ระดับ ธาตุ และข้อความเล็กบนการ์ด",
            "ถ้าภาพเป็นการ์ด NEXORA ให้เทียบกับบริบท Card DB/ฐานความรู้เท่าที่มี แต่รายละเอียดที่เห็นจากภาพ เช่น สกิล ATK SUP ให้ยึดสิ่งที่อ่านได้จากภาพเป็นหลัก",
            "ถ้ามองไม่ชัด ให้บอกตรง ๆ ว่าจุดไหนไม่ชัด ห้ามเดาตัวเลขหรือสกิล",
            `คำถามของผู้ใช้: ${message || "วิเคราะห์รูปการ์ดนี้และอ่านรายละเอียดทั้งหมดที่เห็น"}`,
          ].join("\n")
        : `คำถามของผู้ใช้: ${message}`,
    },
  ];

  if (imagePayload) {
    userParts.push({
      inlineData: {
        mimeType: imagePayload.mimeType,
        data: imagePayload.base64Data,
      },
    });
  }

  contents.push({
    role: "user",
    parts: userParts,
  });

  const response = await fetchWithTimeout(
    buildGeminiUrl(modelName, apiKey),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildSystemPrompt(userName, knowledgeContext) }],
        },
        contents,
        generationConfig: {
          temperature: 0.55,
          topP: 0.9,
          topK: 30,
          maxOutputTokens: 8192,
        },
      }),
    },
    25000
  );

  const raw = await response.text();
  let data: unknown = null;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Gemini response is not JSON");
  }

  if (!response.ok || (data as { error?: { message?: string } })?.error) {
    const detail =
      (data as { error?: { message?: string } })?.error?.message ||
      `Gemini HTTP ${response.status}`;
    throw new Error(detail);
  }

  const reply = parseGeminiText(data);
  return {
    reply: enforceBlazeStyle(reply),
    source: "gemini",
  };
}

function getScriptUrl() {
  return (process.env.BLAZE_AI_SCRIPT_URL || DEFAULT_SCRIPT_URL).trim();
}

function isImageQuestion(message: string) {
  const text = message.toLowerCase();
  return [
    "รูป",
    "ภาพ",
    "แนบ",
    "สแกน",
    "ดูการ์ด",
    "วิเคราะห์การ์ด",
    "image",
    "photo",
    "scan",
  ].some((keyword) => text.includes(keyword));
}

function buildImageUnavailableReply() {
  return enforceBlazeStyle(
    "ตอนนี้ระบบ Vision ของท่านเบลซต้องใช้ GEMINI_API_KEY บนเซิร์ฟเวอร์ก่อน จึงจะอ่านเลขการ์ด ชื่อการ์ด สกิล ATK SUP และข้อความบนภาพได้ทันที"
  );
}

function isPlaceholderImageReply(reply: string, message: string) {
  if (isImageQuestion(message)) {
    return false;
  }

  const text = reply.toLowerCase();
  return [
    "แนบรูป",
    "แนบภาพ",
    "รูปภาพที่",
    "ภาพที่",
    "ตรวจสอบรูป",
    "ตรวจสอบภาพ",
    "มองเห็นรูป",
    "มองเห็นภาพ",
    "ไม่สามารถมองเห็น",
    "ไม่เห็นรายละเอียด",
    "รูปที่ท่าน",
    "ภาพที่ท่าน",
    "สร้างภาพให้แล้ว",
    "สร้างรูปให้แล้ว",
    "แก้ภาพให้แล้ว",
    "generated image",
    "created an image",
  ].some((keyword) => text.includes(keyword));
}

function makeAppsScriptTextOnly(value: string) {
  return value
    .replace(/สร้าง\s*ภาพ|สร้าง\s*รูป|เจน\s*ภาพ|เจน\s*รูป|วาด\s*ภาพ|วาด\s*รูป|แก้\s*ภาพ|แก้\s*รูป/gi, "ทำงานข้อความ")
    .replace(/generate image|image generation|create image|make image|edit image|edit photo|draw/gi, "text task")
    .replace(/รูปภาพ|รูป|ภาพ/g, "สื่อ")
    .replace(/แนบ/g, "ส่งประกอบ")
    .replace(/สแกน/g, "ตรวจ")
    .replace(/วิเคราะห์การ์ด/g, "ตรวจข้อมูลการ์ด");
}

function buildLocalKnowledgeReply(message: string, knowledgeContext: string) {
  const exhaustive = isExhaustiveKnowledgeQuestion(message);
  const queryTokens = buildKnowledgeQueryTerms(message);
  const source = knowledgeContext || BLAZE_CORE_KNOWLEDGE;
  const lines = source
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter((line) => line.length > 28 && !line.startsWith("ข้อมูลสดจาก"));

  const scored = lines
    .map((line, index) => {
      const haystack = normalizeSearchText(line);
      const score = queryTokens.reduce(
        (total, token) => total + (haystack.includes(token) ? 10 : 0),
        0
      );
      return { line, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = scored
    .filter((item) => item.score > 0)
    .slice(0, exhaustive ? 40 : 5)
    .map((item) => item.line);
  const fallback = scored.slice(0, exhaustive ? 20 : 5).map((item) => item.line);
  const facts = selected.length ? selected : fallback;

  return enforceBlazeStyle(
    [
      "ข้าสรุปจากฐานข้อมูล NEXORA ให้ก่อน",
      ...facts.map((fact) => fact.replace(/\s*\|\s*source:.*$/i, "")),
    ].join("\n")
  );
}

function trimListAnswerOutro(reply: string, message: string) {
  if (!isExhaustiveKnowledgeQuestion(message)) {
    return reply;
  }

  return sanitizeText(reply)
    .replace(/^\s*\*\s+/gm, "")
    .replace(/\s+\*\s+/g, "\n")
    .replace(/\s*การสะสมให้ครบชุดเหล่านี้[\s\S]*$/i, "")
    .replace(/\s*การสะสมการ์ดให้ครบชุดเหล่านี้[\s\S]*$/i, "")
    .replace(/\s*เซ็ตเหล่านี้ล้วน[\s\S]*$/i, "")
    .replace(/\s*แต่ละชุดมีจำนวน[\s\S]*$/i, "")
    .replace(/\s*นี่คือชุดการ์ดสะสมทั้งหมด[\s\S]*$/i, "")
    .replace(/\s*หากท่านต้องการรายละเอียด[\s\S]*$/i, "")
    .replace(/\s*หากต้องการรายละเอียด[\s\S]*$/i, "")
    .replace(/\s*ถ้าท่านต้องการรายละเอียด[\s\S]*$/i, "")
    .replace(/\s*สามารถสอบถาม.*$/i, "")
    .trim();
}

function isSalesLineQuestion(message: string) {
  const text = normalizeSearchText(message);
  return [
    "ซื้อ",
    "ขาย",
    "สั่งซื้อ",
    "สั่ง",
    "ราคา",
    "สินค้า",
    "ซอง",
    "กล่อง",
    "pack",
    "box",
    "จัดส่ง",
    "ค่าส่ง",
    "ตัวแทน",
    "dealer",
    "สมัครสมาชิก",
    "โปร",
    "โปรโมชั่น",
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));
}

function stripLineContactForNonSales(reply: string, message: string) {
  if (isSalesLineQuestion(message)) {
    return reply;
  }

  return sanitizeText(reply)
    .replace(/\s*(?:หาก|ถ้า)?ท่าน(?:ต้องการ|สนใจ)?(?:ข้อมูลเพิ่มเติม|รายละเอียดเพิ่มเติม)?[^.\n]*(?:Line|ไลน์)[^.\n]*(?:@Nexoracard|@nexoracard)?[^.\n]*$/gim, "")
    .replace(/\s*(?:ติดต่อ|ทัก|สอบถาม|แอด)\s*(?:Line|ไลน์)[^.\n]*(?:@Nexoracard|@nexoracard)?[^.\n]*$/gim, "")
    .replace(/\s*Line Official\s*@Nexoracard[^.\n]*$/gim, "")
    .replace(/\s*Line\s*@Nexoracard[^.\n]*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatBlazeReplyLayout(reply: string) {
  const text = sanitizeText(reply)
    .replace(/^\s*\*\s+/gm, "- ")
    .replace(/\s+\|\s+/g, "\n")
    .replace(/\s+(?=(?:ข้อมูลการ์ด|ค่าสเตตัส|รางวัล\/ชุดสะสม|สกิล\/วิธีใช้|หมายเหตุ):)/g, "\n\n")
    .replace(/\s+(?=(?:ชื่อ|ประเภท|ธาตุ|ระดับ|ATK|SUP|สกิล|ความสามารถ|รางวัล|เงื่อนไขแลกรับ|ชุดสะสมที่เกี่ยวข้อง|อยู่ในชุดสะสม):)/g, "\n")
    .replace(/\s+(?=No\.\d{1,3}\b)/g, "\n")
    .replace(/\s+(?=Set\s+\d+\b)/gi, "\n")
    .replace(/\s+(?=\d+\.\s+)/g, "\n");

  const lines = text
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean);

  if (!lines.length) return "";

  const formatted: string[] = [];
  lines.forEach((line, index) => {
    const previous = formatted[formatted.length - 1] || "";
    const startsMajorSection =
      /^(?:ข้อมูลการ์ด|ค่าสเตตัส|รางวัล\/ชุดสะสม|สกิล\/วิธีใช้|หมายเหตุ):/.test(line);
    const startsList = /^(?:-|\d+\.)\s+/.test(line) || /^Set\s+\d+\b/i.test(line);

    if (
      index > 0 &&
      (startsMajorSection ||
        (!startsList && previous.length > 120) ||
        (/^(?:-|\d+\.)\s+/.test(line) && !/^(?:-|\d+\.)\s+/.test(previous)))
    ) {
      formatted.push("");
    }

    formatted.push(line);
  });

  return formatted
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function polishBlazeReply(reply: string, message: string) {
  return formatBlazeReplyLayout(
    stripLineContactForNonSales(trimListAnswerOutro(reply, message), message)
  );
}

function buildBlazeSafeFallbackReply(message: string, knowledgeContext = "") {
  try {
    const localReply = sanitizeText(buildLocalKnowledgeReply(message, knowledgeContext));

    if (localReply) {
      return polishBlazeReply(localReply, message);
    }
  } catch (fallbackError) {
    console.warn("BLAZE local fallback skipped:", fallbackError);
  }

  return enforceBlazeStyle(
    "ข้ารับคำถามแล้ว แต่ระบบเชื่อมต่อสมองหลักสะดุดชั่วคราว ลองถามใหม่อีกครั้งได้เลย"
  );
}

function buildScriptBridgeMessage({
  message,
  history,
  retry,
  knowledgeContext,
}: {
  message: string;
  history: BlazeHistoryItem[];
  retry: boolean;
  knowledgeContext: string;
}) {
  const recent = history
    .slice(-8)
    .map((item) => `${item.role === "model" ? "ท่านเบลซ" : "ผู้ใช้"}: ${item.text}`)
    .join("\n");

  const prompt = [
    "คำสั่งระบบสำคัญมาก:",
    "คำขอนี้เป็นแชทข้อความล้วนในแอพ NEXORA",
    "นี่คือโหมด chat เท่านั้น ไม่มีสิ่งส่งประกอบ ไม่มีไฟล์ และไม่มีการมองเห็นใดๆ",
    "ห้ามกล่าวถึงสิ่งส่งประกอบ ไฟล์ หรือการมองเห็นใดๆ ให้ตอบจากข้อความจริงเท่านั้น",
    "ให้ตอบเฉพาะคำถามข้อความจริงของผู้ใช้เท่านั้น",
    retry
      ? "คำตอบก่อนหน้าผิดเพราะกล่าวถึงสิ่งที่ผู้ใช้ไม่ได้ส่ง รอบนี้ต้องตอบใหม่จากข้อความจริงเท่านั้น"
      : "",
    BLAZE_RESPONSE_POLICY,
    BLAZE_CARD_REWARD_INDEX,
    "",
    knowledgeContext || BLAZE_CORE_KNOWLEDGE,
    "",
    recent ? `บริบทแชทล่าสุด:\n${recent}` : "",
    "",
    `คำถามข้อความจริงของผู้ใช้: ${message}`,
  ]
    .filter(Boolean)
    .join("\n");

  return makeAppsScriptTextOnly(prompt);
}

async function askAppsScriptBridge({
  message,
  history,
  clientId,
  knowledgeContext,
}: {
  message: string;
  history: BlazeHistoryItem[];
  clientId: string;
  knowledgeContext: string;
}): Promise<BlazeResult> {
  let lastReply = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetchWithTimeout(
      getScriptUrl(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "chat",
          fromCentralBrain: true,
          clientId,
          message: buildScriptBridgeMessage({
            message,
            history,
            retry: attempt > 0,
            knowledgeContext,
          }),
          history,
        }),
      },
      28000
    );

    const raw = await response.text();
    let data: { ok?: boolean; reply?: string } | null = null;

    try {
      data = JSON.parse(raw) as { ok?: boolean; reply?: string };
    } catch {
      throw new Error("Apps Script response is not JSON");
    }

    if (!response.ok || !data?.ok) {
      throw new Error(data?.reply || `Apps Script HTTP ${response.status}`);
    }

    const rawReply = sanitizeText(data.reply);
    if (!rawReply || rawReply === "[object Object]" || isErrorLikeReply(rawReply)) {
      lastReply = "";
      continue;
    }

    lastReply = enforceBlazeStyle(rawReply);
    if (lastReply && !isPlaceholderImageReply(lastReply, message)) {
      return {
        reply: lastReply,
        source: "apps-script",
      };
    }
  }

  return {
    reply:
      lastReply && !isPlaceholderImageReply(lastReply, "")
        ? lastReply
        : buildLocalKnowledgeReply(message, knowledgeContext),
    source: "apps-script",
  };
}

export async function POST(req: NextRequest) {
  let fallbackMessage = "";
  let fallbackKnowledgeContext = "";

  try {
    const session = await getServerSession(authOptions);
    const userId = sanitizeText(session?.user?.id);

    const body = await req.json().catch(() => ({}));
    const publicEmbed = body?.publicEmbed === true;

    if (!userId && !publicEmbed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const imagePayload = normalizeImagePayload(
      body?.imagePayload || body?.image || body?.attachment
    );
    const message = sanitizeText(body?.message).slice(0, MAX_MESSAGE_LENGTH);
    fallbackMessage = message;
    const history = normalizeHistory(body?.history);
    const clientId = sanitizeText(body?.clientId) || userId || "nexora-embed";
    const userName =
      sanitizeText(session?.user?.name) ||
      (publicEmbed ? "NEXORA Embed User" : "NEXORA User");

    if (!message && !imagePayload) {
      return NextResponse.json(
        { error: "กรุณาพิมพ์ข้อความก่อน" },
        { status: 400 }
      );
    }

    const effectiveMessage =
      message ||
      "ช่วยสแกนรูปการ์ดนี้ อ่านเลขการ์ด ชื่อการ์ด สกิล ค่า ATK ค่า SUP ระดับ ธาตุ และข้อความทั้งหมดที่เห็น";

    if (imagePayload) {
      const knowledgeContext = await buildKnowledgeContext(effectiveMessage, history);
      fallbackKnowledgeContext = knowledgeContext;

      const result = await askNativeGemini({
        message: effectiveMessage,
        history,
        userName,
        knowledgeContext,
        imagePayload,
      });

      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(
            result?.reply || buildImageUnavailableReply(),
            effectiveMessage
          ),
          source: result?.source || "gemini",
          native: Boolean(result),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const directNexoraCardFestReply = buildDirectNexoraCardFestReply(effectiveMessage);
    if (directNexoraCardFestReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directNexoraCardFestReply, effectiveMessage),
          source: "canonical",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const directBlazeIdentityReply = buildDirectBlazeIdentityReply(effectiveMessage);
    if (directBlazeIdentityReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directBlazeIdentityReply, effectiveMessage),
          source: "canonical",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const directNexPointRewardCouponReply =
      buildDirectNexPointRewardCouponReply(effectiveMessage);
    if (directNexPointRewardCouponReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directNexPointRewardCouponReply, effectiveMessage),
          source: "canonical",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const directPointRedemptionReply = buildDirectPointRedemptionReply(effectiveMessage);
    if (directPointRedemptionReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directPointRedemptionReply, effectiveMessage),
          source: "canonical",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const directCollectionReply = buildDirectCollectionReply(effectiveMessage);
    if (directCollectionReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directCollectionReply, effectiveMessage),
          source: "canonical",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const directCardCollectionReply = buildDirectCardCollectionReply(effectiveMessage);
    if (directCardCollectionReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directCardCollectionReply, effectiveMessage),
          source: "canonical",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const directElementCardCountReply =
      await buildDirectElementCardCountReply(effectiveMessage);
    if (directElementCardCountReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directElementCardCountReply, effectiveMessage),
          source: "card-db",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const directCardTypeCountReply =
      await buildDirectCardTypeCountReply(effectiveMessage);
    if (directCardTypeCountReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directCardTypeCountReply, effectiveMessage),
          source: "card-db",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const directDisableStatUseReply =
      await buildDirectDisableStatUseReply(effectiveMessage);
    if (directDisableStatUseReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directDisableStatUseReply, effectiveMessage),
          source: "card-db",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const directCardStatExtremeReply =
      await buildDirectCardStatExtremeReply(effectiveMessage);
    if (directCardStatExtremeReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directCardStatExtremeReply, effectiveMessage),
          source: "card-db",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const directAtkSupSwapReply =
      await buildDirectAtkSupSwapReply(effectiveMessage);
    if (directAtkSupSwapReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directAtkSupSwapReply, effectiveMessage),
          source: "card-db",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const directCardGameplayReply =
      await buildDirectCardGameplayReply(effectiveMessage);
    if (directCardGameplayReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directCardGameplayReply, effectiveMessage),
          source: "card-db",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const directCardSkillSearchReply =
      await buildDirectCardSkillSearchReply(effectiveMessage);
    if (directCardSkillSearchReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directCardSkillSearchReply, effectiveMessage),
          source: "card-db",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const directCardReply = await buildDirectCardDbReply(
      effectiveMessage,
      history,
      userName
    );
    if (directCardReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directCardReply, effectiveMessage),
          source: "card-db",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const knowledgeContext = await buildKnowledgeContext(effectiveMessage, history);
    fallbackKnowledgeContext = knowledgeContext;
    let result: BlazeResult | null = null;

    try {
      result = await askNativeGemini({
        message: effectiveMessage,
        history,
        userName,
        knowledgeContext,
      });
    } catch (nativeError) {
      console.warn("BLAZE AI native Gemini fallback:", nativeError);
    }

    result =
      result ||
      (await askAppsScriptBridge({
        message: effectiveMessage,
        history,
        clientId,
        knowledgeContext,
      }));

    const rawReply = sanitizeText(result.reply);
    const polishedReply = !isErrorLikeReply(rawReply)
      ? sanitizeText(polishBlazeReply(rawReply, effectiveMessage))
      : "";
    const finalReply =
      polishedReply ||
      buildBlazeSafeFallbackReply(effectiveMessage, knowledgeContext);

    return NextResponse.json(
      {
        ok: true,
        reply: finalReply,
        source: result.source,
        native: result.source === "gemini" || result.source === "card-db",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("BLAZE AI ERROR:", error);

    if (fallbackMessage) {
      return NextResponse.json(
        {
          ok: true,
          reply: buildBlazeSafeFallbackReply(
            fallbackMessage,
            fallbackKnowledgeContext
          ),
          source: "apps-script",
          native: false,
          fallback: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const message =
      error instanceof Error && error.message
        ? error.message
        : "Blaze AI failed";

    return NextResponse.json(
      {
        ok: false,
        error:
          message === "The operation was aborted"
            ? "ท่านเบลซใช้เวลาตอบนานเกินไป ลองส่งใหม่อีกครั้ง"
            : message,
      },
      { status: 500 }
    );
  }
}
