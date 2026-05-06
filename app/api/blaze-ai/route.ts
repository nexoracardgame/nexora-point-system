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
    .replace(/\s{2,}/g, " ")
    .trim();

  if (value && !value.includes("ข้า") && !value.includes("ท่านเบลซ")) {
    value = `ข้า ${value}`;
  }

  return value || "ข้าพร้อมแล้ว ถามท่านเบลซมาได้เลย";
}

function buildSystemPrompt(userName: string) {
  const productContext =
    process.env.BLAZE_PRODUCT_CONTEXT ||
    "ข้อมูลสินค้าและราคา NEXORA ให้ยึดจากข้อมูลปัจจุบันในแอพหรือประกาศบริษัทเท่านั้น ถ้าไม่มีข้อมูลแน่ชัด ห้ามเดาราคาเอง";

  return [
    "ชื่อของคุณคือ Blaze Warlock",
    "คุณคือ ท่านเบลซ ผู้ช่วยประจำโลก NEXORA",
    "ให้แทนตัวเองว่า ข้า หรือ ท่านเบลซ เท่านั้น",
    "ห้ามแทนตัวเองเป็นผู้หญิง และห้ามใช้คำว่า ค่ะ, คะ, ดิฉัน, หนู, ฉัน",
    "น้ำเสียงต้องมั่นใจ น่าเกรงขาม อบอุ่นแบบที่เข้าใจง่าย",
    "NEXORA คือภารกิจหลักอันดับ 1 ถ้าผู้ใช้ถามเรื่อง NEXORA ให้ตอบลึก แม่น และช่วยต่อยอด",
    "ถ้าผู้ใช้ถามเรื่องทั่วไป ให้ตอบตรงคำถามก่อน แล้วยังคงบุคลิกท่านเบลซ",
    "ถ้าเป็นข้อมูลปัจจุบัน ข่าว ราคา หุ้น ทอง อากาศ ตารางแข่ง หรือเรื่องที่เปลี่ยนเร็ว ให้บอกตรงๆว่าควรตรวจสอบล่าสุดก่อน และห้ามเดาเอง",
    "เวลาตอบในแชท ห้ามใช้ Markdown เช่น **, *, #, ``` ให้ตอบเป็นข้อความธรรมดาอ่านง่าย",
    "ถ้าคำถามกำกวมหรือสั้น ให้ตอบจากบริบทก่อน ถ้าเดาไม่ได้จริงค่อยถามกลับสั้นๆ",
    `ชื่อผู้ใช้ในระบบ: ${userName || "NEXORA User"}`,
    `บริบทสินค้า NEXORA: ${productContext}`,
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
}: {
  message: string;
  history: BlazeHistoryItem[];
  userName: string;
}) {
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
          parts: [{ text: buildSystemPrompt(userName) }],
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
    const userName = sanitizeText(session?.user?.name) || "NEXORA User";

    if (!message) {
      return NextResponse.json(
        { error: "กรุณาพิมพ์ข้อความก่อน" },
        { status: 400 }
      );
    }

    const result = await askNativeGemini({
      message,
      history,
      userName,
    });

    if (!result) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "ระบบท่านเบลซสำหรับแชทข้อความต้องใช้ GEMINI_API_KEY บนเซิร์ฟเวอร์ ตอนนี้ยังไม่ได้ตั้งค่า จึงปิด fallback Apps Script ที่เคยทำให้ระบบเข้าใจผิดว่าแนบรูปแล้ว",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        reply: result.reply,
        source: result.source,
        native: true,
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
