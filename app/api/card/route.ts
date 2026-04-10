import { NextRequest, NextResponse } from "next/server";

type CacheEntry = {
  data: any;
  expires: number;
};

const memoryCache = new Map<string, CacheEntry>();

const CACHE_TTL = 60 * 1000; // 60 วิ

export async function GET(req: NextRequest) {
  const cardNo = req.nextUrl.searchParams.get("cardNo");

  if (!cardNo) {
    return NextResponse.json(
      { error: "Missing cardNo" },
      { status: 400 }
    );
  }

  try {
    // 🚀 1) เช็ค cache ก่อน
    const cached = memoryCache.get(cardNo);

    if (cached && cached.expires > Date.now()) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
      });
    }

    // 🌐 2) ยิง GAS เมื่อไม่มี cache
    const gasUrl =
      "https://script.google.com/macros/s/AKfycbxqjkZjIurmcAA5YoOvtrtM8rWc_le4Fu8rNCQd0G2HMpfpUXP5Z50WqpCxkeeF1AZDow/exec";

    const res = await fetch(
      `${gasUrl}?cardNo=${encodeURIComponent(cardNo)}`,
      {
        next: { revalidate: 60 },
      }
    );

    if (!res.ok) {
      throw new Error(`GAS ${res.status}`);
    }

    const data = await res.json();

    // 💾 3) เก็บ cache 60 วิ
    memoryCache.set(cardNo, {
      data,
      expires: Date.now() + CACHE_TTL,
    });

    return NextResponse.json({
      ...data,
      cached: false,
    });
  } catch (error: any) {
    console.error("CARD API ERROR:", error);

    // 🛟 4) fallback ถ้ามี cache เก่า
    const fallback = memoryCache.get(cardNo);

    if (fallback) {
      return NextResponse.json({
        ...fallback.data,
        cached: true,
        stale: true,
      });
    }

    return NextResponse.json(
      {
        error: "โหลดข้อมูลการ์ดไม่สำเร็จ",
        detail: error?.message,
      },
      { status: 500 }
    );
  }
}