import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminActor } from "@/lib/admin-auth";
import { writeCriticalBackup } from "@/lib/critical-backup";

export async function POST(req: Request) {
  try {
    const { actor, error } = await requireAdminActor();
    if (error) return error;

    const { lineId, amount } = await req.json();
    const nextAmount = Number(amount);

    if (!lineId || amount === undefined || !Number.isFinite(nextAmount)) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const beforeUser = await tx.user.findUnique({
        where: { lineId },
        select: {
          id: true,
          lineId: true,
          name: true,
          nexPoint: true,
          coin: true,
        },
      });

      if (!beforeUser) {
        throw new Error("user_not_found");
      }

      const updatedUser = await tx.user.update({
        where: { id: beforeUser.id },
        data: {
          coin: {
            increment: nextAmount,
          },
        },
      });

      await writeCriticalBackup(tx, {
        scope: "wallet",
        action: "admin.coin.adjust",
        actorUserId: actor?.id,
        targetUserId: beforeUser.id,
        entityType: "User",
        entityId: beforeUser.id,
        beforeSnapshot: {
          user: beforeUser,
        },
        afterSnapshot: {
          user: {
            id: updatedUser.id,
            lineId: updatedUser.lineId,
            nexPoint: updatedUser.nexPoint,
            coin: updatedUser.coin,
            name: updatedUser.name,
          },
        },
        meta: {
          asset: "COIN",
          amount: nextAmount,
          source: "admin-members-update-coin",
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("UPDATE COIN ERROR:", error);

    return NextResponse.json(
      { error: "update COIN failed" },
      { status: 500 }
    );
  }
}
