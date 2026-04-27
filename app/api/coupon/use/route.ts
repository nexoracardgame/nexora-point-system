import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeCouponRecord } from "@/lib/coupon-utils";
import { isStaffRole } from "@/lib/staff-auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = String(
      (session?.user as { role?: string } | undefined)?.role || ""
    ).trim();

    if (!isStaffRole(role)) {
      return NextResponse.json(
        { error: "เฉพาะ staff หรือ admin เท่านั้นที่ยืนยันคูปองได้" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const code = String(body?.code || "").trim();

    if (!code) {
      return NextResponse.json(
        { error: "กรุณากรอกรหัสคูปอง" },
        { status: 400 }
      );
    }

    const coupon = await prisma.coupon.findUnique({
      where: { code },
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
        { error: "ไม่พบคูปองนี้ในระบบ" },
        { status: 404 }
      );
    }

    if (coupon.used) {
      return NextResponse.json(
        {
          error: "คูปองใบนี้ถูกใช้งานไปแล้ว",
          coupon: serializeCouponRecord(coupon),
        },
        { status: 409 }
      );
    }

    const usedCoupon = await prisma.coupon.update({
      where: { id: coupon.id },
      data: {
        used: true,
        usedAt: new Date(),
      },
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

    return NextResponse.json({
      success: true,
      message: "ยืนยันใช้คูปองสำเร็จ",
      coupon: serializeCouponRecord(usedCoupon),
    });
  } catch (error) {
    console.error("COUPON_USE_ERROR", error);

    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดระหว่างยืนยันคูปอง" },
      { status: 500 }
    );
  }
}
