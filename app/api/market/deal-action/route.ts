import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const currentUserId = String((session?.user as any)?.id || "");

    if (!currentUserId) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบ" },
        { status: 401 }
      );
    }

    const { dealId, action } = await req.json();

    if (!dealId || !action) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ครบ" },
        { status: 400 }
      );
    }

    const deal = await prisma.dealRequest.findUnique({
      where: { id: dealId },
    });

    if (!deal) {
      return NextResponse.json(
        { error: "ไม่พบดีล" },
        { status: 404 }
      );
    }

    if (deal.sellerId !== currentUserId) {
      return NextResponse.json(
        { error: "เฉพาะเจ้าของการ์ดเท่านั้น" },
        { status: 403 }
      );
    }

    if (action === "reject") {
      await prisma.dealRequest.delete({
        where: { id: dealId },
      });

      return NextResponse.json(
        { success: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (action === "accept") {
      await prisma.$transaction(async (tx) => {
        await tx.dealRequest.update({
          where: { id: dealId },
          data: { status: "accepted" },
        });

        await tx.marketListing.update({
          where: { id: deal.cardId },
          data: { status: "reserved" },
        });

        await tx.dealRequest.deleteMany({
          where: {
            cardId: deal.cardId,
            status: "pending",
            id: { not: dealId },
          },
        });

        await tx.marketHistory.create({
          data: {
            listingId: deal.cardId,
            action: "deal_accepted",
            detail: `Deal accepted for ${Number(deal.offeredPrice).toLocaleString()} THB`,
          },
        });
      });

      return NextResponse.json(
        { success: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { error: "action ไม่ถูกต้อง" },
      { status: 400 }
    );
  } catch (error) {
    console.error("DEAL ACTION ERROR:", error);
    return NextResponse.json(
      { error: "ทำรายการไม่สำเร็จ" },
      { status: 500 }
    );
  }
}