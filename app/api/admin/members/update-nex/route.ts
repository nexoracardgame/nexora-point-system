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

    if (!cleanLineId || amount === undefined || !Number.isFinite(nextAmount) || nextAmount === 0) {
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

      if (beforeUser.nexPoint + nextAmount < 0) {
        throw new Error("insufficient_nex");
      }

      const updatedUser = await tx.user.update({
        where: { id: beforeUser.id },
        data: {
          nexPoint: {
            increment: nextAmount,
          },
        },
      });

      await tx.pointLog.create({
        data: {
          lineId: cleanLineId,
          type: "admin",
          amount: Math.trunc(nextAmount),
          point: nextAmount,
        },
      });

      await writeCriticalBackup(tx, {
        scope: "wallet",
        action: "admin.nex.adjust",
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
          asset: "NEX",
          amount: nextAmount,
          source: "admin-members-update-nex",
        },
      });

      return updatedUser;
    });

    if (nextAmount > 0) {
      await createWalletReceivedNotification({
        userId: updatedUser.id,
        asset: "NEX",
        amount: nextAmount,
        image: updatedUser.image,
        source: "admin-members-update-nex",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("UPDATE NEX ERROR:", error);

    if (error instanceof Error && error.message === "insufficient_nex") {
      return NextResponse.json(
        { error: "NEX ไม่พอให้หัก" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "update NEX failed" },
      { status: 500 }
    );
  }
}
