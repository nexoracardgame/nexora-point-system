import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawLineId = body.lineId;
    const rawRewardId = body.rewardId;
    const rawCurrency = body.currency;

    const lineId = String(rawLineId || "").trim();
    const rewardId = String(rawRewardId || "").trim();
    const currency = String(rawCurrency || "NEX").trim();

    if (!lineId || !rewardId) {
      return NextResponse.json(
        { success: false, message: "ข้อมูลไม่ครบ" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { lineId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "ไม่พบผู้ใช้" },
        { status: 404 }
      );
    }

    const reward = await prisma.reward.findUnique({
      where: { id: rewardId },
    });

    if (!reward) {
      return NextResponse.json(
        { success: false, message: "ไม่พบของรางวัล" },
        { status: 404 }
      );
    }

    if (reward.stock <= 0) {
      return NextResponse.json(
        { success: false, message: "ของรางวัลหมด" },
        { status: 400 }
      );
    }

    // เช็คแต้มตาม currency
    if (currency === "NEX") {
      if (
        reward.nexCost == null ||
        user.nexPoint < reward.nexCost
      ) {
        return NextResponse.json(
          { success: false, message: "แต้ม NEX ไม่พอ" },
          { status: 400 }
        );
      }
    }

    if (currency === "COIN") {
      if (
        reward.coinCost == null ||
        user.coin < reward.coinCost
      ) {
        return NextResponse.json(
          { success: false, message: "เหรียญไม่พอ" },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx: any) => {
      if (currency === "NEX") {
        await tx.user.update({
          where: { lineId },
          data: {
            nexPoint: {
              decrement: reward.nexCost,
            },
          },
        });
      }

      if (currency === "COIN") {
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

      const coupon = await tx.coupon.create({
        data: {
          code: `NXR-${Date.now()}`,
          userId: user.id,
          rewardId: reward.id,
        },
      });

      return coupon;
    });

    return NextResponse.json({
      success: true,
      message: "แลกรางวัลสำเร็จ",
      couponId: result.id,
    });
  } catch (error) {
    console.error("REDEEM ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
      },
      { status: 500 }
    );
  }
}