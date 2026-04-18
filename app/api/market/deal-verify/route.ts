import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const currentUserId = String((session?.user as any)?.id || "");

    if (!currentUserId) {
      return NextResponse.json(
        { error: "ยังไม่ได้ล็อกอิน" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const dealId = String(body?.dealId || "").trim();
    const serialInput = String(body?.serialInput || "").trim().toLowerCase();

    if (!dealId || !serialInput) {
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

    if (deal.status !== "accepted") {
      return NextResponse.json(
        { error: "ดีลนี้ยังไม่พร้อมปิด" },
        { status: 400 }
      );
    }

    if (deal.buyerId !== currentUserId) {
      return NextResponse.json(
        { error: "เฉพาะผู้ซื้อเท่านั้น" },
        { status: 403 }
      );
    }

    const listing = await prisma.marketListing.findUnique({
      where: { id: deal.cardId },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "ไม่พบการ์ด" },
        { status: 404 }
      );
    }

    const dbSerial = String(listing.serialNo || "")
      .trim()
      .toLowerCase();

    if (!dbSerial || dbSerial !== serialInput) {
      return NextResponse.json(
        { error: "Serial ไม่ตรง ❌" },
        { status: 400 }
      );
    }

    // 🔥 TRANSACTION (กันซ้ำ + commit ชัวร์)
    await prisma.$transaction(async (tx) => {
      // กันยิงซ้ำ
      const fresh = await tx.marketListing.findUnique({
        where: { id: listing.id },
      });

      if (!fresh || fresh.status === "sold") {
        throw new Error("รายการนี้ถูกขายไปแล้ว");
      }

      await tx.marketListing.update({
        where: { id: listing.id },
        data: { status: "sold" },
      });

      await tx.marketHistory.create({
        data: {
          listingId: listing.id,
          action: "sold",
          detail: `Sold ${Number(deal.offeredPrice).toLocaleString()} THB`,
        },
      });

      await tx.dealRequest.updateMany({
        where: { cardId: listing.id },
        data: { status: "completed" },
      });
    });

    // 🔥 เคลียร์ cache ทุกหน้าที่เกี่ยวข้อง
    revalidatePath("/market/seller-center");
    revalidatePath("/market/deals");
    revalidatePath("/market");
    revalidatePath("/api/market/my-listings");

    return NextResponse.json({
      success: true,
      message: "ปิดดีลสำเร็จ",
    });

  } catch (error: any) {
    console.error("VERIFY ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "ระบบผิดพลาด" },
      { status: 500 }
    );
  }
}