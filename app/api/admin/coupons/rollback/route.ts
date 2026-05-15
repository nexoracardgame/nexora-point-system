import { NextResponse } from "next/server";
import { requireAdminActor } from "@/lib/admin-auth";
import { ensureCouponRollbackSchema } from "@/lib/coupon-rollback-schema";
import { formatCouponValue, serializeCouponRecord } from "@/lib/coupon-utils";
import { writeCriticalBackup } from "@/lib/critical-backup";
import { prisma } from "@/lib/prisma";
import { createWalletReceivedNotification } from "@/lib/wallet-notification";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function getUnexpectedRollbackMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();

  if (normalized.includes("tls connection")) {
    return "เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณารีสตาร์ทแอปหรือเช็ก DATABASE_URL/TLS ของฐานข้อมูล";
  }

  if (normalized.includes("permission denied")) {
    return "ฐานข้อมูลไม่อนุญาตให้ปรับข้อมูล rollback กรุณาใช้บัญชีฐานข้อมูลที่มีสิทธิ์เขียน/แก้ schema";
  }

  if (
    normalized.includes("column") &&
    (normalized.includes("reversedat") ||
      normalized.includes("reversedbyid") ||
      normalized.includes("reversalreason"))
  ) {
    return "ฐานข้อมูลยังไม่มีคอลัมน์ rollback ของคูปอง กรุณารัน migration แล้วลองใหม่";
  }

  if (normalized.includes("criticalbackuplog")) {
    return "ย้อนกลับคูปองสำเร็จไม่ได้เพราะระบบ backup log มีปัญหา กรุณาลองใหม่หลังรีสตาร์ทแอป";
  }

  if (message.trim()) {
    return `ย้อนกลับคูปองไม่สำเร็จ: ${message.trim().slice(0, 180)}`;
  }

  return "ย้อนกลับคูปองไม่สำเร็จ";
}

