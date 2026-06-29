import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createLocalNotification } from "@/lib/local-notification-store";
import { prisma } from "@/lib/prisma";
import { getCardRareRewardChoice } from "@/lib/card-rare-rewards";
import {
  CARD_RARE_REDEMPTION_TTL_MS,
  buildCardRareCode,
  ensureCardRareRedemptionSchema,
  expireStaleCardRareRedemptions,
  serializeCardRareRedemption,
  type CardRareRedemptionRecord,
} from "@/lib/card-rare-redemptions";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
};

async function getRedemptionByCode(code: string) {
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

async function getActiveRedemption(userId: string) {
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

    await expireStaleCardRareRedemptions(userId);
    const active = await getActiveRedemption(userId);

    return NextResponse.json(
      { active: active ? serializeCardRareRedemption(active) : null },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("CARD_RARE_ACTIVE_ERROR", error);
    return NextResponse.json(
      { error: "Failed to load card rare redemption" },
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
    const cardNo = String(body?.cardNo || "").trim();
    const optionKey = String(body?.optionKey || "standard").trim();
    const choice = getCardRareRewardChoice(cardNo, optionKey);

    if (!choice) {
      return NextResponse.json(
        { error: "ไม่พบการ์ดแรร์ใบนี้ในระบบ" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    await ensureCardRareRedemptionSchema();
    await expireStaleCardRareRedemptions(userId);

    const active = await getActiveRedemption(userId);
    if (active) {
      return NextResponse.json(
        {
          success: true,
          active: serializeCardRareRedemption(active),
          reused: true,
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    const code = buildCardRareCode(choice.reward.cardNo);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CARD_RARE_REDEMPTION_TTL_MS);

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "CardRareRedemption" (
          "id", "code", "userId", "cardNo", "cardName",
          "rewardLabel", "optionKey", "conditionLabel", "nexValue", "imageUrl",
          "status", "createdAt", "expiresAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, $12)
      `,
      crypto.randomUUID(),
      code,
      userId,
      choice.reward.cardNo,
      choice.reward.cardName,
      choice.rewardLabel,
      choice.option.key,
      choice.conditionLabel,
      choice.nexValue,
      choice.reward.imageUrl,
      now,
      expiresAt
    );

    const redemption = await getRedemptionByCode(code);

    await createLocalNotification({
      userId,
      type: "wallet",
      title: "สร้าง QR แลก CARD RARE แล้ว",
      body: `Card #${choice.reward.cardNo} ${choice.reward.cardName} ต้องให้พนักงานสแกนภายใน 1 ชั่วโมง`,
      href: "/card-rare",
      image: choice.reward.imageUrl,
      meta: {
        source: "card-rare-redemption",
        code,
        cardNo: choice.reward.cardNo,
        cardName: choice.reward.cardName,
        optionKey: choice.option.key,
        conditionLabel: choice.conditionLabel,
      },
    }).catch(() => undefined);

    return NextResponse.json(
      {
        success: true,
        active: redemption ? serializeCardRareRedemption(redemption) : null,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("CARD_RARE_CREATE_ERROR", error);
    return NextResponse.json(
      { error: "สร้าง QR แลกการ์ดแรร์ไม่สำเร็จ" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
