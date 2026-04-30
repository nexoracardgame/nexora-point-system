import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeCouponRecord } from "@/lib/coupon-utils";
import { isStaffRole } from "@/lib/staff-auth";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
};

type RouteProps = {
  params: Promise<{
    code: string;
  }>;
};

export async function GET(_req: Request, { params }: RouteProps) {
  try {
    const session = await getServerSession(authOptions);
    const userId = String(
      (session?.user as { id?: string } | undefined)?.id || ""
    ).trim();
    const role = String(
      (session?.user as { role?: string } | undefined)?.role || ""
    ).trim();
    const { code } = await params;
    const safeCode = decodeURIComponent(String(code || "").trim());

    if (!safeCode) {
      return NextResponse.json(
        { error: "Coupon code is required" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const coupon = await prisma.coupon.findUnique({
      where: { code: safeCode },
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
    });

    if (!coupon) {
      return NextResponse.json(
        { error: "Coupon not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    if (coupon.userId !== userId && !isStaffRole(role)) {
      return NextResponse.json(
        { error: "You do not have permission to view this coupon" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        coupon: serializeCouponRecord(coupon),
        syncedAt: Date.now(),
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("COUPON_DETAIL_ERROR", error);

    return NextResponse.json(
      { error: "Failed to load coupon" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
