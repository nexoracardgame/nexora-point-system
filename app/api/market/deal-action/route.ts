import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
        { error: "เธเธฃเธธเธ“เธฒเน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธ" },
        { status: 401 }
      );
    }

    const dealId = String(body?.dealId || "").trim();
    const action = String(body?.action || "").trim().toLowerCase();

    if (!dealId || !action) {
      return NextResponse.json(
        { error: "เธเนเธญเธกเธนเธฅเนเธกเนเธเธฃเธ" },
        { status: 400 }
      );
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
        { error: "เน€เธเธเธฒเธฐเน€เธเนเธฒเธเธญเธเธเธฒเธฃเนเธ”เน€เธ—เนเธฒเธเธฑเนเธ" },
        { status: 403 }
      );
    }

    if (action === "reject") {
      await createLocalNotification({
        userId: localDeal.buyerId,
        type: "deal",
        title: `${localDeal.sellerName} เธเธเธดเน€เธชเธเธเธณเธเธญเธ”เธตเธฅ`,
        body: `${localDeal.cardName} เนเธกเนเนเธ”เนเธฃเธฑเธเธเธฒเธฃเธ•เธญเธเธฃเธฑเธ`,
        href: "/market/deals",
        image: localDeal.sellerImage,
      });

      await deleteLocalDeal(localDeal.id);

      return NextResponse.json(
        {
          success: true,
          action: "reject",
          removedDealId: localDeal.id,
          changedAt: new Date().toISOString(),
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
        title: `${localDeal.sellerName} เธ•เธญเธเธฃเธฑเธเธ”เธตเธฅเธเธญเธเธเธธเธ“`,
        body: `${localDeal.cardName} เธเธฃเนเธญเธกเธเธธเธขเธ•เนเธญเนเธเธซเนเธญเธเธ”เธตเธฅเนเธฅเนเธง`,
        href: `/market/deals/chat/${localDeal.id}`,
        image: localDeal.sellerImage,
      });

      return NextResponse.json(
        {
          success: true,
          action: "accept",
          deal: updatedDeal,
          changedAt: new Date().toISOString(),
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    return NextResponse.json(
      { error: "action เนเธกเนเธ–เธนเธเธ•เนเธญเธ" },
      { status: 400 }
    );
  } catch (error) {
    console.error("DEAL ACTION ERROR:", error);

    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
