import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { name, imageUrl, nexCost, coinCost, stock } =
      await req.json();

    const reward = await prisma.reward.create({
      data: {
        name,
        imageUrl,
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