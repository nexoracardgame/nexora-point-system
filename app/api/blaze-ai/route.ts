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
  "https://docs.google.com/spreadsheets/d/1Ux_JZKUbhJLPNa2lLZdaBljXH-17bff9AdFzwXBcaGg/export?format=csv&gid=0";
const KNOWLEDGE_CACHE_MS = 5 * 60 * 1000;
const SITE_CACHE_MS = 30 * 60 * 1000;
const MAX_SHEET_CONTEXT_CHARS = 18000;
const MAX_SITE_CONTEXT_CHARS = 6000;

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
  source: "gemini" | "apps-script";
};

type KnowledgeRow = {
  key: string;
  value: string;
  category: string;
  sourceUrl: string;
  priority: number;
  notes: string;
};

type KnowledgeCache = {
  expiresAt: number;
  rows: KnowledgeRow[];
  text: string;
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
const siteKnowledgeCache = new Map<string, SiteCacheEntry>();

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

function getDataSheetCsvUrl() {
  return (
    process.env.BLAZE_DATA_SHEET_CSV_URL ||
    process.env.NEXORA_DATA_SHEET_CSV_URL ||
    DEFAULT_DATA_SHEET_CSV_URL
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

function scoreKnowledgeRow(row: KnowledgeRow, message: string) {
  const query = normalizeSearchText(message);
  const haystack = normalizeSearchText(
    `${row.key} ${row.value} ${row.category} ${row.notes}`
  );
  const tokens = query.split(" ").filter((token) => token.length >= 2);
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

function formatKnowledgeRows(rows: KnowledgeRow[], message: string) {
  const sortedRows = [...rows]
    .map((row) => ({
      row,
      score: scoreKnowledgeRow(row, message),
    }))
    .sort((a, b) => b.score - a.score || a.row.priority - b.row.priority)
    .slice(0, 90)
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
    .slice(0, 3)
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

  const text = stripHtml(html).slice(0, 2200);
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

async function buildKnowledgeContext(message: string) {
  const [sheetContext, siteContext] = await Promise.all([
    loadSheetKnowledge(message),
    loadOfficialSiteKnowledge(message),
  ]);

  return [
    BLAZE_CORE_KNOWLEDGE,
    sheetContext,
    siteContext
      ? `ข้อมูลเสริมจากเว็บทางการ nexoracardgame.com แบบ cache ตามคำถาม:\n${siteContext}`
      : "",
    "กฎสำคัญ: ยึด DATA และเว็บทางการก่อนเดา หากข้อมูลขัดกันให้บอกว่าให้ตรวจสอบประกาศล่าสุดหรือ Line Official @Nexoracard",
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
  "- ช่องทางหลัก: Line Official @Nexoracard, โทร 080-995-9979, อีเมล contact@nexoracardgame.com, บริษัท เนคโชร่า 63 จำกัด",
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
  "- ถ้าถามซื้อ ให้ตอบข้อมูลสำคัญก่อน แล้วชวนติดต่อ Line Official @Nexoracard",
  "- ถ้าข้อมูลเป็นราคา ข่าว ตารางงาน รุ่นสินค้า หรือสิ่งที่เปลี่ยนได้ ให้บอกว่าควรตรวจสอบประกาศล่าสุดหรือทัก Line Official ก่อนยืนยัน",
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
          maxOutputTokens: 1600,
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
  const queryTokens = normalizeSearchText(message)
    .split(" ")
    .filter((token) => token.length >= 2);
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
    .slice(0, 5)
    .map((item) => item.line);
  const fallback = scored.slice(0, 5).map((item) => item.line);
  const facts = selected.length ? selected : fallback;

  return enforceBlazeStyle(
    [
      "ข้าสรุปจากฐานข้อมูล NEXORA ให้ก่อน",
      ...facts.map((fact) => fact.replace(/\s*\|\s*source:.*$/i, "")),
    ].join("\n")
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
  try {
    const session = await getServerSession(authOptions);
    const userId = sanitizeText(session?.user?.id);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const message = sanitizeText(body?.message).slice(0, MAX_MESSAGE_LENGTH);
    const history = normalizeHistory(body?.history);
    const clientId = sanitizeText(body?.clientId) || userId;
    const userName = sanitizeText(session?.user?.name) || "NEXORA User";

    if (!message) {
      return NextResponse.json(
        { error: "กรุณาพิมพ์ข้อความก่อน" },
        { status: 400 }
      );
    }

    const knowledgeContext = await buildKnowledgeContext(message);
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

    return NextResponse.json(
      {
        ok: true,
        reply: result.reply,
        source: result.source,
        native: result.source === "gemini",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("BLAZE AI ERROR:", error);
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
