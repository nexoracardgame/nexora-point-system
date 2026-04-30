import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateRewardSurfaces } from "@/lib/reward-cache";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, cost, stock } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ไม่พบ id ของ reward" },
        { status: 400 }
      );
    }

    const reward = await prisma.reward.update({
      where: { id },
      data: {
        ...(cost !== undefined ? { cost: Number(cost) } : {}),
        ...(stock !== undefined ? { stock: Number(stock) } : {}),
      },
    });

    revalidateRewardSurfaces();

    return NextResponse.json({ success: true, reward });
  } catch (error) {
    return NextResponse.json(
      { error: "อัปเดตของรางวัลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
