import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeCouponRecord } from "@/lib/coupon-utils";
import { isStaffRole } from "@/lib/staff-auth";

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
      return NextResponse.json({ error: "ไม่พบรหัสคูปอง" }, { status: 400 });
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
      return NextResponse.json({ error: "ไม่พบคูปอง" }, { status: 404 });
    }

    if (coupon.userId !== userId && !isStaffRole(role)) {
      return NextResponse.json(
        { error: "คุณไม่มีสิทธิ์ดูคูปองนี้" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      coupon: serializeCouponRecord(coupon),
    });
  } catch (error) {
    console.error("COUPON_DETAIL_ERROR", error);
    return NextResponse.json(
      { error: "โหลดคูปองไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
