import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cleanupDealChat } from "@/lib/deal-chat-cleanup";
import { getLocalDealById, updateLocalDealStatus } from "@/lib/local-deal-store";
import { createLocalNotification } from "@/lib/local-notification-store";
import { updateLocalMarketListingStatus } from "@/lib/local-market-store";

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

  const localDeal = await getLocalDealById(dealId);

  if (!localDeal) {
    return NextResponse.json({ error: "ไม่พบดีล" }, { status: 404 });
  }

  if (localDeal.buyerId !== currentUserId) {
    return NextResponse.json({ error: "เฉพาะผู้ซื้อเท่านั้น" }, { status: 403 });
  }

  if (localDeal.status !== "accepted") {
    return NextResponse.json({ error: "ดีลนี้ยังไม่พร้อมปิด" }, { status: 400 });
  }

  const localSerial = String(localDeal.serialNo || "").trim().toLowerCase();

  if (!localSerial || localSerial !== serialInput) {
    return NextResponse.json({ error: "Serial ไม่ตรง" }, { status: 400 });
  }

  await updateLocalDealStatus(localDeal.id, "completed");
  await updateLocalMarketListingStatus(localDeal.cardId, "sold");
  await cleanupDealChat(localDeal.id);

  await createLocalNotification({
    userId: localDeal.sellerId,
    type: "deal",
    title: `${localDeal.buyerName} ยืนยันรับการ์ดแล้ว`,
    body: `${localDeal.cardName} ปิดดีลสำเร็จที่ ฿${Number(localDeal.offeredPrice).toLocaleString("th-TH")}`,
    href: "/market/deals",
    image: localDeal.buyerImage,
  });

  revalidatePath("/market/seller-center");
  revalidatePath("/market/deals");
  revalidatePath("/market");

  return NextResponse.json({
    success: true,
    message: "ปิดดีลสำเร็จ",
  });
}
