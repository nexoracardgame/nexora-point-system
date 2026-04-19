import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const buyerId = String(session?.user?.id || "").trim();

    if (!buyerId) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบก่อน" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const cardId = String(body?.cardId || "").trim();
    const sellerId = String(body?.sellerId || "").trim();
    const offeredPrice = Number(body?.offeredPrice);

    if (!cardId || !sellerId || !Number.isFinite(offeredPrice)) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }

    if (buyerId === sellerId) {
      return NextResponse.json(
        { error: "ไม่สามารถส่งดีลให้ตัวเองได้" },
        { status: 400 }
      );
    }

    if (offeredPrice <= 0) {
      return NextResponse.json(
        { error: "ราคาที่เสนอไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const [sellerUser, listing, existingOpenDeal] = await Promise.all([
      prisma.user.findUnique({
        where: { id: sellerId },
        select: {
          id: true,
          displayName: true,
          name: true,
        },
      }),
      prisma.marketListing.findUnique({
        where: { id: cardId },
        select: {
          id: true,
          sellerId: true,
          status: true,
        },
      }),
      prisma.dealRequest.findFirst({
        where: {
          cardId,
          buyerId,
          status: {
            in: ["pending", "accepted"],
          },
        },
        select: {
          id: true,
          status: true,
        },
      }),
    ]);

    if (!sellerUser) {
      return NextResponse.json({ error: "ไม่พบผู้ขาย" }, { status: 400 });
    }

    if (!listing || listing.sellerId !== sellerId) {
      return NextResponse.json(
        { error: "ไม่พบการ์ดใบนี้ในตลาด" },
        { status: 404 }
      );
    }

    if (listing.status === "sold") {
      return NextResponse.json(
        { error: "การ์ดใบนี้ขายไปแล้ว" },
        { status: 400 }
      );
    }

    if (existingOpenDeal) {
      return NextResponse.json(
        {
          error:
            existingOpenDeal.status === "accepted"
              ? "คุณมีดีลที่ถูกตอบรับแล้วกับการ์ดใบนี้อยู่ ต้องยกเลิกก่อนถึงจะส่งใหม่ได้"
              : "คุณส่งคำขอดีลค้างอยู่กับการ์ดใบนี้แล้ว ต้องยกเลิกดีลเดิมก่อน",
        },
        { status: 409 }
      );
    }

    const deal = await prisma.dealRequest.create({
      data: {
        cardId,
        offeredPrice,
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
      message: "ส่งคำขอดีลสำเร็จ",
      deal,
    });
  } catch (error) {
    console.error("DEAL REQUEST ERROR:", error);

    const message =
      error instanceof Error ? error.message : "สร้างคำขอดีลไม่สำเร็จ";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
