import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AI_CLOUD_URL = "https://nexora-ai-cloud.onrender.com/predict";

export async function POST(req: NextRequest) {
  try {
    let imageBase64 = "";

    const contentType = req.headers.get("content-type") || "";

    // ✅ รองรับ FormData จากมือถือ/หน้า scan ใหม่
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
      const buffer = Buffer.from(bytes);

      imageBase64 = `data:${file.type};base64,${buffer.toString("base64")}`;
    } else {
      // ✅ fallback รองรับ JSON แบบเก่า
      const body = await req.json();
      imageBase64 = body?.image || "";
    }

    if (!imageBase64) {
      return NextResponse.json(
        { cardNo: null, confidence: 0, error: "No image" },
        { status: 400 }
      );
    }

    const aiRes = await fetch(AI_CLOUD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: imageBase64,
      }),
      cache: "no-store",
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
    });
  } catch (error: any) {
    console.error("scan-ai route error:", error);

    return NextResponse.json(
      {
        cardNo: null,
        confidence: 0,
        error: error?.message || "scan failed",
      },
      { status: 500 }
    );
  }
}