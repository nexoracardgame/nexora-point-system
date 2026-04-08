import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VECTOR_PATH = path.join(process.cwd(), "public", "card-vectors.json");

function sad(a: number[], b: number[]) {
  let s = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    s += Math.abs(a[i] - b[i]);
  }
  return s;
}

async function makeVectorFromBuffer(buffer: Buffer) {
  const meta = await sharp(buffer).metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;

  if (!width || !height) {
    throw new Error("Invalid image");
  }

  const cropWidth = Math.floor(width * 0.6);
  const cropHeight = Math.floor(height * 0.75);
  const left = Math.floor((width - cropWidth) / 2);
  const top = Math.floor((height - cropHeight) / 2);

  const raw = await sharp(buffer)
    .extract({
      left,
      top,
      width: cropWidth,
      height: cropHeight,
    })
    .resize(32, 48, { fit: "fill" })
    .grayscale()
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

    for (const [cardNo, ref] of Object.entries(db)) {
      const score = sad(vec, ref);
      if (score < bestScore) {
        bestScore = score;
        bestCardNo = cardNo;
      }
    }

    return NextResponse.json({
      success: true,
      cardNo: bestCardNo,
      score: bestScore,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "scan failed" },
      { status: 500 }
    );
  }
}