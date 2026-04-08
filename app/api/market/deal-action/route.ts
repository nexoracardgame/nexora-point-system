import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { dealId, action } = await req.json();

    const deal = await prisma.dealRequest.findUnique({
      where: { id: dealId },
    });

    if (!deal) {
      return NextResponse.json(
        { error: "ไม่พบดีล" },
        { status: 404 }
      );
    }

    if (action === "accept") {
      await prisma.$transaction([
        prisma.dealRequest.update({
          where: { id: dealId },
          data: {
            status: "accepted",
          },
        }),

        prisma.marketListing.updateMany({
          where: {
            cardNo: deal.cardId,
          },
          data: {
            sellerId: deal.buyerId,
          },
        }),

        prisma.marketHistory.create({
          data: {
            listingId: deal.cardId,
            action: "deal_completed",
            detail: `ดีลสำเร็จ ${deal.offeredPrice} NEX`,
          },
        }),
      ]);
    }

    if (action === "reject") {
      await prisma.dealRequest.update({
        where: { id: dealId },
        data: {
          status: "rejected",
        },
      });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("DEAL ACTION ERROR:", error);

    return NextResponse.json(
      { error: "อัปเดตดีลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}