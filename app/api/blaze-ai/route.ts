import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 30;

const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_MESSAGE_LENGTH = 5000;
const MAX_HISTORY_ITEMS = 10;
const DEFAULT_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzPxJE0QCtFuv-4mCG91q1iBcxUZx_UJKkeAay2BEPYp0PFpM-EwAB4oIPH3QYYr8xR/exec";
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

type BlazeHistoryItem = {
  role: "user" | "model";
  text: string;
};

type GeminiPart = {
  text?: string;
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

type CardDbRow = {
  cardNo: string;
  cardNoNormalized: string;
  cardName: string;
  reward: string;
  value: string;
  imageUrl: string;
  searchText: string;
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
    keywords: ["การ์ดหายาก", "jackpot", "รางวัลการ์ด", "ซิลเวอร์", "แลกการ์ด"],
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
const siteKnowledgeCache = new Map<string, SiteCacheEntry>();

const BLAZE_RESPONSE_POLICY = [
  "Blaze answer policy:",
  "- Answer the exact user question first. Do not add sales closing lines, examples, or unrelated suggestions unless the user asks.",
  "- If the user asks for a list, all options, every matching item, 'what are they', 'which sets', rewards, or conditions, enumerate every matching record found in the provided DATA/context. Never give only examples or a partial list when the data contains more matches.",
  "- For set/collection overview questions, answer only the count and the set names. Do not list sample cards inside each set unless the user specifically asks for cards or details.",
  "- For list/count questions, do not add motivational outros, marketing copy, or closing suggestions after the list.",
  "- For reward-filter questions such as 100,000, 1 แสน, PlayStation, Gold One, or any reward value, include every set/collection/product row that matches that reward.",
  "- The canonical collection index is the highest-priority source for collection set rewards, set counts, and card numbers inside sets. Use it before live site snippets.",
  "- If the user asks which collection sets a card belongs to, answer from the canonical card-to-collection membership derived from the collection index.",
  "- Mention Line Official @Nexoracard only for purchase, sales, product order, dealer, shipping, or product price questions. Never mention Line for lore, rules, rewards, collection sets, card facts, or general knowledge questions.",
  "- If the provided DATA/context is incomplete or ambiguous, say that the answer is based on the records currently found, then list all found records without inventing missing ones.",
  "- Prefer complete factual answers over short marketing summaries. Use as much length as needed to be complete.",
].join("\n");

const COLLECTION_SOURCE_URL = "https://www.nexoracardgame.com/card-collections";
const POINT_REDEMPTION_LOCATION_URL = "https://maps.app.goo.gl/oUfs7y5LtNaBTSzm7";

const COLLECTION_SETS: CollectionSetRecord[] = [
  {
    id: 1,
    name: "The Five Concordants",
    aliases: ["ชุดการ์ดสะสมที่ 1", "set 1", "เซ็ต 1", "ชุด 1"],
    reward: "1,500,000 ซิลเวอร์",
    rewardAliases: ["1500000", "1,500,000", "หนึ่งล้านห้าแสน"],
    level: "เทพปกรณัม (Mythic)",
    rarity: "5 ดาว",
    cardCount: 15,
    cards: [
      "การ์ดเพชร: 006, 007, 008, 009, 010",
      "การ์ดทอง: 053, 054, 085, 090, 091, 097, 132, 170, 208, 209",
    ],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
  {
    id: 2,
    name: "ชุดการ์ดสะสมที่ 2",
    aliases: ["set 2", "เซ็ต 2", "ชุด 2"],
    reward: "1,000,000 ซิลเวอร์",
    rewardAliases: ["1000000", "1,000,000", "หนึ่งล้าน"],
    level: "เทพปกรณัม (Mythic)",
    rarity: "5 ดาว",
    cardCount: 5,
    cards: ["การ์ดเพชร: 006, 007, 008, 009, 010"],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
  {
    id: 3,
    name: "ชุดการ์ดสะสมที่ 3",
    aliases: ["set 3", "เซ็ต 3", "ชุด 3"],
    reward: "900,000 ซิลเวอร์",
    rewardAliases: ["900000", "900,000", "เก้าแสน"],
    level: "ตำนาน (Legendary)",
    rarity: "4 ดาว",
    cardCount: 224,
    cards: [
      "การ์ดทอง: 091, 132, 170, 174, 209",
      "การ์ดเงิน: 031, 032, 033, 034, 035, 036, 037, 038, 039, 040, 042, 043, 044, 045, 046, 047, 048, 049, 050, 058, 070, 071, 072, 073, 074, 075, 076, 077, 078, 079, 081, 082, 083, 086, 087, 088, 089, 092, 093, 098, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 120, 121, 122, 123, 124, 125, 127, 128, 134, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 161, 162, 163, 164, 165, 166, 167, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 206, 215",
      "การ์ดธรรมดา: 021, 022, 023, 024, 025, 026, 027, 028, 029, 030, 060, 061, 062, 063, 064, 065, 066, 067, 068, 069, 099, 100, 101, 102, 103, 104, 105, 106, 107, 108, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290, 291, 292, 293",
    ],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
  {
    id: 4,
    name: "ชุดการ์ดสะสมที่ 4",
    aliases: ["set 4", "เซ็ต 4", "ชุด 4"],
    reward: "400,000 ซิลเวอร์",
    rewardAliases: ["400000", "400,000", "สี่แสน"],
    level: "ตำนาน (Legendary)",
    rarity: "4 ดาว",
    cardCount: 9,
    cards: ["การ์ดทอง: 053, 054, 070, 085, 090, 097, 132, 208, 209"],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
  {
    id: 5,
    name: "ชุดการ์ดสะสมที่ 5",
    aliases: ["set 5", "เซ็ต 5", "ชุด 5"],
    reward: "200,000 ซิลเวอร์",
    rewardAliases: ["200000", "200,000", "สองแสน"],
    level: "ตำนาน (Legendary)",
    rarity: "4 ดาว",
    cardCount: 15,
    cards: [
      "การ์ดถัง: 011, 012, 013, 014, 015, 016, 017, 018, 019, 020",
      "การ์ดทอง: 001, 002, 003, 004, 005",
    ],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
  {
    id: 6,
    name: "ชุดการ์ดสะสมที่ 6",
    aliases: ["set 6", "เซ็ต 6", "ชุด 6"],
    reward: "100,000 ซิลเวอร์",
    rewardAliases: ["100000", "100,000", "1 แสน", "หนึ่งแสน", "แสน"],
    level: "ตำนาน (Legendary)",
    rarity: "4 ดาว",
    cardCount: 10,
    cards: ["การ์ดถัง: 011, 012, 013, 014, 015, 016, 017, 018, 019, 020"],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
  {
    id: 7,
    name: "ชุดการ์ดสะสมที่ 7",
    aliases: ["set 7", "เซ็ต 7", "ชุด 7"],
    reward: "50,000 ซิลเวอร์",
    rewardAliases: ["50000", "50,000", "ห้าหมื่น"],
    level: "ตำนาน (Legendary)",
    rarity: "4 ดาว",
    cardCount: 5,
    cards: ["การ์ดทอง: 001, 002, 003, 004, 005"],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
  {
    id: 8,
    name: "ชุดการ์ดสะสมที่ 8",
    aliases: ["set 8", "เซ็ต 8", "ชุด 8"],
    reward: "100,000 ซิลเวอร์",
    rewardAliases: ["100000", "100,000", "1 แสน", "หนึ่งแสน", "แสน"],
    level: "ตำนาน (Legendary)",
    rarity: "4 ดาว",
    cardCount: 20,
    cards: [
      "การ์ดทอง: 041, 052, 056, 057, 059, 119, 129, 133, 136, 168, 169, 171, 172, 173, 174, 176, 207, 211, 212, 213",
    ],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
  {
    id: 9,
    name: "ชุดการ์ดสะสมที่ 9",
    aliases: ["set 9", "เซ็ต 9", "ชุด 9"],
    reward: "100,000 ซิลเวอร์",
    rewardAliases: ["100000", "100,000", "1 แสน", "หนึ่งแสน", "แสน"],
    level: "ตำนาน (Legendary)",
    rarity: "4 ดาว",
    cardCount: 30,
    cards: [
      "การ์ดทอง: 051, 055, 091, 130, 131, 135, 137, 205, 210, 214",
      "การ์ดเงิน: 042, 043, 044, 045, 046, 047, 048, 049, 050, 058, 075, 120, 121, 122, 123, 124, 125, 127, 128, 215",
    ],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
  {
    id: 10,
    name: "ชุดการ์ดสะสมที่ 10",
    aliases: ["set 10", "เซ็ต 10", "ชุด 10"],
    reward: "100,000 ซิลเวอร์",
    rewardAliases: ["100000", "100,000", "1 แสน", "หนึ่งแสน", "แสน"],
    level: "ตำนาน (Legendary)",
    rarity: "4 ดาว",
    cardCount: 30,
    cards: [
      "การ์ดทอง: 005, 080, 084, 094, 095, 096, 119, 126, 160, 172",
      "การ์ดเงิน: 081, 082, 083, 086, 087, 088, 089, 092, 093, 098",
      "การ์ดธรรมดา: 236, 237, 238, 239, 240, 258, 259, 260, 261, 262",
    ],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
  {
    id: 11,
    name: "ชุดการ์ดสะสมที่ 11",
    aliases: ["set 11", "เซ็ต 11", "ชุด 11"],
    reward: "70,000 ซิลเวอร์",
    rewardAliases: ["70000", "70,000", "เจ็ดหมื่น"],
    level: "ตำนาน (Legendary)",
    rarity: "2 ดาว",
    cardCount: 40,
    cards: [
      "การ์ดธรรมดา: 021, 022, 241, 242, 243, 244, 245, 246, 247, 263, 264, 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290, 291, 292, 293",
    ],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
  {
    id: 12,
    name: "ชุดการ์ดสะสมที่ 12",
    aliases: ["set 12", "เซ็ต 12", "ชุด 12"],
    reward: "NEXORA GOLD ONE",
    rewardAliases: ["nexora gold one", "gold one", "โกลด์วัน", "ทองวัน"],
    level: "ตำนาน (Legendary)",
    rarity: "2 ดาว",
    cardCount: 40,
    cards: [
      "การ์ดธรรมดา: 027, 028, 029, 030, 060, 061, 062, 063, 064, 065, 066, 067, 068, 069, 104, 105, 106, 107, 108, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 247",
    ],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
  {
    id: 13,
    name: "ชุดการ์ดสะสมที่ 13",
    aliases: ["set 13", "เซ็ต 13", "ชุด 13"],
    reward: "100,000 ซิลเวอร์",
    rewardAliases: ["100000", "100,000", "1 แสน", "หนึ่งแสน", "แสน"],
    level: "ตำนาน (Legendary)",
    rarity: "3 ดาว",
    cardCount: 10,
    cards: ["การ์ดเงิน: 070, 071, 072, 073, 074, 075, 076, 077, 078, 079"],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
  {
    id: 14,
    name: "ชุดการ์ดสะสมที่ 14",
    aliases: ["set 14", "เซ็ต 14", "ชุด 14"],
    reward: "50,000 ซิลเวอร์",
    rewardAliases: ["50000", "50,000", "ห้าหมื่น"],
    level: "ตำนาน (Legendary)",
    rarity: "3 ดาว",
    cardCount: 50,
    cards: [
      "การ์ดทอง: 097",
      "การ์ดเงิน: 134, 158, 159, 161, 162, 163, 164, 165, 166, 167, 175, 197, 198, 199, 200, 201, 202, 203, 204, 206",
      "การ์ดธรรมดา: 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 248, 249, 250, 251, 252, 253, 255, 256, 257",
    ],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
  {
    id: 15,
    name: "ชุดการ์ดสะสมที่ 15",
    aliases: ["set 15", "เซ็ต 15", "ชุด 15"],
    reward: "PlayStation 1 เครื่อง",
    rewardAliases: ["playstation", "playstation 1", "ps", "ps5", "เพลย์", "เครื่องเกม"],
    level: "ตำนาน (Legendary)",
    rarity: "2 ดาว",
    cardCount: 20,
    cards: [
      "การ์ดธรรมดา: 023, 024, 025, 060, 069, 099, 100, 101, 102, 103, 143, 144, 145, 146, 147, 182, 183, 184, 185, 186",
    ],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
  {
    id: 16,
    name: "ชุดการ์ดสะสมที่ 16",
    aliases: ["set 16", "เซ็ต 16", "ชุด 16"],
    reward: "15,000 ซิลเวอร์",
    rewardAliases: ["15000", "15,000", "หนึ่งหมื่นห้าพัน"],
    level: "ตำนาน (Legendary)",
    rarity: "2 ดาว",
    cardCount: 20,
    cards: [
      "การ์ดเงิน: 045, 089, 163, 164, 215",
      "การ์ดธรรมดา: 068, 069, 099, 179, 226, 231, 232, 236, 238, 248, 256, 257, 270, 279, 287",
    ],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
  {
    id: 17,
    name: "ชุดการ์ดสะสมที่ 17",
    aliases: ["set 17", "เซ็ต 17", "ชุด 17"],
    reward: "15,000 ซิลเวอร์",
    rewardAliases: ["15000", "15,000", "หนึ่งหมื่นห้าพัน"],
    level: "ตำนาน (Legendary)",
    rarity: "2 ดาว",
    cardCount: 20,
    cards: [
      "การ์ดธรรมดา: 024, 061, 099, 101, 102, 103, 144, 186, 218, 219, 222, 236, 240, 248, 249, 250, 268, 269, 277, 288",
    ],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
  {
    id: 18,
    name: "ชุดการ์ดสะสมที่ 18",
    aliases: ["set 18", "เซ็ต 18", "ชุด 18"],
    reward: "5,000 ซิลเวอร์",
    rewardAliases: ["5000", "5,000", "ห้าพัน"],
    level: "ตำนาน (Legendary)",
    rarity: "2 ดาว",
    cardCount: 10,
    cards: [
      "การ์ดทอง: 095",
      "การ์ดเงิน: 098",
      "การ์ดธรรมดา: 060, 061, 062, 063, 064, 285, 289, 290",
    ],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
  {
    id: 19,
    name: "ชุดการ์ดสะสมที่ 19",
    aliases: ["set 19", "เซ็ต 19", "ชุด 19"],
    reward: "5,000 ซิลเวอร์",
    rewardAliases: ["5000", "5,000", "ห้าพัน"],
    level: "ตำนาน (Legendary)",
    rarity: "2 ดาว",
    cardCount: 10,
    cards: [
      "การ์ดเงิน: 044, 045, 046, 047",
      "การ์ดธรรมดา: 178, 179, 241, 242, 255, 256",
    ],
    sourceUrl: COLLECTION_SOURCE_URL,
  },
];

const BLAZE_COLLECTION_REWARD_INDEX = buildCollectionCanonicalIndex();

function sanitizeText(value: unknown) {
  return String(value || "").trim();
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

function enforceBlazeStyle(text: string) {
  let value = sanitizeText(text)
    .replace(/ค่ะ|คะ|นะคะ|เจ้าค่ะ|เพคะ|พะยะค่ะ|พ่ะย่ะค่ะ|ดิฉัน|หนู/g, "")
    .replace(/\bฉัน\b/g, "ข้า")
    .replace(/\bผม\b/g, "ข้า")
    .replace(/\bกระผม\b/g, "ข้า")
    .replace(/\*\*|```|###|##|#/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (value && !value.includes("ข้า") && !value.includes("ท่านเบลซ")) {
    value = `ข้า ${value}`;
  }

  return value || "ข้าพร้อมแล้ว ถามท่านเบลซมาได้เลย";
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    "- Canonical rule: ถ้าถามว่าเซ็ตใดตรงกับรางวัลใด ให้ใช้ดัชนีนี้ก่อน DATA/web snippet เสมอ และตอบครบทุกเซ็ตที่ match",
    "- Canonical rule: ถ้าถามภาพรวมชุดสะสม ให้ตอบจำนวนเซ็ตและชื่อ/เลขเซ็ตก่อน ไม่ต้องยกตัวอย่างการ์ด เว้นแต่ผู้ใช้ถามรายละเอียดหรือถามว่าในเซ็ตมีการ์ดอะไร",
  ].join("\n");
}

function formatCollectionSetSummary(set: CollectionSetRecord) {
  const alias = set.name === `ชุดการ์ดสะสมที่ ${set.id}` ? "" : ` / ${set.name}`;
  return `Set ${set.id} / ชุดการ์ดสะสมที่ ${set.id}${alias}: ${set.level}, ${set.rarity}, ${set.cardCount} ใบ, reward ${set.reward}`;
}

function formatCollectionSetDetail(set: CollectionSetRecord) {
  return [
    formatCollectionSetSummary(set),
    `รายการการ์ด: ${set.cards.join(" | ")}`,
    `แหล่งข้อมูล: ${set.sourceUrl}`,
  ].join("\n");
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
    "70000",
    "50000",
    "15000",
    "5000",
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
  if (/ห้าพัน|5\s*,?\s*000/.test(raw)) return "5000";
  if (text.includes("gold one") || text.includes("โกลด์วัน")) return "gold one";
  if (text.includes("playstation") || text.includes("เพลย์")) return "playstation";

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
  const wantsCards = wantsCollectionCardList(message);

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
        ...COLLECTION_SETS.map((set) => formatCollectionSetSummary(set)),
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
    "nex point",
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
      "การแลกแต้ม NEX / COIN เข้าระบบ NEX POINT ต้องนำการ์ดจริงให้บริษัทตรวจสอบก่อนเพิ่มแต้มเข้าบัญชี",
      "ขั้นตอนหลักมีดังนี้",
      "1. ลูกค้าสามารถนำการ์ดมาที่หน้าร้านด้วยตนเองได้ วิธีนี้เป็นทางเลือกที่แนะนำที่สุด เพราะปลอดภัยต่อสภาพการ์ดมากที่สุด",
      "2. หากไม่สะดวกมาหน้าร้าน ลูกค้าสามารถส่งการ์ดมาทางขนส่งได้ แต่ลูกค้าต้องรับความเสี่ยงเรื่องสภาพการ์ดระหว่างขนส่งเอง",
      "3. เมื่อบริษัทได้รับพัสดุแล้ว บริษัทจะถ่ายวิดีโอขณะเปิดกล่องพัสดุ และตรวจสภาพการ์ดอย่างละเอียดให้ลูกค้าดูเพื่อใช้ยืนยันร่วมกัน",
      "4. หากการ์ดเป็นของแท้และสภาพสมบูรณ์ประมาณ 90-100% บริษัทจะเพิ่มแต้ม NEX / COIN เข้าบัญชีของลูกค้าในแอพ NEX POINT ทันที",
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
    "nex point",
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
      "ในแอพ NEX POINT จะมีรางวัลให้แลกหลายระดับ ตั้งแต่รางวัลเล็ก รางวัลลิมิเต็ดจำนวนจำกัดจาก NEXORA แบบใครแลกก่อนได้ก่อนจนกว่าคูปองจะหมด ไปจนถึงรางวัลใหญ่",
      "ขั้นตอนการแลกรางวัลจริงมีดังนี้",
      "1. ลูกค้ากดแลกรางวัลในแอพ NEX POINT ให้สำเร็จก่อน ระบบจะออกคูปองสำหรับรางวัลนั้นให้ในแอพ",
      "2. ลูกค้านำคูปองที่กดแลกได้มาแสดงที่หน้าร้าน",
      "3. พนักงานตรวจสอบคูปอง แล้วสแกนหรือยิง QR Code บนคูปองเพื่อยืนยันการใช้งาน",
      "4. เมื่อยืนยันคูปองสำเร็จ บริษัทจะดำเนินการหัก ณ ที่จ่ายสำหรับการแลกรางวัลตามที่กฎหมายกำหนด",
      "5. หลังจากดำเนินการครบถ้วน พนักงานจะมอบรางวัลให้ลูกค้า ถือว่าการแลกรางวัลเสร็จสมบูรณ์",
      "หมายเหตุ: รางวัลบางรายการมีจำนวนจำกัด หากคูปองหมดแล้วจะไม่สามารถแลกรายการนั้นได้ ต้องยึดสถานะคูปองและสต็อกในแอพเป็นหลัก",
    ].join("\n")
  );
}

function extractCardNumbersFromCollectionSet(set: CollectionSetRecord) {
  return set.cards.flatMap((line) =>
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
      const imageUrl = sanitizeText(row[imageIndex]);
      const searchText = normalizeSearchText(
        `${cardNo} ${cardNoNormalized} ${cardName} ${reward} ${value}`
      );

      return {
        cardNo,
        cardNoNormalized,
        cardName,
        reward,
        value,
        imageUrl,
        searchText,
      };
    })
    .filter(Boolean) as CardDbRow[];
}

async function loadCardDbRows() {
  const now = Date.now();

  if (cardDbCache && cardDbCache.expiresAt > now) {
    return cardDbCache.rows;
  }

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

    const rows = csvRowsToCardDbRows(csv);
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
    return cardDbCache?.rows || [];
  }
}

function isCardDbQuestion(message: string) {
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
  ].some((keyword) => text.includes(normalizeSearchText(keyword)));
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

function wantsCardCollection(message: string) {
  return hasCollectionIntent(message);
}

function formatCardDbRow(row: CardDbRow, message: string) {
  const wantsName = wantsCardName(message);
  const wantsReward = wantsCardReward(message);
  const wantsValue = wantsCardValue(message);
  const wantsCollection = wantsCardCollection(message);
  const memberships = formatCardCollectionMemberships(row.cardNoNormalized);

  if (wantsCollection && !wantsReward && !wantsValue) {
    return [
      `การ์ด ${row.cardNo} ${row.cardName}`,
      memberships
        ? `อยู่ในชุดสะสม: ${memberships}`
        : "ยังไม่พบชุดสะสมที่มีการ์ดใบนี้ในดัชนี canonical",
    ].join("\n");
  }

  if (wantsName && !wantsReward && !wantsValue) {
    return `การ์ด ${row.cardNo} ชื่อ ${row.cardName}`;
  }

  if (wantsReward && !wantsName && !wantsValue) {
    return [
      `การ์ด ${row.cardNo} ${row.cardName}`,
      `รางวัล/เงื่อนไขแลกรับ: ${row.reward || "-"}`,
      memberships ? `ชุดสะสมที่เกี่ยวข้อง: ${memberships}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (wantsValue && !wantsName && !wantsReward) {
    return [
      `การ์ด ${row.cardNo} ${row.cardName}`,
      `ระดับ: ${row.value || "-"}`,
      memberships ? `ชุดสะสมที่เกี่ยวข้อง: ${memberships}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `การ์ด ${row.cardNo}`,
    `ชื่อ: ${row.cardName}`,
    `ระดับ: ${row.value || "-"}`,
    `รางวัล/เงื่อนไขแลกรับ: ${row.reward || "-"}`,
    memberships ? `ชุดสะสมที่เกี่ยวข้อง: ${memberships}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function buildDirectCardDbReply(
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

  const { exact, matches, cardNo } = findCardDbMatches(rows, message, history);

  if (exact) {
    return enforceBlazeStyle(formatCardDbRow(exact, message));
  }

  if (cardNo) {
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
  const lines = selectedRows.map((row) =>
    [
      `- ${row.cardNo} | ${row.cardName}`,
      `ระดับ: ${row.value || "-"}`,
      `รางวัล/เงื่อนไขแลกรับ: ${row.reward || "-"}`,
    ].join(" | ")
  );
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

  if (/แลกแต้ม|เพิ่มแต้ม|nex point|coin|ส่งการ์ด|หน้าร้าน|พัสดุ|ขนส่ง|สภาพการ์ด/.test(text)) {
    [
      "แลกแต้ม",
      "NEX POINT",
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
      "NEX POINT",
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
  "- รางวัลในแอพ NEX POINT: มีรางวัลให้แลกหลากหลาย ตั้งแต่รางวัลเล็ก รางวัลลิมิเต็ดจำนวนจำกัดจาก NEXORA แบบใครแลกก่อนได้ก่อนจนกว่าคูปองหมด ไปจนถึงรางวัลใหญ่ วิธีแลกรางวัลจริงคือกดแลกในแอพให้ได้คูปองก่อน จากนั้นนำคูปองมาแสดงที่หน้าร้าน พนักงานจะสแกนหรือยิง QR Code บนคูปองเพื่อยืนยันการใช้งาน เมื่อยืนยันแล้วบริษัทจะดำเนินการหัก ณ ที่จ่ายสำหรับการแลกรางวัลตามกฎหมาย แล้วจึงมอบรางวัลให้ลูกค้าเป็นอันเสร็จสิ้น",
  `- ขั้นตอนการแลกแต้ม NEX / COIN เข้าระบบ NEX POINT: ลูกค้าต้องนำการ์ดจริงมาให้บริษัทตรวจสอบก่อนเพิ่มแต้ม สามารถนำการ์ดมาที่หน้าร้านเองหรือส่งมาทางขนส่งได้ แต่ถ้าส่งมาลูกค้าต้องรับความเสี่ยงเรื่องสภาพการ์ดจากขนส่งเอง บริษัทจะถ่ายวิดีโอขณะเปิดกล่องพัสดุและตรวจสภาพการ์ดอย่างละเอียดให้ลูกค้าดู หากการ์ดเป็นของแท้และสภาพสมบูรณ์ 90-100% บริษัทจะเพิ่มแต้มเข้าบัญชีในแอพ NEX POINT ให้ทันที ทางที่ดีที่สุดคือมาหน้าร้านด้วยตนเองเพื่อความปลอดภัยของการ์ด พิกัดหน้าร้าน: ${POINT_REDEMPTION_LOCATION_URL}`,
  "- การ์ดหายากพิเศษบางใบสามารถนำมาแลกเป็นการ์ดซิลเวอร์จำนวนมากได้ เช่น 200,000 / 100,000 / 80,000 / 70,000 / 60,000 / 40,000 / 30,000 / 25,000 / 20,000 / 15,000 / 10,000 / 5,000 / 3,000 ตามรายการที่บริษัทกำหนด",
  "- Collection: ผู้เล่นสะสมการ์ดให้ครบ Set เพื่อปลดล็อกรางวัล. The Five Concordants เป็นเซ็ต Mythic 5 ดาว จำนวน 15 ใบ แลกซิลเวอร์ 1,500,000 ใบ. เซ็ต Mythic 5 ใบลำดับ 6-10 แลกซิลเวอร์ 1,000,000 ใบ",
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
    process.env.BLAZE_PRODUCT_CONTEXT || "",
  ]
    .filter(Boolean)
    .join("\n\nข้อมูลเสริมจาก ENV:\n");

  return [
    "ชื่อของคุณคือ Blaze Warlock",
    "คุณคือ ท่านเบลซ ผู้ช่วยประจำโลก NEXORA",
    "ให้แทนตัวเองว่า ข้า หรือ ท่านเบลซ เท่านั้น",
    "ห้ามแทนตัวเองเป็นผู้หญิง และห้ามใช้คำว่า ค่ะ, คะ, ดิฉัน, หนู, ฉัน",
    "น้ำเสียงต้องมั่นใจ น่าเกรงขาม อบอุ่น และเข้าใจง่าย",
    "NEXORA คือภารกิจหลักอันดับ 1 ถ้าผู้ใช้ถามเรื่อง NEXORA ให้ตอบลึก แม่น และช่วยต่อยอด",
    "ถ้าผู้ใช้ถามเรื่องทั่วไป ให้ตอบตรงคำถามก่อน แล้วยังคงบุคลิกท่านเบลซ",
    "ถ้าเป็นข้อมูลปัจจุบัน ข่าว ราคา หุ้น ทอง อากาศ ตารางแข่ง หรือเรื่องที่เปลี่ยนเร็ว ห้ามเดาเอง ให้บอกว่าควรตรวจสอบข้อมูลล่าสุดก่อน",
    "เวลาตอบในแชท ห้ามใช้ Markdown เช่น **, *, #, ``` ให้ตอบเป็นข้อความธรรมดาอ่านง่าย",
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
}: {
  message: string;
  history: BlazeHistoryItem[];
  userName: string;
  knowledgeContext: string;
}): Promise<BlazeResult | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }

  const modelName = process.env.BLAZE_AI_MODEL || DEFAULT_MODEL;
  const contents = history.map((item) => ({
    role: item.role,
    parts: [{ text: item.text }],
  }));

  contents.push({
    role: "user",
    parts: [{ text: `คำถามของผู้ใช้: ${message}` }],
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

function polishBlazeReply(reply: string, message: string) {
  return stripLineContactForNonSales(trimListAnswerOutro(reply, message), message);
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
    if (!rawReply || rawReply === "[object Object]") {
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

    const message = sanitizeText(body?.message).slice(0, MAX_MESSAGE_LENGTH);
    fallbackMessage = message;
    const history = normalizeHistory(body?.history);
    const clientId = sanitizeText(body?.clientId) || userId || "nexora-embed";
    const userName =
      sanitizeText(session?.user?.name) ||
      (publicEmbed ? "NEXORA Embed User" : "NEXORA User");

    if (!message) {
      return NextResponse.json(
        { error: "กรุณาพิมพ์ข้อความก่อน" },
        { status: 400 }
      );
    }

    const directNexPointRewardCouponReply =
      buildDirectNexPointRewardCouponReply(message);
    if (directNexPointRewardCouponReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directNexPointRewardCouponReply, message),
          source: "canonical",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const directPointRedemptionReply = buildDirectPointRedemptionReply(message);
    if (directPointRedemptionReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directPointRedemptionReply, message),
          source: "canonical",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const directCollectionReply = buildDirectCollectionReply(message);
    if (directCollectionReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directCollectionReply, message),
          source: "canonical",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const directCardCollectionReply = buildDirectCardCollectionReply(message);
    if (directCardCollectionReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directCardCollectionReply, message),
          source: "canonical",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const directCardReply = await buildDirectCardDbReply(message, history);
    if (directCardReply) {
      return NextResponse.json(
        {
          ok: true,
          reply: polishBlazeReply(directCardReply, message),
          source: "card-db",
          native: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const knowledgeContext = await buildKnowledgeContext(message, history);
    fallbackKnowledgeContext = knowledgeContext;
    let result: BlazeResult | null = null;

    try {
      result = await askNativeGemini({
        message,
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
        message,
        history,
        clientId,
        knowledgeContext,
      }));

    const finalReply =
      sanitizeText(polishBlazeReply(result.reply, message)) ||
      buildBlazeSafeFallbackReply(message, knowledgeContext);

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
