import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminActor } from "@/lib/admin-auth";
import { writeCriticalBackup } from "@/lib/critical-backup";
import { createWalletReceivedNotification } from "@/lib/wallet-notification";

function parseOptionalAmount(value: unknown, integerOnly = false) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) {
    return null;
  }

  if (integerOnly && !Number.isInteger(amount)) {
    throw new Error("invalid_coin");
  }

  return amount;
}

export async function POST(req: Request) {
  try {
    const { actor, error } = await requireAdminActor();
    if (error) return error;

    const { lineId, nexAmount, coinAmount } = await req.json();
    const cleanLineId = String(lineId || "").trim();
    const nextNexAmount = parseOptionalAmount(nexAmount);
    const nextCoinAmount = parseOptionalAmount(coinAmount, true);

    if (!cleanLineId || (nextNexAmount === null && nextCoinAmount === null)) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
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

      if (
        nextNexAmount !== null &&
        Number(beforeUser.nexPoint || 0) + nextNexAmount < 0
      ) {
        throw new Error("insufficient_nex");
      }

      if (
        nextCoinAmount !== null &&
        Number(beforeUser.coin || 0) + nextCoinAmount < 0
      ) {
        throw new Error("insufficient_coin");
      }

      const updateData: {
        nexPoint?: { increment: number };
        coin?: { increment: number };
      } = {};

      if (nextNexAmount !== null) {
        updateData.nexPoint = { increment: nextNexAmount };
      }

      if (nextCoinAmount !== null) {
        updateData.coin = { increment: nextCoinAmount };
      }

      const updatedUser = await tx.user.update({
        where: { id: beforeUser.id },
        data: updateData,
      });

      if (nextNexAmount !== null) {
        await tx.pointLog.create({
          data: {
            lineId: cleanLineId,
            type: "admin",
            amount: Math.trunc(nextNexAmount),
            point: nextNexAmount,
          },
        });
      }

      await writeCriticalBackup(tx, {
        scope: "wallet",
        action: "admin.wallet.adjust",
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
          nexAmount: nextNexAmount,
          coinAmount: nextCoinAmount,
          source: "admin-members-adjust-wallet",
        },
      });

      return {
        id: updatedUser.id,
        lineId: updatedUser.lineId,
        nexPoint: updatedUser.nexPoint,
        coin: updatedUser.coin,
        image: updatedUser.image,
      };
    });

    await Promise.all([
      nextNexAmount !== null && nextNexAmount > 0
        ? createWalletReceivedNotification({
            userId: result.id,
            asset: "NEX",
            amount: nextNexAmount,
            image: result.image,
            source: "admin-members-adjust-wallet",
          })
        : Promise.resolve(null),
      nextCoinAmount !== null && nextCoinAmount > 0
        ? createWalletReceivedNotification({
            userId: result.id,
            asset: "COIN",
            amount: nextCoinAmount,
            image: result.image,
            source: "admin-members-adjust-wallet",
          })
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      success: true,
      user: result,
      changes: {
        nexAmount: nextNexAmount,
        coinAmount: nextCoinAmount,
      },
    });
  } catch (error) {
    console.error("ADJUST WALLET ERROR:", error);

    if (error instanceof Error) {
      if (error.message === "insufficient_nex") {
        return NextResponse.json(
          { error: "NEX ไม่พอให้หัก" },
          { status: 400 }
        );
      }

      if (error.message === "insufficient_coin") {
        return NextResponse.json(
          { error: "COIN ไม่พอให้หัก" },
          { status: 400 }
        );
      }

      if (error.message === "invalid_coin") {
        return NextResponse.json(
          { error: "COIN ต้องเป็นจำนวนเต็ม เช่น 100 หรือ -100" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "อัปเดตแต้มไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
