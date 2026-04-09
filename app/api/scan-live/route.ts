import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VECTOR_PATH = path.join(
  process.cwd(),
  "public",
  "card-vectors.json"
);

function weightedSad(a: number[], b: number[]) {
  let score = 0;
  const len = Math.min(a.length, b.length);

  for (let i = 0; i < len; i++) {
    const row = Math.floor(i / 32);

    // ให้น้ำหนักหัวการ์ด + ขวาที่มี Card No.
    let weight = 1;
    if (row < 8) weight = 2.2; // title ด้านบน
    if (i % 32 > 24) weight = 2.5; // เลข card no ขวา

    score += Math.abs(a[i] - b[i]) * weight;
  }

  return score;
}

async function makeVectorFromBuffer(buffer: Buffer) {
  const meta = await sharp(buffer).metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;

  if (!width || !height) {
    throw new Error("Invalid image");
  }

  const raw = await sharp(buffer)
    .resize(32, 48, { fit: "fill" })
    .grayscale()
    .normalize()
    .raw()
    .toBuffer();

  return Array.from(raw);
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const dbRaw = await fs.readFile(VECTOR_PATH, "utf8");
    const db = JSON.parse(dbRaw) as Record<string, number[]>;

    const vec = await makeVectorFromBuffer(buffer);

    let bestCardNo = "";
    let bestScore = Infinity;
    let secondBest = Infinity;

    for (const [cardNo, ref] of Object.entries(db)) {
      const score = weightedSad(vec, ref);

      if (score < bestScore) {
        secondBest = bestScore;
        bestScore = score;
        bestCardNo = cardNo;
      } else if (score < secondBest) {
        secondBest = score;
      }
    }

    const confidence = Math.max(
      0,
      Math.min(
        99,
        Math.round((1 - bestScore / (secondBest || bestScore + 1)) * 100)
      )
    );

    return NextResponse.json({
      success: true,
      cardNo: bestCardNo,
      confidence,
      score: bestScore,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "scan failed" },
      { status: 500 }
    );
  }
}