import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { publishDealEvent } from "@/lib/deal-events";
import { cleanupDealChat } from "@/lib/deal-chat-cleanup";
import { createLocalNotification } from "@/lib/local-notification-store";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const session = await getServerSession(authOptions);
    const currentUserId = String(session?.user?.id || "").trim();

    if (!currentUserId) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const dealId = String(body?.dealId || "").trim();

    if (!dealId) {
      return NextResponse.json({ error: "ไม่พบ dealId" }, { status: 400 });
    }

    const deal = await prisma.dealRequest.findUnique({
      where: {
        id: dealId,
      },
      include: {
        buyer: {
          select: {
            id: true,
            displayName: true,
            name: true,
            image: true,
          },
        },
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

    if (!deal) {
      return NextResponse.json(
        { success: true, alreadyRemoved: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const isParticipant =
      deal.buyer.id === currentUserId || deal.seller.id === currentUserId;

    if (!isParticipant) {
      return NextResponse.json(
        { error: "เฉพาะคนในดีลเท่านั้น" },
        { status: 403 }
      );
    }

    if (!["pending", "accepted"].includes(deal.status)) {
      return NextResponse.json(
        { success: true, alreadyRemoved: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const otherUserId =
      deal.buyer.id === currentUserId ? deal.seller.id : deal.buyer.id;
    const actorName =
      deal.buyer.id === currentUserId
        ? deal.buyer.displayName || deal.buyer.name || "User"
        : deal.seller.displayName || deal.seller.name || "User";
    const actorImage =
      deal.buyer.id === currentUserId
        ? deal.buyer.image || "/avatar.png"
        : deal.seller.image || "/avatar.png";

    await prisma.dealRequest.delete({
      where: {
        id: deal.id,
      },
    });

    const sideEffects: Array<PromiseLike<unknown> | unknown> = [
      createLocalNotification({
        userId: otherUserId,
        type: "deal",
        title: `${actorName} ยกเลิกดีล`,
        body: `ดีลถูกยกเลิกแล้ว`,
        href: "/market/deals",
        image: actorImage,
      }),
    ];

    if (deal.status === "accepted") {
      sideEffects.push(cleanupDealChat(deal.id));
    }

    await Promise.allSettled(sideEffects);

    const changedAt = new Date().toISOString();
    publishDealEvent({
      dealId: deal.id,
      action: "cancelled",
      changedAt,
    });

    return NextResponse.json(
      {
        success: true,
        removedDealId: deal.id,
        changedAt,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("DEAL CANCEL ERROR:", error);

    return NextResponse.json(
      { error: "ยกเลิกดีลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
