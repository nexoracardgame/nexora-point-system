import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { publishDealEvent } from "@/lib/deal-events";
import { createLocalNotification } from "@/lib/local-notification-store";
import { prisma } from "@/lib/prisma";
import { resolveUserIdentity } from "@/lib/user-identity";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const session = await getServerSession(authOptions);
    const identity = await resolveUserIdentity(session?.user);
    const buyerId = identity.userId;

    if (!buyerId) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบก่อน" },
        { status: 401 }
      );
    }

    const cardId = String(body?.cardId || "").trim();
    const offeredPrice = Number(body?.offeredPrice);

    if (!cardId || !Number.isFinite(offeredPrice)) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }

    const listing = await prisma.marketListing.findUnique({
      where: {
        id: cardId,
      },
      include: {
        seller: {
          select: {
            id: true,
            displayName: true,
            name: true,
            image: true,
          },
        },
      },
    });

    const sellerId = String(listing?.sellerId || "").trim();

    if (!listing || !sellerId) {
      return NextResponse.json(
        { error: "ไม่พบการ์ดใบนี้ในตลาด" },
        { status: 404 }
      );
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

    const listingStatus = String(listing.status || "").toLowerCase();

    if (listingStatus === "wanted") {
      return NextResponse.json(
        { error: "โพสต์นี้เป็นโหมดรับซื้อ ให้ส่งข้อเสนอผ่านหน้ารับซื้อ" },
        { status: 400 }
      );
    }

    if (listingStatus !== "active") {
      return NextResponse.json(
        { error: "การ์ดใบนี้ไม่พร้อมขายแล้ว" },
        { status: 400 }
      );
    }

    const existingOpenDeal = await prisma.dealRequest.findFirst({
      where: {
        cardId,
        buyerId,
        status: {
          in: ["pending", "accepted"],
        },
      },
    });

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

    const createdDeal = await prisma.dealRequest.create({
      data: {
        cardId,
        buyerId,
        sellerId,
        offeredPrice,
      },
    });

    try {
      await createLocalNotification({
        userId: sellerId,
        type: "deal",
        title: `${identity.name} ส่งคำขอดีลใหม่`,
        body: `เสนอราคา ฿${Number(offeredPrice).toLocaleString("th-TH")} สำหรับ ${
          String(body?.cardName || "").trim() ||
          listing.cardName ||
          `Card #${String(listing.cardNo || "001").padStart(3, "0")}`
        }`,
        href: "/market/deals",
        image: identity.image,
      });
    } catch (error) {
      console.error("DEAL NOTIFICATION ERROR:", error);
    }

    publishDealEvent({
      dealId: createdDeal.id,
      action: "created",
      changedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "ส่งคำขอดีลสำเร็จ",
      deal: createdDeal,
    });
  } catch (error) {
    console.error("DEAL REQUEST ERROR:", error);

    return NextResponse.json(
      { error: "ระบบขอดีลชั่วคราวใช้งานไม่ได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
