import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { revalidateRewardSurfaces } from "@/lib/reward-cache";
import { stampRewardImageUrl } from "@/lib/reward-image";

export async function POST(req: Request) {
  try {
    const { name, imageUrl, nexCost, coinCost, stock } =
      await req.json();

    const reward = await prisma.reward.create({
      data: {
        name,
        imageUrl: imageUrl ? stampRewardImageUrl(imageUrl) : null,
        nexCost:
          nexCost === null || nexCost === ""
            ? null
            : Number(nexCost),
        coinCost:
          coinCost === null || coinCost === ""
            ? null
            : Number(coinCost),
        stock: Number(stock),
      },
    });

    revalidateRewardSurfaces();

    return NextResponse.json({
      success: true,
      reward,
    });
  } catch (error) {
    console.error("CREATE REWARD ERROR:", error);

    return NextResponse.json(
      { error: "สร้าง reward ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
