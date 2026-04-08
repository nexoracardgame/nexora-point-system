import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, imageUrl, nexCost, coinCost, stock } = body;

    const reward = await prisma.reward.create({
      data: {
        name,
        imageUrl,
        nexCost,
        coinCost,
        stock: Number(stock),
      },
    });

    return NextResponse.json({ success: true, reward });
  } catch (error) {
    console.error("CREATE REWARD ERROR:", error);

    return NextResponse.json(
      { error: "สร้างของรางวัลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}