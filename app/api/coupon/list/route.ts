import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeCouponRecord } from "@/lib/coupon-utils";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = String(
      (session?.user as { id?: string } | undefined)?.id || ""
    ).trim();

    if (!userId) {
      return NextResponse.json(
        { coupons: [] },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const coupons = await prisma.coupon.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            lineId: true,
            name: true,
            displayName: true,
            image: true,
          },
        },
        reward: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            nexCost: true,
            coinCost: true,
          },
        },
      },
      orderBy: [{ used: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(
      {
        coupons: coupons.map(serializeCouponRecord),
        syncedAt: Date.now(),
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("COUPON_LIST_ERROR", error);
    return NextResponse.json(
      { coupons: [], error: "โหลดคูปองไม่สำเร็จ" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
