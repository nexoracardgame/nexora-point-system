import { NextRequest, NextResponse } from "next/server";
import {
  getNexoraCoinReward,
  getNexoraSingleCardNexReward,
  normalizeNexoraCardNo,
} from "@/lib/nexora-card-rewards";

type CacheEntry = {
  data: any;
  expires: number;
};

const memoryCache = new Map<string, CacheEntry>();

const CACHE_TTL = 60 * 1000; // 60 วิ

export async function GET(req: NextRequest) {
  const cardNo = req.nextUrl.searchParams.get("cardNo");
  const normalizedCardNo = normalizeNexoraCardNo(cardNo || "");

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
        ...mergeCanonicalCardRewards(cached.data, normalizedCardNo),
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
    const mergedData = mergeCanonicalCardRewards(data, normalizedCardNo);

    memoryCache.set(cardNo, {
      data: mergedData,
      expires: Date.now() + CACHE_TTL,
    });

    return NextResponse.json({
      ...mergedData,
      cached: false,
    });
  } catch (error: any) {
    console.error("CARD API ERROR:", error);

    // 🛟 4) fallback ถ้ามี cache เก่า
    const fallback = memoryCache.get(cardNo);

    if (fallback) {
      return NextResponse.json({
        ...mergeCanonicalCardRewards(fallback.data, normalizedCardNo),
        cached: true,
        stale: true,
      });
    }

    const canonicalOnly = mergeCanonicalCardRewards(
      {
        cardNo: normalizedCardNo || cardNo,
        imageUrl: normalizedCardNo ? `/cards/${normalizedCardNo}.jpg` : "",
      },
      normalizedCardNo
    );

    if (normalizedCardNo && (canonicalOnly.coinValue || canonicalOnly.singleCardNexValue)) {
      return NextResponse.json({
        ...canonicalOnly,
        cached: false,
        canonicalOnly: true,
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

function mergeCanonicalCardRewards(data: any, cardNo: string) {
  const coinReward = getNexoraCoinReward(cardNo);
  const singleCardReward = getNexoraSingleCardNexReward(cardNo);

  return {
    ...data,
    cardNo: data?.cardNo || cardNo,
    card_no: data?.card_no || cardNo,
    coinValue: coinReward?.coinValue ?? data?.coinValue ?? data?.coin ?? 0,
    coin: coinReward?.coinValue ?? data?.coin ?? data?.coinValue ?? 0,
    coinReward,
    singleCardNexValue: singleCardReward?.nexValue ?? data?.singleCardNexValue ?? 0,
    singleCardNexReward: singleCardReward || data?.singleCardNexReward || null,
  };
}
