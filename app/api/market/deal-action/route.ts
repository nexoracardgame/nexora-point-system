import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { publishDealEvent } from "@/lib/deal-events";
import {
  deleteLocalDeal,
  getLocalDealById,
  updateLocalDealStatus,
} from "@/lib/local-deal-store";
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
    const action = String(body?.action || "").trim().toLowerCase();

    if (!dealId || !action) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }

    const localDeal = await getLocalDealById(dealId);

    if (!localDeal) {
      return NextResponse.json(
        { success: true, alreadyRemoved: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (localDeal.sellerId !== currentUserId) {
      return NextResponse.json(
        { error: "เฉพาะเจ้าของการ์ดเท่านั้น" },
        { status: 403 }
      );
    }

    if (action === "reject") {
      await createLocalNotification({
        userId: localDeal.buyerId,
        type: "deal",
        title: `${localDeal.sellerName} ปฏิเสธคำขอดีล`,
        body: `${localDeal.cardName} ไม่ได้รับการตอบรับ`,
        href: "/market/deals",
        image: localDeal.sellerImage,
      });

      await deleteLocalDeal(localDeal.id);

      const changedAt = new Date().toISOString();
      publishDealEvent({
        dealId: localDeal.id,
        action: "rejected",
        changedAt,
      });

      return NextResponse.json(
        {
          success: true,
          action: "reject",
          removedDealId: localDeal.id,
          changedAt,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    if (action === "accept") {
      const updatedDeal = await updateLocalDealStatus(localDeal.id, "accepted");

      await createLocalNotification({
        userId: localDeal.buyerId,
        type: "deal",
        title: `${localDeal.sellerName} ตอบรับดีลของคุณ`,
        body: `${localDeal.cardName} พร้อมคุยต่อในห้องดีลแล้ว`,
        href: `/market/deals/chat/${localDeal.id}`,
        image: localDeal.sellerImage,
      });

      const changedAt = new Date().toISOString();
      publishDealEvent({
        dealId: localDeal.id,
        action: "accepted",
        changedAt,
      });

      return NextResponse.json(
        {
          success: true,
          action: "accept",
          deal: updatedDeal,
          changedAt,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    return NextResponse.json(
      { error: "action ไม่ถูกต้อง" },
      { status: 400 }
    );
  } catch (error) {
    console.error("DEAL ACTION ERROR:", error);

    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
