import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminActor } from "@/lib/admin-auth";
import { writeCriticalBackup } from "@/lib/critical-backup";
import { createWalletReceivedNotification } from "@/lib/wallet-notification";

export async function POST(req: Request) {
  try {
    const { actor, error } = await requireAdminActor();
    if (error) return error;

    const { lineId, amount } = await req.json();
    const cleanLineId = String(lineId || "").trim();
    const nextAmount = Number(amount);

    if (
      !cleanLineId ||
      amount === undefined ||
      !Number.isFinite(nextAmount) ||
      !Number.isInteger(nextAmount) ||
      nextAmount === 0
    ) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const beforeUser = await tx.user.findUnique({
        where: { lineId: cleanLineId },
        select: {
          id: true,
          lineId: true,
          name: true,
          image: true,
          nexPoint: true,
          coin: true,
        },
      });

      if (!beforeUser) {
        throw new Error("user_not_found");
      }

      if (beforeUser.coin + nextAmount < 0) {
        throw new Error("insufficient_coin");
      }

      const updatedUser = await tx.user.update({
        where: { id: beforeUser.id },
        data: {
          coin: {
            increment: nextAmount,
          },
        },
      });

      await tx.pointLog.create({
        data: {
          lineId: cleanLineId,
          type: "admin_coin",
          amount: nextAmount,
          point: 0,
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

      return updatedUser;
    });

    if (nextAmount > 0) {
      await createWalletReceivedNotification({
        userId: updatedUser.id,
        asset: "COIN",
        amount: nextAmount,
        image: updatedUser.image,
        source: "admin-members-update-coin",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("UPDATE COIN ERROR:", error);

    if (error instanceof Error && error.message === "insufficient_coin") {
      return NextResponse.json(
        { error: "COIN ไม่พอให้หัก" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "update COIN failed" },
      { status: 500 }
    );
  }
}