export async function POST(req: Request) {
  try {
    const { actor, error } = await requireAdminActor();
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    const couponId = String(body?.couponId || "").trim();
    const code = String(body?.code || "").trim();

    if (!couponId && !code) {
      return NextResponse.json(
        { error: "กรุณาระบุคูปองที่ต้องการย้อนกลับ" },
        { status: 400 }
      );
    }

    await ensureCouponRollbackSchema();

    const result = await prisma.$transaction(async (tx) => {
      const beforeCoupon = await tx.coupon.findUnique({
        where: couponId ? { id: couponId } : { code },
        include: {
          user: {
            select: {
              id: true,
              lineId: true,
              name: true,
              displayName: true,
              image: true,
              nexPoint: true,
              coin: true,
            },
          },
          reward: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              nexCost: true,
              coinCost: true,
              stock: true,
            },
          },
        },
      });

      if (!beforeCoupon) {
        throw new Error("coupon_not_found");
      }

      if (beforeCoupon.reversedAt) {
        throw new Error("coupon_already_reversed");
      }

      if (beforeCoupon.used) {
        throw new Error("coupon_already_used");
      }

      const value = formatCouponValue(beforeCoupon.code, beforeCoupon.reward);

      if (!value.currency || value.amount == null || value.amount <= 0) {
        throw new Error("invalid_coupon_value");
      }

      const refundAmount =
        value.currency === "COIN" ? Math.round(value.amount) : Number(value.amount);

      if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
        throw new Error("invalid_coupon_value");
      }

      const reversedAt = new Date();
      const markResult = await tx.coupon.updateMany({
        where: {
          id: beforeCoupon.id,
          used: false,
          reversedAt: null,
        },
        data: {
          reversedAt,
          reversedById: actor?.id || null,
          reversalReason: "admin_coupon_rollback",
        },
      });

      if (markResult.count !== 1) {
        throw new Error("coupon_not_rollbackable");
      }

      const updatedUser = await tx.user.update({
        where: { id: beforeCoupon.user.id },
        data:
          value.currency === "NEX"
            ? {
                nexPoint: {
                  increment: refundAmount,
                },
              }
            : {
                coin: {
                  increment: Math.round(refundAmount),
                },
              },
        select: {
          id: true,
          lineId: true,
          name: true,
          image: true,
          nexPoint: true,
          coin: true,
        },
      });

      const updatedReward = await tx.reward.update({
        where: { id: beforeCoupon.reward.id },
        data: {
          stock: {
            increment: 1,
          },
        },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          nexCost: true,
          coinCost: true,
          stock: true,
        },
      });

      const pointLog = await tx.pointLog.create({
        data: {
          lineId: beforeCoupon.user.lineId,
          type:
            value.currency === "NEX"
              ? "coupon_rollback_nex"
              : "coupon_rollback_coin",
          amount: Math.round(refundAmount),
          point: value.currency === "NEX" ? refundAmount : 0,
        },
      });

      const updatedCoupon = await tx.coupon.findUnique({
        where: { id: beforeCoupon.id },
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

      if (!updatedCoupon) {
        throw new Error("coupon_not_found");
      }

      const backupInput = {
        scope: "coupon" as const,
        action: "coupon.rollback",
        actorUserId: actor?.id,
        targetUserId: beforeCoupon.user.id,
        entityType: "Coupon",
        entityId: beforeCoupon.id,
        beforeSnapshot: {
          coupon: beforeCoupon,
          user: beforeCoupon.user,
          reward: beforeCoupon.reward,
        },
        afterSnapshot: {
          coupon: updatedCoupon,
          user: updatedUser,
          reward: updatedReward,
          pointLog,
        },
        meta: {
          code: beforeCoupon.code,
          currency: value.currency,
          amount: refundAmount,
          rewardId: beforeCoupon.reward.id,
          source: "admin-coupon-rollback",
        },
      };

      return {
        coupon: updatedCoupon,
        refund: {
          currency: value.currency,
          amount: refundAmount,
          label: `${refundAmount.toLocaleString("th-TH")} ${value.currency}`,
        },
        balances: {
          nexPoint: Number(updatedUser.nexPoint || 0),
          coin: Number(updatedUser.coin || 0),
        },
        rewardStock: Number(updatedReward.stock || 0),
        notificationImage:
          beforeCoupon.reward.imageUrl || beforeCoupon.user.image || "/avatar.png",
        backupInput,
      };
    });

    await writeCriticalBackup(prisma, result.backupInput).catch((backupError) => {
      console.error("ADMIN_COUPON_ROLLBACK_BACKUP_ERROR", backupError);
    });

    await createWalletReceivedNotification({
      userId: result.coupon.user.id,
      asset: result.refund.currency,
      amount: result.refund.amount,
      image: result.notificationImage,
      source: "admin-coupon-rollback",
    });

    return NextResponse.json({
      success: true,
      message: `ย้อนกลับสำเร็จ คืน ${result.refund.label} และคืนสต๊อกแล้ว`,
      coupon: serializeCouponRecord(result.coupon),
      refund: result.refund,
      balances: result.balances,
      rewardStock: result.rewardStock,
    });
  } catch (error) {
    console.error("ADMIN_COUPON_ROLLBACK_ERROR", error);

    if (error instanceof Error) {
      if (error.message === "coupon_not_found") {
        return NextResponse.json(
          { error: "ไม่พบคูปองนี้ในระบบ" },
          { status: 404 }
        );
      }

      if (error.message === "coupon_already_reversed") {
        return NextResponse.json(
          { error: "รายการนี้ถูกย้อนกลับไปแล้ว" },
          { status: 409 }
        );
      }

      if (error.message === "coupon_already_used") {
        return NextResponse.json(
          { error: "คูปองนี้ถูกใช้งานแล้ว ไม่สามารถย้อนกลับได้" },
          { status: 409 }
        );
      }

      if (error.message === "coupon_not_rollbackable") {
        return NextResponse.json(
          { error: "รายการนี้ไม่อยู่ในสถานะที่ย้อนกลับได้แล้ว" },
          { status: 409 }
        );
      }

      if (error.message === "invalid_coupon_value") {
        return NextResponse.json(
          { error: "ไม่สามารถอ่านมูลค่าของคูปองนี้ได้" },
          { status: 400 }
        );
      }
    }

    const fallbackMessage = getUnexpectedRollbackMessage(error);
    return NextResponse.json(
      {
        error: fallbackMessage,
      },
      { status: 500 }
    );
  }
}
