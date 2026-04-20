import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { publishDealEvent } from "@/lib/deal-events";
import { cleanupDealChat } from "@/lib/deal-chat-cleanup";
import { createLocalNotification } from "@/lib/local-notification-store";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const session = await getServerSession(authOptions);
  const currentUserId = String(session?.user?.id || "").trim();

  if (!currentUserId) {
    return NextResponse.json({ error: "ยังไม่ได้ล็อกอิน" }, { status: 401 });
  }

  const dealId = String(body?.dealId || "").trim();
  const serialInput = String(body?.serialInput || "").trim().toLowerCase();

  if (!dealId || !serialInput) {
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
    return NextResponse.json({ error: "ไม่พบดีล" }, { status: 404 });
  }

  if (deal.buyer.id !== currentUserId) {
    return NextResponse.json({ error: "เฉพาะผู้ซื้อเท่านั้น" }, { status: 403 });
  }

  if (deal.status !== "accepted") {
    return NextResponse.json({ error: "ดีลนี้ยังไม่พร้อมปิด" }, { status: 400 });
  }

  const listing = await prisma.marketListing.findUnique({
    where: {
      id: deal.cardId,
    },
    select: {
      id: true,
      serialNo: true,
    },
  });

  const localSerial = String(listing?.serialNo || "").trim().toLowerCase();

  if (!localSerial || localSerial !== serialInput) {
    return NextResponse.json({ error: "Serial ไม่ตรง" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.dealRequest.update({
      where: {
        id: deal.id,
      },
      data: {
        status: "completed",
      },
    }),
    prisma.marketListing.update({
      where: {
        id: deal.cardId,
      },
      data: {
        status: "sold",
      },
    }),
  ]);

  await cleanupDealChat(deal.id);

  await createLocalNotification({
    userId: deal.seller.id,
    type: "deal",
    title: `${deal.buyer.displayName || deal.buyer.name || "Buyer"} ยืนยันรับการ์ดแล้ว`,
    body: `ปิดดีลสำเร็จที่ ฿${Number(deal.offeredPrice).toLocaleString("th-TH")}`,
    href: "/market/deals",
    image: deal.buyer.image || "/avatar.png",
  });

  revalidatePath("/market/seller-center");
  revalidatePath("/market/deals");
  revalidatePath("/market");

  publishDealEvent({
    dealId: deal.id,
    action: "completed",
    changedAt: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    message: "ปิดดีลสำเร็จ",
  });
}
