import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createLocalNotification } from "@/lib/local-notification-store";
import { getMarketListingById } from "@/lib/market-listings";
import { prisma } from "@/lib/prisma";
import { resolveUserIdentity } from "@/lib/user-identity";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const identity = await resolveUserIdentity(session?.user);
    const buyerId = identity.userId;

    if (!buyerId) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { cardId, sellerId, offeredPrice } = await req.json();
    const normalizedCardId = String(cardId || "").trim();
    const normalizedSellerId = String(sellerId || "").trim();
    const normalizedPrice = Number(offeredPrice);

    if (
      !normalizedCardId ||
      !normalizedSellerId ||
      !Number.isFinite(normalizedPrice) ||
      normalizedPrice <= 0
    ) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }

    const listing = await getMarketListingById(normalizedCardId);

    if (!listing || listing.sellerId !== normalizedSellerId) {
      return NextResponse.json({ error: "ไม่พบการ์ดในตลาด" }, { status: 404 });
    }

    if (buyerId === normalizedSellerId) {
      return NextResponse.json(
        { error: "ไม่สามารถส่งดีลให้ตัวเองได้" },
        { status: 400 }
      );
    }

    if (String(listing.status || "").toLowerCase() === "sold") {
      return NextResponse.json({ error: "การ์ดใบนี้ขายไปแล้ว" }, { status: 400 });
    }

    const existing = await prisma.dealRequest.findFirst({
      where: {
        cardId: normalizedCardId,
        buyerId,
        status: {
          in: ["pending", "accepted"],
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "มีดีลค้างอยู่แล้ว" }, { status: 409 });
    }

    await prisma.dealRequest.create({
      data: {
        cardId: normalizedCardId,
        buyerId,
        sellerId: normalizedSellerId,
        offeredPrice: normalizedPrice,
      },
    });

    if (normalizedSellerId !== buyerId) {
      await createLocalNotification({
        userId: normalizedSellerId,
        type: "deal",
        title: `${identity.name} ส่งคำขอดีลใหม่`,
        body: `เสนอราคา ฿${normalizedPrice.toLocaleString("th-TH")} สำหรับ ${
          listing.cardName || `Card #${String(listing.cardNo || "001").padStart(3, "0")}`
        }`,
        href: "/market/deals",
        image: identity.image,
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "ระบบผิดพลาด" }, { status: 500 });
  }
}
