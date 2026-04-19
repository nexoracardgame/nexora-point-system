import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const currentUserId = String(session?.user?.id || "").trim();

    if (!currentUserId) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const body = await req.json();
    const dealId = String(body?.dealId || "").trim();
    const action = String(body?.action || "").trim().toLowerCase();

    if (!dealId || !action) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }

    const deal = await prisma.dealRequest.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        cardId: true,
        buyerId: true,
        sellerId: true,
        offeredPrice: true,
        status: true,
      },
    });

    if (!deal) {
      return NextResponse.json({ error: "ไม่พบดีล" }, { status: 404 });
    }

    if (deal.sellerId !== currentUserId) {
      return NextResponse.json(
        { error: "เฉพาะเจ้าของการ์ดเท่านั้น" },
        { status: 403 }
      );
    }

    if (action === "reject") {
      if (deal.status !== "pending") {
        return NextResponse.json(
          { error: "ปฏิเสธได้เฉพาะดีลที่ยังรอการตอบรับ" },
          { status: 400 }
        );
      }

      await prisma.dealRequest.delete({
        where: { id: dealId },
      });

      return NextResponse.json(
        { success: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (action !== "accept") {
      return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
    }

    if (!["pending", "accepted"].includes(deal.status)) {
      return NextResponse.json(
        { error: "ดีลนี้ไม่สามารถยืนยันได้แล้ว" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const freshDeal = await tx.dealRequest.findUnique({
        where: { id: dealId },
        select: {
          id: true,
          cardId: true,
          buyerId: true,
          offeredPrice: true,
          status: true,
        },
      });

      if (!freshDeal) {
        return { ok: false as const, status: 404, error: "ไม่พบดีล" };
      }

      const listing = await tx.marketListing.findUnique({
        where: { id: freshDeal.cardId },
        select: {
          id: true,
          status: true,
          sellerId: true,
          cardName: true,
          imageUrl: true,
        },
      });

      if (!listing) {
        return { ok: false as const, status: 404, error: "ไม่พบการ์ดในตลาด" };
      }

      if (listing.status === "sold") {
        return { ok: false as const, status: 409, error: "การ์ดใบนี้ขายไปแล้ว" };
      }

      if (listing.status === "reserved") {
        await tx.marketListing.update({
          where: { id: listing.id },
          data: { status: "active" },
        });
      }

      const acceptedByOtherBuyer = await tx.dealRequest.findFirst({
        where: {
          cardId: freshDeal.cardId,
          status: "accepted",
          id: { not: freshDeal.id },
        },
        select: { id: true },
      });

      if (acceptedByOtherBuyer) {
        return {
          ok: false as const,
          status: 409,
          error: "การ์ดใบนี้มีผู้ถูกเลือกคุยอยู่แล้ว ต้องยกเลิกดีลที่รับไว้ก่อน",
        };
      }

      if (freshDeal.status === "pending") {
        await tx.dealRequest.update({
          where: { id: freshDeal.id },
          data: { status: "accepted" },
        });

        await tx.marketHistory.create({
          data: {
            listingId: freshDeal.cardId,
            action: "deal_accepted",
            detail: `Deal accepted for ${Number(freshDeal.offeredPrice).toLocaleString("th-TH")} THB`,
            sellerId: listing.sellerId,
            buyerId: deal.buyerId,
            price: Number(freshDeal.offeredPrice),
            cardName: listing.cardName,
            imageUrl: listing.imageUrl,
          },
        });
      }

      return { ok: true as const };
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        {
          status: result.status,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("DEAL ACTION ERROR:", error);
    return NextResponse.json(
      { error: "ทำรายการไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
