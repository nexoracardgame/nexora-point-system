import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, nexCost, coinCost, stock } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ไม่พบ reward id" },
        { status: 400 }
      );
    }

    const reward = await prisma.reward.update({
      where: { id },
      data: {
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
    console.error("UPDATE REWARD ERROR:", error);

    return NextResponse.json(
      { error: "อัปเดตรางวัลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}