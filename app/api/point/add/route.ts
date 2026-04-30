import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { createLocalNotification } from "@/lib/local-notification-store";
import { requireStaffActor } from "@/lib/admin-auth";
import { writeCriticalBackup } from "@/lib/critical-backup";

export async function POST(req: Request) {
  try {
    const { actor, error } = await requireStaffActor();
    if (error) return error;

    const body = await req.json();
    const rawLineId = body.lineId;
    const rawType = body.type;
    const rawAmount = body.amount;

    const lineId = String(rawLineId || "").trim();
    const type = String(rawType || "").toLowerCase().trim();
    const qty = Number(rawAmount);

    if (!lineId || !type || !qty) {
      return NextResponse.json(
        { success: false, message: "ข้อมูลไม่ครบ" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json(
        { success: false, message: "จำนวนไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    if (!["bronze", "silver", "gold"].includes(type)) {
      return NextResponse.json(
        { success: false, message: "ประเภทการ์ดไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const foundUser = await prisma.user.findUnique({
      where: { lineId },
    });

    if (!foundUser) {
      return NextResponse.json(
        { success: false, message: "ไม่พบผู้ใช้" },
        { status: 404 }
      );
    }

    let point = 0;
    if (type === "bronze") point = 0.5 * qty;
    if (type === "silver") point = 1 * qty;
    if (type === "gold") point = 2 * qty;

    const result = await prisma.$transaction(async (tx: any) => {
      const beforeUser = await tx.user.findUnique({
        where: { lineId },
        select: {
          id: true,
          lineId: true,
          nexPoint: true,
          coin: true,
          name: true,
        },
      });

      if (!beforeUser) {
        throw new Error("user_not_found");
      }

      const user = await tx.user.update({
        where: { id: beforeUser.id },
        data: {
          nexPoint: {
            increment: point,
          },
        },
      });

      await tx.pointLog.create({
        data: {
          lineId,
          type,
          amount: qty,
          point,
        },
      });

      await writeCriticalBackup(tx, {
        scope: "wallet",
        action: "point.add",
        actorUserId: actor?.id,
        targetUserId: beforeUser.id,
        entityType: "User",
        entityId: beforeUser.id,
        beforeSnapshot: {
          user: beforeUser,
        },
        afterSnapshot: {
          user: {
            id: user.id,
            lineId: user.lineId,
            nexPoint: user.nexPoint,
            coin: user.coin,
            name: user.name,
          },
        },
        meta: {
          asset: "NEX",
          lineId,
          type,
          amount: qty,
          point,
          source: "point-add",
        },
      });

      return user;
    });

    await createLocalNotification({
      userId: result.id,
      type: "wallet",
      title: `ได้รับ ${point.toLocaleString("th-TH")} NEX`,
      body: `จากการสแกนการ์ด ${type.toUpperCase()} จำนวน ${qty}`,
      href: "/wallet",
      image: result.image || "/avatar.png",
      meta: {
        asset: "NEX",
        amount: point,
        source: "point-add",
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      message: "เพิ่มแต้มสำเร็จ",
      newPoint: result.nexPoint,
    });
  } catch (error) {
    console.error("ADD POINT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
      },
      { status: 500 }
    );
  }
}
