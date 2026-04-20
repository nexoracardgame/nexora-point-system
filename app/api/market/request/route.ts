import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createLocalDeal,
  findExistingLocalOpenDeal,
} from "@/lib/local-deal-store";
import { getLocalMarketListingById } from "@/lib/local-market-store";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { cardId, sellerId, offeredPrice } = await req.json();
    const normalizedCardId = String(cardId || "").trim();
    const normalizedSellerId = String(sellerId || "").trim();
    const normalizedPrice = Number(offeredPrice);

    if (!normalizedCardId || !normalizedSellerId || !Number.isFinite(normalizedPrice)) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }

    const listing = await getLocalMarketListingById(normalizedCardId);

    if (!listing || listing.sellerId !== normalizedSellerId) {
      return NextResponse.json({ error: "ไม่พบการ์ดในตลาด" }, { status: 404 });
    }

    const existing = await findExistingLocalOpenDeal(
      normalizedCardId,
      String(session.user.id)
    );

    if (existing) {
      return NextResponse.json({ error: "มีดีลค้างอยู่แล้ว" }, { status: 409 });
    }

    await createLocalDeal({
      cardId: normalizedCardId,
      buyerId: String(session.user.id),
      buyerName: String(session.user.name || "").trim() || "ผู้ซื้อ",
      buyerImage: String(session.user.image || "").trim() || "/avatar.png",
      sellerId: normalizedSellerId,
      sellerName: listing.sellerName || "ผู้ขาย",
      sellerImage: listing.sellerImage || "/avatar.png",
      offeredPrice: normalizedPrice,
      cardName: listing.cardName || `Card #${String(listing.cardNo || "001").padStart(3, "0")}`,
      cardNo: String(listing.cardNo || "001"),
      cardImage:
        listing.imageUrl || `/cards/${String(listing.cardNo || "001").padStart(3, "0")}.jpg`,
      listedPrice: Number(listing.price || 0),
      serialNo: listing.serialNo || null,
      listingStatus: String(listing.status || "active"),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "ระบบผิดพลาด" }, { status: 500 });
  }
}
