import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { cardId, buyerId, sellerId, offeredPrice } = await req.json();

    if (!cardId || !buyerId || !sellerId || !offeredPrice) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ครบ" },
        { status: 400 }
      );
    }

    const deal = await prisma.dealRequest.create({
      data: {
        cardId,
        buyerId,
        sellerId,
        offeredPrice: Number(offeredPrice),
      },
    });

    return NextResponse.json({
      success: true,
      deal,
    });
  } catch (error) {
    console.error("DEAL REQUEST ERROR:", error);

    return NextResponse.json(
      { error: "สร้างคำขอดีลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}