import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCouponRollbackSchema } from "@/lib/coupon-rollback-schema";
import { serializeCouponRecord } from "@/lib/coupon-utils";
import { isStaffRole } from "@/lib/staff-auth";
import { createLocalNotification } from "@/lib/local-notification-store";
import { writeCriticalBackup } from "@/lib/critical-backup";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = String(
      (session?.user as { role?: string } | undefined)?.role || ""
    ).trim();
    const actorUserId = String(
      (session?.user as { id?: string } | undefined)?.id || ""
    ).trim();

    if (!isStaffRole(role)) {
      return NextResponse.json(
        { error: "เฉพาะ staff หรือ admin เท่านั้นที่ยืนยันคูปองได้" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const code = String(body?.code || "").trim();

    if (!code) {
      return NextResponse.json(
        { error: "กรุณากรอกรหัสคูปอง" },
        { status: 400 }
      );
    }

    await ensureCouponRollbackSchema();

    const coupon = await prisma.coupon.findUnique({
      where: { code },
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

    if (!coupon) {
      return NextResponse.json(
        { error: "ไม่พบคูปองนี้ในระบบ" },
        { status: 404 }
      );
    }

    if (coupon.used) {
      return NextResponse.json(
        {
          error: "คูปองใบนี้ถูกใช้งานไปแล้ว",
          coupon: serializeCouponRecord(coupon),
        },
        { status: 409 }
      );
    }

    if (coupon.reversedAt) {
      return NextResponse.json(
        {
          error: "คูปองใบนี้ถูกย้อนกลับแล้ว ไม่สามารถใช้งานได้",
          coupon: serializeCouponRecord(coupon),
        },
        { status: 409 }
      );
    }

    const usedCoupon = await prisma.$transaction(async (tx) => {
      const beforeCoupon = await tx.coupon.findUnique({
        where: { id: coupon.id },
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

      if (!beforeCoupon) {
        throw new Error("coupon_not_found");
      }

      if (beforeCoupon.used) {
        throw new Error("coupon_already_used");
      }

      if (beforeCoupon.reversedAt) {
        throw new Error("coupon_reversed");
      }

      const markResult = await tx.coupon.updateMany({
        where: {
          id: beforeCoupon.id,
          used: false,
          reversedAt: null,
        },
        data: {
          used: true,
          usedAt: new Date(),
        },
      });

      if (markResult.count !== 1) {
        throw new Error("coupon_not_available");
      }

      const nextCoupon = await tx.coupon.findUnique({
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

      if (!nextCoupon) {
        throw new Error("coupon_not_found");
      }

      await writeCriticalBackup(tx, {
        scope: "coupon",
        action: "coupon.use",
        actorUserId,
        targetUserId: beforeCoupon.user.id,
        entityType: "Coupon",
        entityId: beforeCoupon.id,
        beforeSnapshot: {
          coupon: beforeCoupon,
        },
        afterSnapshot: {
          coupon: nextCoupon,
        },
        meta: {
          code: beforeCoupon.code,
          rewardId: beforeCoupon.reward.id,
          source: "coupon-use",
        },
      });

      return nextCoupon;
    });

    await createLocalNotification({
      userId: usedCoupon.user.id,
      type: "wallet",
      title: "คูปองถูกใช้งานแล้ว",
      body: usedCoupon.reward.name
        ? `ยืนยันใช้คูปอง ${usedCoupon.reward.name} สำเร็จ`
        : "คูปองถูกยืนยันการใช้งานสำเร็จ",
      href: `/redeem?open=${encodeURIComponent(usedCoupon.code)}`,
      image: usedCoupon.reward.imageUrl || usedCoupon.user.image || "/avatar.png",
      meta: {
        source: "coupon-use",
        couponCode: usedCoupon.code,
        rewardName: usedCoupon.reward.name || null,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      message: "ยืนยันใช้คูปองสำเร็จ",
      coupon: serializeCouponRecord(usedCoupon),
    });
  } catch (error) {
    console.error("COUPON_USE_ERROR", error);

    if (error instanceof Error) {
      if (error.message === "coupon_reversed") {
        return NextResponse.json(
          { error: "คูปองใบนี้ถูกย้อนกลับแล้ว ไม่สามารถใช้งานได้" },
          { status: 409 }
        );
      }

      if (error.message === "coupon_not_available") {
        return NextResponse.json(
          { error: "คูปองนี้ไม่อยู่ในสถานะพร้อมใช้งานแล้ว" },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดระหว่างยืนยันคูปอง" },
      { status: 500 }
    );
  }
}
