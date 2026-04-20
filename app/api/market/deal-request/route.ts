import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { publishDealEvent } from "@/lib/deal-events";
import {
  createLocalDeal,
  findExistingLocalOpenDeal,
} from "@/lib/local-deal-store";
import { getLocalMarketListingById } from "@/lib/local-market-store";
import { createLocalNotification } from "@/lib/local-notification-store";
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

    const listing = await getLocalMarketListingById(cardId);

    if (!listing || listing.sellerId !== sellerId) {
      return NextResponse.json(
        { error: "ไม่พบการ์ดใบนี้ในตลาด" },
        { status: 404 }
      );
    }

    if (String(listing.status || "").toLowerCase() === "sold") {
      return NextResponse.json(
        { error: "การ์ดใบนี้ขายไปแล้ว" },
        { status: 400 }
      );
    }

    const existingOpenDeal = await findExistingLocalOpenDeal(cardId, buyerId);

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

    const buyerName = identity.name;
    const buyerImage = identity.image;

    const localDeal = await createLocalDeal({
      cardId,
      buyerId,
      buyerName,
      buyerImage,
      sellerId,
      sellerName: listing.sellerName || "ผู้ขาย",
      sellerImage: listing.sellerImage || "/avatar.png",
      offeredPrice,
      cardName:
        String(body?.cardName || "").trim() ||
        listing.cardName ||
        `Card #${String(listing.cardNo || "001").padStart(3, "0")}`,
      cardNo:
        String(body?.cardNo || "").trim() ||
        String(listing.cardNo || "001"),
      cardImage:
        String(body?.cardImage || "").trim() ||
        listing.imageUrl ||
        `/cards/${String(listing.cardNo || "001").padStart(3, "0")}.jpg`,
      listedPrice: Number.isFinite(Number(body?.listedPrice))
        ? Number(body?.listedPrice)
        : Number(listing.price || 0),
      serialNo:
        String(body?.serialNo || "").trim() ||
        String(listing.serialNo || "").trim() ||
        null,
      listingStatus: String(listing.status || "active"),
    });

    try {
      await createLocalNotification({
        userId: sellerId,
        type: "deal",
        title: `${buyerName} ส่งคำขอดีลใหม่`,
        body: `เสนอราคา ฿${Number(offeredPrice).toLocaleString("th-TH")} สำหรับ ${localDeal.cardName}`,
        href: "/market/deals",
        image: buyerImage,
      });
    } catch (error) {
      console.error("DEAL NOTIFICATION ERROR:", error);
    }

    publishDealEvent({
      dealId: localDeal.id,
      action: "created",
      changedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "ส่งคำขอดีลสำเร็จ",
      deal: localDeal,
    });
  } catch (error) {
    console.error("DEAL REQUEST ERROR:", error);

    return NextResponse.json(
      { error: "ระบบขอดีลชั่วคราวใช้งานไม่ได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
