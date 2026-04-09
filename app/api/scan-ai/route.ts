import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();

    // 🔥 ตอนนี้ mock ก่อน
    // เดี๋ยวรอบต่อไปต่อ python microservice model จริง
    return NextResponse.json({
      cardNo: "029",
      confidence: 0.98,
    });
  } catch {
    return NextResponse.json(
      { error: "scan fail" },
      { status: 500 }
    );
  }
}