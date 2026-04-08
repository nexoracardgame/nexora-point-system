import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: "กรุณาระบุ code" },
        { status: 400 }
      );
    }

    const coupon = await prisma.coupon.findUnique({
      where: { code },
      include: {
        reward: true,
        user: true,
      },
    });

    if (!coupon) {
      return NextResponse.json(
        { error: "ไม่พบคูปอง" },
        { status: 404 }
      );
    }

    if (coupon.used) {
      return NextResponse.json(
        {
          error: "คูปองนี้ถูกใช้ไปแล้ว",
          coupon: {
            code: coupon.code,
            rewardName: coupon.reward.name,
            userName: coupon.user.name || coupon.user.lineId,
            used: coupon.used,
            usedAt: coupon.usedAt,
          },
        },
        { status: 400 }
      );
    }

    const updated = await prisma.coupon.update({
      where: { code },
      data: {
        used: true,
        usedAt: new Date(),
      },
      include: {
        reward: true,
        user: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "ใช้คูปองสำเร็จ",
      coupon: {
        code: updated.code,
        rewardName: updated.reward.name,
        userName: updated.user.name || updated.user.lineId,
        used: updated.used,
        usedAt: updated.usedAt,
      },
    });
  } catch (error) {
    console.error("COUPON_USE_ERROR:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ" },
      { status: 500 }
    );
  }
}