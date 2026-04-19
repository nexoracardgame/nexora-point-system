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

    if (!dealId) {
      return NextResponse.json({ error: "ไม่พบ dealId" }, { status: 400 });
    }

    const deal = await prisma.dealRequest.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        cardId: true,
        buyerId: true,
        sellerId: true,
        status: true,
      },
    });

    if (!deal) {
      return NextResponse.json({ error: "ไม่พบดีล" }, { status: 404 });
    }

    const isParticipant =
      deal.buyerId === currentUserId || deal.sellerId === currentUserId;

    if (!isParticipant) {
      return NextResponse.json(
        { error: "เฉพาะคนในดีลเท่านั้น" },
        { status: 403 }
      );
    }

    if (!["pending", "accepted"].includes(deal.status)) {
      return NextResponse.json(
        { error: "ดีลนี้ยกเลิกไม่ได้แล้ว" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.dealRequest.delete({
        where: { id: dealId },
      });

      const listing = await tx.marketListing.findUnique({
        where: { id: deal.cardId },
        select: {
          id: true,
          status: true,
        },
      });

      if (listing?.status === "reserved") {
        await tx.marketListing.update({
          where: { id: listing.id },
          data: { status: "active" },
        });
      }

      if (deal.status === "accepted") {
        const latestAcceptedHistory = await tx.marketHistory.findFirst({
          where: {
            listingId: deal.cardId,
            action: "deal_accepted",
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
          },
        });

        if (latestAcceptedHistory) {
          await tx.marketHistory.delete({
            where: { id: latestAcceptedHistory.id },
          });
        }
      }
    });

    return NextResponse.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("DEAL CANCEL ERROR:", error);

    const message =
      error instanceof Error ? error.message : "ยกเลิกไม่สำเร็จ";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
