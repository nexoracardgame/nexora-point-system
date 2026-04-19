import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanupDealChat } from "@/lib/deal-chat-cleanup";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const currentUserId = String(session?.user?.id || "").trim();

    if (!currentUserId) {
      return NextResponse.json(
        { error: "ยังไม่ได้ล็อกอิน" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const dealId = String(body?.dealId || "").trim();
    const serialInput = String(body?.serialInput || "")
      .trim()
      .toLowerCase();

    if (!dealId || !serialInput) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }

    const deal = await prisma.dealRequest.findUnique({
      where: { id: dealId },
    });

    if (!deal) {
      return NextResponse.json({ error: "ไม่พบดีล" }, { status: 404 });
    }

    if (deal.status !== "accepted") {
      return NextResponse.json(
        { error: "ดีลนี้ยังไม่พร้อมปิด" },
        { status: 400 }
      );
    }

    if (deal.buyerId !== currentUserId) {
      return NextResponse.json(
        { error: "เฉพาะผู้ซื้อเท่านั้น" },
        { status: 403 }
      );
    }

    const listing = await prisma.marketListing.findUnique({
      where: { id: deal.cardId },
    });

    if (!listing) {
      return NextResponse.json({ error: "ไม่พบการ์ด" }, { status: 404 });
    }

    const dbSerial = String(listing.serialNo || "").trim().toLowerCase();

    if (!dbSerial || dbSerial !== serialInput) {
      return NextResponse.json({ error: "Serial ไม่ตรง" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const fresh = await tx.marketListing.findUnique({
        where: { id: listing.id },
      });

      if (!fresh || fresh.status === "sold") {
        throw new Error("รายการนี้ถูกขายไปแล้ว");
      }

      await tx.marketListing.update({
        where: { id: listing.id },
        data: { status: "sold" },
      });

      await tx.marketHistory.create({
        data: {
          listingId: listing.id,
          action: "sold",
          detail: `Sold ${Number(deal.offeredPrice).toLocaleString("th-TH")} THB`,
          sellerId: listing.sellerId,
          buyerId: deal.buyerId,
          price: Number(deal.offeredPrice),
          cardName: listing.cardName,
          imageUrl: listing.imageUrl,
        },
      });

      await tx.dealRequest.deleteMany({
        where: { cardId: listing.id },
      });
    });

    await cleanupDealChat(deal.id);

    revalidatePath("/market/seller-center");
    revalidatePath("/market/deals");
    revalidatePath("/market");
    revalidatePath("/market/card/[id]", "page");
    revalidatePath("/api/market/my-listings");

    return NextResponse.json({
      success: true,
      message: "ปิดดีลสำเร็จ",
    });
  } catch (error) {
    console.error("VERIFY ERROR:", error);

    const message =
      error instanceof Error ? error.message : "ระบบผิดพลาด";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
