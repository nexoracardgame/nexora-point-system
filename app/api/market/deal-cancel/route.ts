import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cleanupDealChat } from "@/lib/deal-chat-cleanup";
import { deleteLocalDeal, getLocalDealById } from "@/lib/local-deal-store";
import { createLocalNotification } from "@/lib/local-notification-store";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const session = await getServerSession(authOptions);
    const currentUserId = String(session?.user?.id || "").trim();

    if (!currentUserId) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบ" },
        { status: 401 }
      );
    }

    const dealId = String(body?.dealId || "").trim();

    if (!dealId) {
      return NextResponse.json(
        { error: "ไม่พบ dealId" },
        { status: 400 }
      );
    }

    const localDeal = await getLocalDealById(dealId);

    // Treat missing deals as already removed so repeated clicks or stale tabs stay quiet.
    if (!localDeal) {
      return NextResponse.json(
        { success: true, alreadyRemoved: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const isParticipant =
      localDeal.buyerId === currentUserId ||
      localDeal.sellerId === currentUserId;

    if (!isParticipant) {
      return NextResponse.json(
        { error: "เฉพาะคนในดีลเท่านั้น" },
        { status: 403 }
      );
    }

    if (!["pending", "accepted"].includes(localDeal.status)) {
      return NextResponse.json(
        { success: true, alreadyRemoved: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const otherUserId =
      localDeal.buyerId === currentUserId
        ? localDeal.sellerId
        : localDeal.buyerId;
    const actorName =
      localDeal.buyerId === currentUserId
        ? localDeal.buyerName
        : localDeal.sellerName;
    const actorImage =
      localDeal.buyerId === currentUserId
        ? localDeal.buyerImage
        : localDeal.sellerImage;

    await deleteLocalDeal(localDeal.id);

    const sideEffects: Array<PromiseLike<unknown> | unknown> = [
      createLocalNotification({
        userId: otherUserId,
        type: "deal",
        title: `${actorName} ยกเลิกดีล`,
        body: `ดีลของ ${localDeal.cardName} ถูกยกเลิกแล้ว`,
        href: "/market/deals",
        image: actorImage,
      }),
    ];

    if (localDeal.status === "accepted") {
      sideEffects.push(cleanupDealChat(localDeal.id));
    }

    await Promise.allSettled(sideEffects);

    return NextResponse.json(
      {
        success: true,
        removedDealId: localDeal.id,
        changedAt: new Date().toISOString(),
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
