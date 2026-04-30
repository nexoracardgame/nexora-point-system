import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
};

export async function GET() {
  try {
    const rewards = await prisma.reward.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        imageUrl: true,
        nexCost: true,
        coinCost: true,
        stock: true,
      },
    });

    return NextResponse.json(
      {
        rewards,
        syncedAt: Date.now(),
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("REWARD_LIST_ERROR", error);

    return NextResponse.json(
      {
        rewards: [],
        error: "โหลดรางวัลไม่สำเร็จ",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}
