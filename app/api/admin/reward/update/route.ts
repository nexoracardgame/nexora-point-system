import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateRewardSurfaces } from "@/lib/reward-cache";
import { stampRewardImageUrl } from "@/lib/reward-image";
import {
  requireAdminActor,
  sanitizeNullableUrl,
  toNonNegativeInt,
  toNullableNonNegativeNumber,
} from "@/lib/admin-auth";
import { writeCriticalBackup } from "@/lib/critical-backup";

export async function POST(req: Request) {
  try {
    const { actor, error } = await requireAdminActor();
    if (error) return error;

    const body = await req.json();
    const { id, name, imageUrl, nexCost, coinCost, stock } = body;
    const imageVersion = Date.now();
    const sanitizedImageUrl = sanitizeNullableUrl(imageUrl);

    if (!id) {
      return NextResponse.json(
        { error: "ไม่พบ reward id" },
        { status: 400 }
      );
    }

    const { reward, affectedCoupons } = await prisma.$transaction(async (tx) => {
      const beforeReward = await tx.reward.findUnique({
        where: { id },
      });

      if (!beforeReward) {
        throw new Error("reward_not_found");
      }

      const updatedReward = await tx.reward.update({
        where: { id },
        data: {
          ...(String(name || "").trim()
            ? { name: String(name || "").trim() }
            : {}),
          imageUrl: sanitizedImageUrl
            ? stampRewardImageUrl(sanitizedImageUrl, imageVersion)
            : null,
          nexCost: toNullableNonNegativeNumber(nexCost),
          coinCost: toNullableNonNegativeNumber(coinCost),
          stock: toNonNegativeInt(stock),
        },
      });

      const coupons = await tx.coupon.findMany({
        where: { rewardId: id },
        select: { id: true, code: true, userId: true, used: true, usedAt: true },
      });

      await writeCriticalBackup(tx, {
        scope: "reward",
        action: "reward.update",
        actorUserId: actor?.id,
        entityType: "Reward",
        entityId: id,
        beforeSnapshot: {
          reward: beforeReward,
          coupons,
        },
        afterSnapshot: {
          reward: updatedReward,
          coupons,
        },
        meta: {
          affectedCoupons: coupons.length,
          imageVersion,
          source: "admin-reward-update",
        },
      });

      return {
        reward: updatedReward,
        affectedCoupons: coupons,
      };
    });

    revalidateRewardSurfaces(affectedCoupons.map((coupon) => coupon.code));

    return NextResponse.json({
      success: true,
      reward,
      imageVersion,
      affectedCoupons: affectedCoupons.length,
    });
  } catch (error) {
    console.error("UPDATE REWARD ERROR:", error);

    return NextResponse.json(
      { error: "อัปเดตรางวัลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
