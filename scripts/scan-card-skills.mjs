import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CARDS_DIR = path.join(ROOT, "public", "cards");
const OUT_FILE = path.join(CARDS_DIR, "card-skill-db.json");
const DEFAULT_MODEL = "gemini-2.5-flash";
const CARD_TOTAL = 293;

function pad3(value) {
  return String(value).padStart(3, "0");
}

function parseArgs(argv) {
  const args = {
    from: 1,
    to: CARD_TOTAL,
    only: [],
    limit: 0,
    force: false,
    init: false,
    delay: 450,
    model: process.env.BLAZE_CARD_OCR_MODEL || process.env.BLAZE_AI_MODEL || DEFAULT_MODEL,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--init") args.init = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--from" && next) args.from = Number(next);
    else if (arg === "--to" && next) args.to = Number(next);
    else if (arg === "--limit" && next) args.limit = Number(next);
    else if (arg === "--delay" && next) args.delay = Number(next);
    else if (arg === "--model" && next) args.model = String(next);
    else if (arg === "--only" && next) {
      args.only = String(next)
        .split(",")
        .map((item) => pad3(item.replace(/\D/g, "")))
        .filter((item) => /^\d{3}$/.test(item));
    }

    if (arg.startsWith("--") && next && !next.startsWith("--")) {
      index += 1;
    }
  }

  args.from = Math.max(1, Math.min(CARD_TOTAL, args.from || 1));
  args.to = Math.max(args.from, Math.min(CARD_TOTAL, args.to || CARD_TOTAL));
  args.limit = Math.max(0, args.limit || 0);
  args.delay = Math.max(0, args.delay || 0);

  return args;
}

function getApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GENERATIVE_LANGUAGE_API_KEY ||
    ""
  ).trim();
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findCardFile(cardNo) {
  for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
    const filePath = path.join(CARDS_DIR, `${cardNo}${ext}`);
    if (await pathExists(filePath)) {
      return filePath;
    }
  }

  return null;
}

function createBlankCard(cardNo) {
  return {
    cardNo,
    cardName: "",
    skill: "",
    atk: "",
    sup: "",
    element: "",
    rarity: "",
    type: "",
    rawText: "",
    confidence: "pending",
    reviewed: false,
    sourceImage: `/cards/${cardNo}.jpg`,
    scannedAt: "",
    notes: "",
  };
}

function normalizeCard(value, cardNo) {
  const record = value && typeof value === "object" ? value : {};

  return {
    ...createBlankCard(cardNo),
    ...record,
    cardNo,
    cardName: String(record.cardName || "").trim(),
    skill: String(record.skill || "").trim(),
    atk: String(record.atk || "").trim(),
    sup: String(record.sup || "").trim(),
    element: String(record.element || "").trim(),
    rarity: String(record.rarity || "").trim(),
    type: String(record.type || "").trim(),
    rawText: String(record.rawText || "").trim(),
    confidence: String(record.confidence || "pending").trim() || "pending",
    reviewed: Boolean(record.reviewed),
    sourceImage: String(record.sourceImage || `/cards/${cardNo}.jpg`).trim(),
    scannedAt: String(record.scannedAt || "").trim(),
    notes: String(record.notes || "").trim(),
  };
}

async function readDb() {
  let existingCards = [];

  try {
    const raw = await fs.readFile(OUT_FILE, "utf8");
    const parsed = JSON.parse(raw);
    existingCards = Array.isArray(parsed.cards) ? parsed.cards : [];
  } catch {}

  const byNo = new Map();
  for (const card of existingCards) {
    const cardNo = pad3(String(card?.cardNo || "").replace(/\D/g, ""));
    if (/^\d{3}$/.test(cardNo)) {
      byNo.set(cardNo, normalizeCard(card, cardNo));
    }
  }

  const cards = [];
  for (let i = 1; i <= CARD_TOTAL; i += 1) {
    const cardNo = pad3(i);
    cards.push(byNo.get(cardNo) || createBlankCard(cardNo));
  }

  return {
    version: 1,
    generatedAt: "",
    source: "public/cards OCR via Gemini Vision",
    total: CARD_TOTAL,
    cards,
  };
}

async function writeDb(db) {
  const nextDb = {
    ...db,
    generatedAt: new Date().toISOString(),
    total: db.cards.length,
  };
  const tempFile = `${OUT_FILE}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(nextDb, null, 2)}\n`, "utf8");
  await fs.rename(tempFile, OUT_FILE);
}

