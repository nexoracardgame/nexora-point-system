import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createLocalNotification } from "@/lib/local-notification-store";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/staff-auth";
import {
  ensureCardRareRedemptionSchema,
  expireStaleCardRareRedemptions,
  serializeCardRareRedemption,
  type CardRareRedemptionRecord,
} from "@/lib/card-rare-redemptions";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
};

type RouteProps = {
  params: Promise<{ code: string }>;
};

async function findRedemption(code: string) {
  const rows = await prisma.$queryRawUnsafe<CardRareRedemptionRecord[]>(
    `
      SELECT
        r.*,
        u."name" AS "userName",
        u."displayName" AS "userDisplayName",
        u."image" AS "userImage",
        u."lineId" AS "userLineId"
      FROM "CardRareRedemption" r
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

    if (!isStaffRole(role)) {
      return NextResponse.json(
        { error: "เฉพาะ staff หรือ admin เท่านั้น" },
        { status: 403, headers: NO_STORE_HEADERS }
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

    await ensureCardRareRedemptionSchema();
    await expireStaleCardRareRedemptions();

    const before = await findRedemption(safeCode);
    if (!before) {
      return NextResponse.json(
        { error: "ไม่พบรายการแลกการ์ดแรร์นี้" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    if (before.status !== "pending") {
      return NextResponse.json(
        {
          error: "รายการนี้ไม่อยู่ในสถานะรออนุมัติแล้ว",
          redemption: serializeCardRareRedemption(before),
        },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }

    if (before.expiresAt.getTime() <= Date.now()) {
      await expireStaleCardRareRedemptions();
      const expired = await findRedemption(safeCode);
      return NextResponse.json(
        {
          error: "QR CODE นี้หมดเวลาแล้ว",
          redemption: expired ? serializeCardRareRedemption(expired) : null,
        },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }

    const now = new Date();

    if (action === "approve") {
      const updated = await prisma.$executeRawUnsafe(
        `
          UPDATE "CardRareRedemption"
          SET "status" = 'approved',
              "approvedAt" = $1,
              "approvedById" = $2
          WHERE "code" = $3
            AND "status" = 'pending'
            AND "expiresAt" > $1
        `,
        now,
        actorUserId || null,
        safeCode
      );

      if (Number(updated) !== 1) {
        return NextResponse.json(
          { error: "อนุมัติไม่สำเร็จ กรุณาโหลดรายการใหม่" },
          { status: 409, headers: NO_STORE_HEADERS }
        );
      }
    } else {
      await prisma.$executeRawUnsafe(
        `
          UPDATE "CardRareRedemption"
          SET "status" = 'cancelled',
              "cancelledAt" = $1,
              "cancelReason" = $2
          WHERE "code" = $3
            AND "status" = 'pending'
        `,
        now,
        String(body?.reason || "staff_cancelled").slice(0, 240),
        safeCode
      );
    }

    const redemption = await findRedemption(safeCode);

    if (redemption) {
      await createLocalNotification({
        userId: redemption.userId,
        type: "wallet",
        title:
          action === "approve"
            ? "การแลก CARD RARE เสร็จสมบูรณ์"
            : "รายการแลก CARD RARE ถูกยกเลิก",
        body:
          action === "approve"
            ? `Card #${redemption.cardNo} ${redemption.cardName} ได้รับการอนุมัติแล้ว`
            : `Card #${redemption.cardNo} ${redemption.cardName} ถูกยกเลิกโดยพนักงาน`,
        href: "/card-rare",
        image: redemption.imageUrl || "/avatar.png",
        meta: {
          source: "card-rare-redemption",
          action,
          code: safeCode,
          cardNo: redemption.cardNo,
        },
      }).catch(() => undefined);
    }

    return NextResponse.json(
      {
        success: true,
        redemption: redemption ? serializeCardRareRedemption(redemption) : null,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("CARD_RARE_ACTION_ERROR", error);
    return NextResponse.json(
      { error: "อัปเดตรายการแลกการ์ดแรร์ไม่สำเร็จ" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
