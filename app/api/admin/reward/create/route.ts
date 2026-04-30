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
    const { name, imageUrl, nexCost, coinCost, stock } = body;
    const safeName = String(name || "").trim();
    const sanitizedImageUrl = sanitizeNullableUrl(imageUrl);

    if (!safeName) {
      return NextResponse.json({ error: "กรุณากรอกชื่อรางวัล" }, { status: 400 });
    }

    const reward = await prisma.$transaction(async (tx) => {
      const createdReward = await tx.reward.create({
        data: {
          name: safeName,
          imageUrl: sanitizedImageUrl
            ? stampRewardImageUrl(sanitizedImageUrl)
            : null,
          nexCost: toNullableNonNegativeNumber(nexCost),
          coinCost: toNullableNonNegativeNumber(coinCost),
          stock: toNonNegativeInt(stock),
        },
      });

      await writeCriticalBackup(tx, {
        scope: "reward",
        action: "reward.create",
        actorUserId: actor?.id,
        entityType: "Reward",
        entityId: createdReward.id,
        beforeSnapshot: {},
        afterSnapshot: {
          reward: createdReward,
        },
        meta: {
          source: "admin-reward-create",
        },
      });

      return createdReward;
    });

    revalidateRewardSurfaces();

    return NextResponse.json({ success: true, reward });
  } catch (error) {
    console.error("CREATE REWARD ERROR:", error);

    return NextResponse.json(
      { error: "สร้างของรางวัลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
