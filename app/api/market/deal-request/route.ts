import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const buyerId = String((session?.user as any)?.id || "");

    if (!buyerId) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบก่อน" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { cardId, sellerId, offeredPrice } = body;

    console.log("DEAL INPUT:", {
      buyerId,
      sellerId,
      cardId,
      offeredPrice,
    });

    if (!cardId || !sellerId || !offeredPrice) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ครบ" },
        { status: 400 }
      );
    }

    if (buyerId === sellerId) {
      return NextResponse.json(
        { error: "ไม่สามารถส่งดีลให้ตัวเองได้" },
        { status: 400 }
      );
    }

    const price = Number(offeredPrice);

    if (isNaN(price) || price <= 0) {
      return NextResponse.json(
        { error: "ราคาที่เสนอไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    // ✅ เช็คว่าคนขายมีอยู่จริง
    const sellerUser = await prisma.user.findUnique({
      where: {
        id: sellerId,
      },
      select: {
        id: true,
        displayName: true,
        name: true,
      },
    });

    if (!sellerUser) {
      return NextResponse.json(
        {
          error:
            "ไม่พบ sellerId ในระบบ (client น่าจะส่ง id ผิด ต้องใช้ listing.sellerId)",
        },
        { status: 400 }
      );
    }

    const deal = await prisma.dealRequest.create({
      data: {
        cardId,
        offeredPrice: price,
        status: "pending",
        buyerId,
        sellerId,
      },
      include: {
        buyer: {
          select: {
            displayName: true,
            name: true,
          },
        },
        seller: {
          select: {
            displayName: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "ส่งคำขอดีลสำเร็จ 🎉",
      deal,
    });
  } catch (error: any) {
    console.error("DEAL REQUEST ERROR:", error);
    console.error("DEAL REQUEST ERROR FULL:", error?.message);

    return NextResponse.json(
      {
        error: error?.message || "สร้างคำขอดีลไม่สำเร็จ",
      },
      { status: 500 }
    );
  }
}