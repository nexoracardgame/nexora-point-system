import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildCouponCode, serializeCouponRecord } from "@/lib/coupon-utils";
import { prisma } from "@/lib/prisma";
import { createLocalNotification } from "@/lib/local-notification-store";
import { writeCriticalBackup } from "@/lib/critical-backup";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = String(
      (session?.user as { id?: string } | undefined)?.id || ""
    ).trim();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "กรุณาเข้าสู่ระบบก่อน" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const rewardId = String(body?.rewardId || "").trim();
    const currency = String(body?.currency || "").trim().toUpperCase();

    if (!rewardId || (currency !== "NEX" && currency !== "COIN")) {
      return NextResponse.json(
        { success: false, error: "ข้อมูลการแลกไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const redeemed = await prisma.$transaction(async (tx) => {
      const [user, reward] = await Promise.all([
        tx.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            lineId: true,
            nexPoint: true,
            coin: true,
          },
        }),
        tx.reward.findUnique({
          where: { id: rewardId },
          select: {
            id: true,
            name: true,
            stock: true,
            nexCost: true,
            coinCost: true,
          },
        }),
      ]);

      if (!user) {
        throw new Error("ไม่พบผู้ใช้");
      }

      if (!reward) {
        throw new Error("ไม่พบรางวัล");
      }

      if (reward.stock <= 0) {
        throw new Error("รางวัลชิ้นนี้หมดแล้ว");
      }

      const amount =
        currency === "NEX" ? Number(reward.nexCost) : Number(reward.coinCost);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(
          currency === "NEX"
            ? "รางวัลนี้ไม่รองรับการแลกด้วย NEX"
            : "รางวัลนี้ไม่รองรับการแลกด้วย COIN"
        );
      }

      if (currency === "NEX" && Number(user.nexPoint || 0) < amount) {
        throw new Error("แต้ม NEX ไม่เพียงพอ");
      }

      if (currency === "COIN" && Number(user.coin || 0) < amount) {
        throw new Error("เหรียญ COIN ไม่เพียงพอ");
      }

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data:
          currency === "NEX"
            ? {
                nexPoint: {
                  decrement: amount,
                },
              }
            : {
                coin: {
                  decrement: Math.round(amount),
                },
              },
      });

      const updatedReward = await tx.reward.update({
        where: { id: reward.id },
        data: {
          stock: {
            decrement: 1,
          },
        },
      });

      const coupon = await tx.coupon.create({
        data: {
          code: buildCouponCode(currency as "NEX" | "COIN", amount),
          userId: user.id,
          rewardId: reward.id,
        },
        select: {
          id: true,
          code: true,
          userId: true,
          rewardId: true,
          used: true,
          createdAt: true,
        },
      });

      await writeCriticalBackup(tx, {
        scope: "reward",
        action: "reward.redeem",
        actorUserId: user.id,
        targetUserId: user.id,
        entityType: "Coupon",
        entityId: coupon.id,
        beforeSnapshot: {
          user,
          reward,
        },
        afterSnapshot: {
          user: {
            id: updatedUser.id,
            lineId: updatedUser.lineId,
            nexPoint: updatedUser.nexPoint,
            coin: updatedUser.coin,
          },
          reward: {
            id: updatedReward.id,
            name: updatedReward.name,
            stock: updatedReward.stock,
            nexCost: updatedReward.nexCost,
            coinCost: updatedReward.coinCost,
          },
          coupon,
        },
        meta: {
          currency,
          amount,
          rewardId: reward.id,
          source: "reward-redeem",
        },
      });

      return {
        coupon,
        balances: {
          nexPoint:
            currency === "NEX"
              ? Math.max(0, Number(user.nexPoint || 0) - amount)
              : Number(user.nexPoint || 0),
          coin:
            currency === "COIN"
              ? Math.max(0, Number(user.coin || 0) - amount)
              : Number(user.coin || 0),
        },
        rewardStock: Math.max(0, Number(reward.stock || 0) - 1),
      };
    });

    const coupon = await prisma.coupon.findUnique({
      where: { id: redeemed.coupon.id },
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

    await createLocalNotification({
      userId,
      type: "wallet",
      title: "แลกรางวัลสำเร็จ",
      body: coupon?.reward?.name
        ? `ได้รับคูปอง ${coupon.reward.name}`
        : "คูปองใหม่ถูกสร้างใน Redeem แล้ว",
      href: `/redeem?open=${encodeURIComponent(redeemed.coupon.code)}`,
      image: coupon?.reward?.imageUrl || "/avatar.png",
      meta: {
        source: "reward-redeem",
        couponCode: redeemed.coupon.code,
        rewardName: coupon?.reward?.name || null,
        currency,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      message: "แลกรางวัลสำเร็จ",
      couponId: redeemed.coupon.id,
      couponCode: redeemed.coupon.code,
      couponUrl: `/redeem?open=${encodeURIComponent(redeemed.coupon.code)}`,
      coupon: coupon ? serializeCouponRecord(coupon) : null,
      balances: redeemed.balances,
      rewardStock: redeemed.rewardStock,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "เกิดข้อผิดพลาดในระบบ";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 400 }
    );
  }
}