function buildGeminiUrl(model, apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function extractJson(text) {
  const cleaned = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("Gemini did not return JSON");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeOcrResult(cardNo, result) {
  const record = result && typeof result === "object" ? result : {};
  const confidence = String(record.confidence || "medium").toLowerCase();

  return normalizeCard(
    {
      cardName: record.cardName,
      skill: record.skill,
      atk: record.atk,
      sup: record.sup,
      element: record.element,
      rarity: record.rarity,
      type: record.type,
      rawText: record.rawText,
      confidence: ["high", "medium", "low"].includes(confidence) ? confidence : "medium",
      reviewed: false,
      sourceImage: `/cards/${cardNo}.jpg`,
      scannedAt: new Date().toISOString(),
      notes: record.notes,
    },
    cardNo
  );
}

async function scanCard({ apiKey, model, cardNo, filePath }) {
  const image = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

  const response = await fetch(buildGeminiUrl(model, apiKey), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "You are extracting exact data from a NEXORA trading card image.",
                `Card number expected: ${cardNo}.`,
                "Read only visible text and numbers. Do not invent missing text.",
                "Return JSON only with these keys:",
                "cardNo, cardName, skill, atk, sup, element, rarity, type, rawText, confidence, notes.",
                "Rules:",
                "- cardNo must be 3 digits if visible or expected.",
                "- atk and sup must be numeric strings only if visible, otherwise empty strings.",
                "- skill must be the full visible ability/skill text. Preserve Thai wording.",
                "- confidence must be high, medium, or low.",
                "- notes should mention unclear areas briefly.",
              ].join("\n"),
            },
            {
              inlineData: {
                mimeType,
                data: image.toString("base64"),
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        topP: 0.1,
        topK: 1,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    }),
  });

  const raw = await response.text();
  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Gemini returned invalid HTTP JSON for ${cardNo}`);
  }

  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Gemini HTTP ${response.status}`);
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("\n")
    .trim();
  const parsed = extractJson(text);

  return normalizeOcrResult(cardNo, parsed);
}

function shouldSkip(card, force) {
  if (force) {
    return false;
  }

  return Boolean(
    card &&
      card.confidence &&
      card.confidence !== "pending" &&
      (card.skill || card.atk || card.sup || card.rawText)
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = await readDb();

  if (args.init) {
    await writeDb(db);
    console.log(`INIT ${db.cards.length} cards -> ${OUT_FILE}`);
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    await writeDb(db);
    console.log(`READY ${db.cards.length} cards -> ${OUT_FILE}`);
    console.log("Missing GEMINI_API_KEY. Add it to .env or Vercel env, then rerun this script.");
    process.exitCode = 1;
    return;
  }

  const targets = args.only.length
    ? args.only
    : Array.from({ length: args.to - args.from + 1 }, (_, index) =>
        pad3(args.from + index)
      );
  const byNo = new Map(db.cards.map((card, index) => [card.cardNo, { card, index }]));
  let scanned = 0;
  let failed = 0;

  for (const cardNo of targets) {
    const current = byNo.get(cardNo);
    if (!current) {
      continue;
    }

    if (args.limit && scanned >= args.limit) {
      break;
    }

    if (shouldSkip(current.card, args.force)) {
      console.log(`SKIP ${cardNo}`);
      continue;
    }

    const filePath = await findCardFile(cardNo);
    if (!filePath) {
      console.log(`MISS ${cardNo}`);
      continue;
    }

    try {
      const nextCard = await scanCard({
        apiKey,
        model: args.model,
        cardNo,
        filePath,
      });
      db.cards[current.index] = nextCard;
      scanned += 1;
      await writeDb(db);
      console.log(`OK ${cardNo} ${nextCard.cardName || ""}`.trim());
    } catch (error) {
      failed += 1;
      db.cards[current.index] = {
        ...current.card,
        confidence: "low",
        scannedAt: new Date().toISOString(),
        notes: `OCR failed: ${error instanceof Error ? error.message : String(error)}`,
      };
      await writeDb(db);
      console.log(`FAIL ${cardNo}: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (args.delay) {
      await sleep(args.delay);
    }
  }

  console.log(`DONE scanned=${scanned} failed=${failed} -> ${OUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
