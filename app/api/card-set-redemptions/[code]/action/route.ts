import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createLocalNotification } from "@/lib/local-notification-store";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/staff-auth";
import {
  ensureCardSetRedemptionSchema,
  expireStaleCardSetRedemptions,
  serializeCardSetRedemption,
  syncPendingCardSetRedemptionPricing,
  type CardSetRedemptionRecord,
} from "@/lib/card-set-redemptions";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
};

type RouteProps = {
  params: Promise<{ code: string }>;
};

async function findRedemption(code: string) {
  const rows = await prisma.$queryRawUnsafe<CardSetRedemptionRecord[]>(
    `
      SELECT
        r.*,
        u."name" AS "userName",
        u."displayName" AS "userDisplayName",
        u."image" AS "userImage",
        u."lineId" AS "userLineId"
      FROM "CardSetRedemption" r
      LEFT JOIN "User" u ON u."id" = r."userId"
      WHERE r."code" = $1
      LIMIT 1
    `,
    code
  );

  return rows[0] || null;
}

export async function POST(req: Request, { params }: RouteProps) {
  try {
    const session = await getServerSession(authOptions);
    const actorUserId = String(
      (session?.user as { id?: string } | undefined)?.id || ""
    ).trim();
    const role = String(
      (session?.user as { role?: string } | undefined)?.role || ""
    ).trim();

    if (!actorUserId) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบก่อน" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const { code } = await params;
    const safeCode = decodeURIComponent(String(code || "").trim());
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim().toLowerCase();

    if (!safeCode || (action !== "approve" && action !== "cancel")) {
      return NextResponse.json(
        { error: "ข้อมูลการยืนยันไม่ถูกต้อง" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    await ensureCardSetRedemptionSchema();
    await expireStaleCardSetRedemptions();
    await syncPendingCardSetRedemptionPricing();

    const before = await findRedemption(safeCode);
    if (!before) {
      return NextResponse.json(
        { error: "ไม่พบรายการแลก CARD SET นี้" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const staffActor = isStaffRole(role);
    const adminModeClaim = Boolean(before.createdByAdminMode);

    if (!staffActor && !adminModeClaim) {
      return NextResponse.json(
        { error: "คุณไม่มีสิทในการใช้งานฟังชั่นนี้ เฉพาะเจ้าหน้าที่เท่านั้น" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    if (before.status !== "pending") {
      return NextResponse.json(
        {
          error: "รายการนี้ไม่ได้อยู่ในสถานะรออนุมัติแล้ว",
          redemption: serializeCardSetRedemption(before),
        },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }

    if (before.expiresAt.getTime() <= Date.now()) {
      await expireStaleCardSetRedemptions();
      const expired = await findRedemption(safeCode);
      return NextResponse.json(
        {
          error: "QR CODE นี้หมดเวลาแล้ว",
          redemption: expired ? serializeCardSetRedemption(expired) : null,
        },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }

    const now = new Date();

    if (action === "approve") {
      const updated = await prisma.$executeRawUnsafe(
        `
          UPDATE "CardSetRedemption"
          SET "userId" = CASE WHEN "createdByAdminMode" = true AND $4 = true THEN $2 ELSE "userId" END,
              "status" = 'approved',
              "approvedAt" = $1,
              "approvedById" = $2
          WHERE "code" = $3
            AND "status" = 'pending'
            AND "expiresAt" > $1
        `,
        now,
        actorUserId,
        safeCode,
        adminModeClaim
      );

      if (Number(updated) !== 1) {
        return NextResponse.json(
          { error: "อนุมัติไม่สำเร็จ กรุณาโหลดรายการใหม่" },
          { status: 409, headers: NO_STORE_HEADERS }
        );
      }

      await prisma.$executeRawUnsafe(
        `
          UPDATE "CardSetRedemptionLog"
          SET "userId" = CASE WHEN $4 = true THEN $2 ELSE "userId" END,
              "status" = 'approved',
              "approvedAt" = $1,
              "approvedById" = $2
          WHERE "redemptionId" = $3
            AND "status" = 'pending'
        `,
        now,
        actorUserId,
        before.id,
        adminModeClaim
      );
    } else {
      const cancelReason = String(
        body?.reason ||
          (adminModeClaim ? "customer_cancelled" : "staff_cancelled")
      ).slice(0, 240);

      await prisma.$executeRawUnsafe(
        `
          UPDATE "CardSetRedemption"
          SET "status" = 'cancelled',
              "cancelledAt" = $1,
              "cancelReason" = $2
          WHERE "code" = $3
            AND "status" = 'pending'
        `,
        now,
        cancelReason,
        safeCode
      );
      await prisma.$executeRawUnsafe(
        `
          UPDATE "CardSetRedemptionLog"
          SET "status" = 'cancelled',
              "cancelledAt" = $1,
              "cancelReason" = $2
          WHERE "redemptionId" = $3
            AND "status" = 'pending'
        `,
        now,
        cancelReason,
        before.id
      );
    }

    const redemption = await findRedemption(safeCode);

    if (redemption) {
      await createLocalNotification({
        userId: redemption.userId,
        type: "wallet",
        title:
          action === "approve"
            ? "การแลก CARD SET เสร็จสมบูรณ์"
            : "รายการแลก CARD SET ถูกยกเลิก",
        body:
          action === "approve"
            ? `Set ${redemption.setOrder} ${redemption.setName} ได้รับการยืนยันแล้ว`
            : `Set ${redemption.setOrder} ${redemption.setName} ถูกยกเลิก`,
        href: "/card-set",
        image: "/avatar.png",
        meta: {
          source: redemption.createdByAdminMode
            ? "card-set-admin-mode-redemption"
            : "card-set-redemption",
          action,
          code: safeCode,
          setId: redemption.setId,
        },
      }).catch(() => undefined);
    }

    return NextResponse.json(
      {
        success: true,
        redemption: redemption ? serializeCardSetRedemption(redemption) : null,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("CARD_SET_ACTION_ERROR", error);
    return NextResponse.json(
      { error: "อัปเดตรายการแลก CARD SET ไม่สำเร็จ" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
