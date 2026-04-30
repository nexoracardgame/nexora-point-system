import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminActor } from "@/lib/admin-auth";
import { revalidateRewardSurfaces } from "@/lib/reward-cache";
import { writeCriticalBackup } from "@/lib/critical-backup";

export async function POST(req: Request) {
  try {
    const { actor, error } = await requireAdminActor();
    if (error) return error;

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ไม่พบ reward id" },
        { status: 400 }
      );
    }

    const affectedCoupons = await prisma.$transaction(async (tx) => {
      const beforeReward = await tx.reward.findUnique({
        where: { id },
      });

      if (!beforeReward) {
        throw new Error("reward_not_found");
      }

      const coupons = await tx.coupon.findMany({
        where: { rewardId: id },
        select: { id: true, code: true, userId: true, used: true, usedAt: true },
      });

      await tx.reward.delete({
        where: { id },
      });

      await writeCriticalBackup(tx, {
        scope: "reward",
        action: "reward.delete",
        actorUserId: actor?.id,
        entityType: "Reward",
        entityId: id,
        beforeSnapshot: {
          reward: beforeReward,
          coupons,
        },
        afterSnapshot: {},
        meta: {
          affectedCoupons: coupons.length,
          source: "admin-reward-delete",
        },
      });

      return coupons;
    });

    revalidateRewardSurfaces(affectedCoupons.map((coupon) => coupon.code));

    return NextResponse.json({
      success: true,
      affectedCoupons: affectedCoupons.length,
    });
  } catch (error) {
    console.error("DELETE REWARD ERROR:", error);

    return NextResponse.json(
      { error: "ลบรางวัลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
