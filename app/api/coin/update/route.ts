import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLocalNotification } from "@/lib/local-notification-store";
import { requireAdminActor } from "@/lib/admin-auth";
import { writeCriticalBackup } from "@/lib/critical-backup";

export async function POST(req: Request) {
  try {
    const { actor, error } = await requireAdminActor();
    if (error) return error;

    const body = await req.json();
    const { lineId, amount, action } = body;

    if (!lineId || typeof amount !== "number" || !action) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ครบ" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "จำนวนต้องมากกว่า 0" },
        { status: 400 }
      );
    }

    if (!["add", "subtract"].includes(action)) {
      return NextResponse.json(
        { error: "action ไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { lineId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "ไม่พบผู้ใช้งาน" },
        { status: 404 }
      );
    }

    if (action === "subtract" && user.coin < amount) {
      return NextResponse.json(
        { error: "coin ไม่พอให้หัก" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const beforeUser = await tx.user.findUnique({
        where: { lineId },
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

      if (action === "subtract" && beforeUser.coin < amount) {
        throw new Error("insufficient_coin");
      }

      const nextUser = await tx.user.update({
        where: { id: beforeUser.id },
        data: {
          coin: action === "add" ? beforeUser.coin + amount : beforeUser.coin - amount,
        },
      });

      await writeCriticalBackup(tx, {
        scope: "wallet",
        action: `coin.${action}`,
        actorUserId: actor?.id,
        targetUserId: beforeUser.id,
        entityType: "User",
        entityId: beforeUser.id,
        beforeSnapshot: {
          user: beforeUser,
        },
        afterSnapshot: {
          user: {
            id: nextUser.id,
            lineId: nextUser.lineId,
            nexPoint: nextUser.nexPoint,
            coin: nextUser.coin,
            name: nextUser.name,
          },
        },
        meta: {
          asset: "COIN",
          amount,
          action,
          source: "coin-update",
        },
      });

      return nextUser;
    });

    await createLocalNotification({
      userId: updatedUser.id,
      type: "wallet",
      title:
        action === "add"
          ? `ได้รับ ${amount.toLocaleString("th-TH")} COIN`
          : `ใช้ ${amount.toLocaleString("th-TH")} COIN`,
      body:
        action === "add"
          ? "ยอด COIN ถูกเพิ่มเข้ากระเป๋าแล้ว"
          : "ยอด COIN ถูกหักจากกระเป๋าแล้ว",
      href: "/wallet",
      image: updatedUser.image || "/avatar.png",
      meta: {
        asset: "COIN",
        amount,
        action,
        source: "coin-update",
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "อัปเดต coin ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
