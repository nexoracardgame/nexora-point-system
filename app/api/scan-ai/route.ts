import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AI_CLOUD_URL = "https://nexora-ai-cloud.onrender.com/predict";

export async function POST(req: NextRequest) {
  try {
    let imageBase64 = "";
    let imageBuffer: Buffer | null = null;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { cardNo: null, confidence: 0, error: "No file" },
          { status: 400 }
        );
      }

      const bytes = await file.arrayBuffer();
      imageBuffer = Buffer.from(bytes);
    } else {
      const body = await req.json();
      imageBase64 = body?.image || "";
    }

    if (!imageBase64 && !imageBuffer) {
      return NextResponse.json(
        { cardNo: null, confidence: 0, error: "No image" },
        { status: 400 }
      );
    }

    if (imageBuffer) {
      const optimized = await sharp(imageBuffer)
        .resize(960, 1200, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 86, mozjpeg: true })
        .toBuffer();

      imageBase64 = `data:image/jpeg;base64,${optimized.toString("base64")}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const aiRes = await fetch(AI_CLOUD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: imageBase64,
      }),
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeout);
    });

    const raw = await aiRes.text();

    if (!aiRes.ok) {
      return new NextResponse(raw, {
        status: aiRes.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(raw);

    return NextResponse.json({
      cardNo: result.cardNo || result.card_no || null,
      confidence: result.confidence ?? 0,
      score: result.score || 0,
      source: "ai",
    });
  } catch (error: unknown) {
    console.error("scan-ai route error:", error);
    const message =
      error instanceof Error ? error.message : "scan failed";
    const errorName = error instanceof Error ? error.name : "";

    return NextResponse.json(
      {
        cardNo: null,
        confidence: 0,
        error:
          errorName === "AbortError"
            ? "AI timeout"
            : message,
      },
      { status: 500 }
    );
  }
}
