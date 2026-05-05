import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDealChatRoomId } from "@/lib/deal-chat";
import { cleanupDealChat } from "@/lib/deal-chat-cleanup";
import { publishDealEvent } from "@/lib/deal-events";
import { createLocalNotification } from "@/lib/local-notification-store";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseClient } from "@/lib/supabase-server";

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
    const action = String(body?.action || "").trim().toLowerCase();

    if (!dealId || !action) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
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

    if (deal.sellerId !== currentUserId) {
      return NextResponse.json(
        { error: "เฉพาะเจ้าของการ์ดเท่านั้น" },
        { status: 403 }
      );
    }

    const listing = await prisma.marketListing.findUnique({
      where: {
        id: deal.cardId,
      },
      select: {
        status: true,
      },
    });

    if (String(listing?.status || "").trim().toLowerCase() === "wanted") {
      return NextResponse.json(
        { error: "ดีลนี้เป็นโหมดรับซื้อ ให้จัดการจากหน้ารับซื้อ" },
        { status: 400 }
      );
    }

    if (action === "reject") {
      await cleanupDealChat(deal.id).catch(() => undefined);

      await createLocalNotification({
        userId: deal.buyer.id,
        type: "deal",
        title: `${deal.seller.displayName || deal.seller.name || "Seller"} ปฏิเสธคำขอดีล`,
        body: `ดีลของคุณไม่ได้รับการตอบรับ`,
        href: "/market/deals",
        image: deal.seller.image || "/avatar.png",
      });

      await prisma.dealRequest.delete({
        where: {
          id: deal.id,
        },
      });

      const changedAt = new Date().toISOString();
      publishDealEvent({
        dealId: deal.id,
        action: "rejected",
        changedAt,
      });

      return NextResponse.json(
        {
          success: true,
          action: "reject",
          removedDealId: deal.id,
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
      const updatedDeal = await prisma.dealRequest.update({
        where: {
          id: deal.id,
        },
        data: {
          status: "accepted",
        },
      });

      const supabase = getServerSupabaseClient();
      if (supabase) {
        try {
          await supabase.from("dm_room").upsert({
            roomid: getDealChatRoomId(deal.id),
            usera: deal.buyer.id,
            userb: deal.seller.id,
            useraname: deal.buyer.displayName || deal.buyer.name || "Buyer",
            useraimage: deal.buyer.image || "/avatar.png",
            userbname: deal.seller.displayName || deal.seller.name || "Seller",
            userbimage: deal.seller.image || "/avatar.png",
            updatedat: new Date().toISOString(),
          });
        } catch {}
      }

      await createLocalNotification({
        userId: deal.buyer.id,
        type: "deal",
        title: `${deal.seller.displayName || deal.seller.name || "Seller"} ตอบรับดีลของคุณ`,
        body: `พร้อมคุยต่อในห้องดีลแล้ว`,
        href: `/market/deals/chat/${deal.id}`,
        image: deal.seller.image || "/avatar.png",
      });

      const changedAt = new Date().toISOString();
      publishDealEvent({
        dealId: deal.id,
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

    return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
  } catch (error) {
    console.error("DEAL ACTION ERROR:", error);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
