import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const lineId = String(body?.lineId || "").trim();
    const rewardId = String(body?.rewardId || "").trim();
    const currency = String(body?.currency || "NEX").trim();

    if (!lineId || !rewardId) {
      return NextResponse.json(
        { success: false, error: "ข้อมูลไม่ครบ" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { lineId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "ไม่พบผู้ใช้งาน" },
        { status: 404 }
      );
    }

    const reward = await prisma.reward.findUnique({
      where: { id: rewardId },
    });

    if (!reward) {
      return NextResponse.json(
        { success: false, error: "ไม่พบรางวัล" },
        { status: 404 }
      );
    }

    if (reward.stock <= 0) {
      return NextResponse.json(
        { success: false, error: "รางวัลหมดแล้ว" },
        { status: 400 }
      );
    }

    if (currency === "NEX") {
      if (reward.nexCost == null || user.nexPoint < reward.nexCost) {
        return NextResponse.json(
          { success: false, error: "แต้ม NEX ไม่เพียงพอ" },
          { status: 400 }
        );
      }
    }

    if (currency === "COIN") {
      if (reward.coinCost == null || user.coin < reward.coinCost) {
        return NextResponse.json(
          { success: false, error: "เหรียญ COIN ไม่เพียงพอ" },
          { status: 400 }
        );
      }
    }

    const coupon = await prisma.$transaction(async (tx) => {
      if (currency === "NEX" && reward.nexCost != null) {
        await tx.user.update({
          where: { lineId },
          data: {
            nexPoint: {
              decrement: reward.nexCost,
            },
          },
        });
      }

      if (currency === "COIN" && reward.coinCost != null) {
        await tx.user.update({
          where: { lineId },
          data: {
            coin: {
              decrement: reward.coinCost,
            },
          },
        });
      }

      await tx.reward.update({
        where: { id: reward.id },
        data: {
          stock: {
            decrement: 1,
          },
        },
      });

      return tx.coupon.create({
        data: {
          code: `NXR-${Date.now()}`,
          userId: user.id,
          rewardId: reward.id,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "แลกรางวัลสำเร็จ",
      couponId: coupon.id,
      couponUrl: `/coupon/${coupon.code}`,
    });
  } catch (error) {
    console.error("REDEEM ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในระบบ",
      },
      { status: 500 }
    );
  }
}
