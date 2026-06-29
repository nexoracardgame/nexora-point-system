import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createLocalNotification } from "@/lib/local-notification-store";
import { prisma } from "@/lib/prisma";
import {
  CARD_SET_REDEMPTION_TTL_MS,
  buildCardSetCode,
  ensureCardSetRedemptionSchema,
  expireStaleCardSetRedemptions,
  getCardSetById,
  getCardSetBonusOptions,
  getCardSetRedemptionChoice,
  serializeCardSetRedemption,
  type CardSetRedemptionType,
  type CardSetRedemptionRecord,
} from "@/lib/card-set-redemptions";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
};

async function getRedemptionByCode(code: string) {
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

async function getActiveRedemption(userId: string) {
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
      WHERE r."userId" = $1
        AND r."status" = 'pending'
        AND r."expiresAt" > CURRENT_TIMESTAMP
      ORDER BY r."createdAt" DESC
      LIMIT 1
    `,
    userId
  );

  return rows[0] || null;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = String(
      (session?.user as { id?: string } | undefined)?.id || ""
    ).trim();

    if (!userId) {
      return NextResponse.json(
        { active: null },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    await expireStaleCardSetRedemptions(userId);
    const active = await getActiveRedemption(userId);

    return NextResponse.json(
      { active: active ? serializeCardSetRedemption(active) : null },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("CARD_SET_ACTIVE_ERROR", error);
    return NextResponse.json(
      { error: "Failed to load card set redemption" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = String(
      (session?.user as { id?: string } | undefined)?.id || ""
    ).trim();

    if (!userId) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบก่อน" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const body = await req.json();
    const setId = String(body?.setId || "").trim();
    const requestedType = String(body?.redemptionType || "standard").trim();
    const set = getCardSetById(setId);

    if (!set) {
      return NextResponse.json(
        { error: "ไม่พบเซ็ตการ์ดนี้" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const bonusOptions = getCardSetBonusOptions(set);
    const redemptionType = (
      bonusOptions.some((option) => option.type === requestedType)
        ? requestedType
        : "standard"
    ) as CardSetRedemptionType;

    await ensureCardSetRedemptionSchema();
    await expireStaleCardSetRedemptions(userId);

    const active = await getActiveRedemption(userId);
    if (active) {
      return NextResponse.json(
        {
          success: true,
          active: serializeCardSetRedemption(active),
          reused: true,
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    const code = buildCardSetCode(set.order);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CARD_SET_REDEMPTION_TTL_MS);
    const choice = getCardSetRedemptionChoice(set, redemptionType);

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "CardSetRedemption" (
          "id", "code", "userId", "setId", "setOrder", "setName",
          "rewardLabel", "redemptionType", "conditionLabel", "nexValue",
          "status", "createdAt", "expiresAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, $12)
      `,
      crypto.randomUUID(),
      code,
      userId,
      set.id,
      set.order,
      set.name,
      choice.rewardLabel,
      choice.redemptionType,
      choice.conditionLabel,
      choice.nexValue,
      now,
      expiresAt
    );

    const redemption = await getRedemptionByCode(code);

    await createLocalNotification({
      userId,
      type: "wallet",
      title: "สร้าง QR แลก CARD SET แล้ว",
      body: `เซ็ต ${set.order} ${set.name} ต้องให้พนักงานสแกนภายใน 1 ชั่วโมง`,
      href: "/card-set",
      image: "/avatar.png",
      meta: {
        source: "card-set-redemption",
        code,
        setId: set.id,
        setName: set.name,
        redemptionType: choice.redemptionType,
        conditionLabel: choice.conditionLabel,
      },
    }).catch(() => undefined);

    return NextResponse.json(
      {
        success: true,
        active: redemption ? serializeCardSetRedemption(redemption) : null,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("CARD_SET_CREATE_ERROR", error);
    return NextResponse.json(
      { error: "สร้าง QR แลกเซ็ตไม่สำเร็จ" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
