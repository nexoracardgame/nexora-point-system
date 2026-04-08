import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.lineId) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { cardId, sellerId, offeredPrice } = await req.json();

    const buyer = await prisma.user.findUnique({
      where: { lineId: session.user.lineId },
    });

    if (!buyer) {
      return NextResponse.json({ error: "ไม่พบผู้ซื้อ" }, { status: 404 });
    }

    await prisma.dealRequest.create({
      data: {
        cardId,
        buyerId: buyer.id,
        sellerId,
        offeredPrice,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "ระบบผิดพลาด" }, { status: 500 });
  }
}