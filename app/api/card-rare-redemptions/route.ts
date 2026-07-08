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
  type CardRareRedemptionItem,
  type CardRareRedemptionRecord,
} from "@/lib/card-rare-redemptions";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
};

type CardRareRedemptionRequestItem = {
  cardNo?: unknown;
  optionKey?: unknown;
  quantity?: unknown;
};

function normalizeQuantity(value: unknown) {
  const quantity = Math.floor(Number(value || 1));
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(99, Math.max(1, quantity));
}

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

async function insertCardRareDetailLogs(input: {
  redemptionId: string;
  code: string;
  userId: string;
  items: CardRareRedemptionItem[];
  createdAt: Date;
  expiresAt: Date;
}) {
  let itemIndex = 0;

  for (const item of input.items) {
    for (let copy = 0; copy < item.quantity; copy += 1) {
      itemIndex += 1;
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO "CardRareRedemptionLog" (
            "id", "redemptionId", "code", "userId", "itemIndex",
            "cardNo", "cardName", "rewardLabel", "optionKey", "conditionLabel",
            "nexValue", "imageUrl", "status", "createdAt", "expiresAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', $13, $14)
        `,
        crypto.randomUUID(),
        input.redemptionId,
        input.code,
        input.userId,
        itemIndex,
        item.cardNo,
        item.cardName,
        item.rewardLabel,
        item.optionKey,
        item.conditionLabel,
        item.nexValue,
        item.imageUrl,
        input.createdAt,
        input.expiresAt
      );
    }
  }
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
    const requestedItems: CardRareRedemptionRequestItem[] = Array.isArray(
      body?.items
    )
      ? body.items
      : [{ cardNo: body?.cardNo, optionKey: body?.optionKey, quantity: 1 }];

    const items = requestedItems
      .slice(0, 120)
      .map((item) => {
        const choice = getCardRareRewardChoice(
          String(item?.cardNo || "").trim(),
          String(item?.optionKey || "standard").trim()
        );
        if (!choice) return null;

        const quantity = normalizeQuantity(item?.quantity);
        return {
          cardNo: choice.reward.cardNo,
          cardName: choice.reward.cardName,
          rewardLabel: choice.rewardLabel,
          optionKey: choice.option.key,
          conditionLabel: choice.conditionLabel,
          nexValue: choice.nexValue,
          imageUrl: choice.reward.imageUrl,
          quantity,
          lineTotalNex: choice.nexValue * quantity,
        } satisfies CardRareRedemptionItem;
      })
      .filter((item): item is CardRareRedemptionItem => Boolean(item));

    if (!items.length) {
      return NextResponse.json(
        { error: "ไม่พบการ์ดแรร์ในระบบ" },
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

    const firstItem = items[0];
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalNex = items.reduce((sum, item) => sum + item.lineTotalNex, 0);
    const rewardLabel =
      items.length === 1 && totalQuantity === 1
        ? firstItem.rewardLabel
        : `CARD RARE ${items.length} แบบ / ${totalQuantity} ใบ`;
    const code = buildCardRareCode(firstItem.cardNo);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CARD_RARE_REDEMPTION_TTL_MS);

    const redemptionId = crypto.randomUUID();

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "CardRareRedemption" (
          "id", "code", "userId", "cardNo", "cardName",
          "rewardLabel", "optionKey", "conditionLabel", "nexValue", "imageUrl", "itemsJson",
          "status", "createdAt", "expiresAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, $13)
      `,
      redemptionId,
      code,
      userId,
      firstItem.cardNo,
      items.length === 1 ? firstItem.cardName : `CARD RARE ${totalQuantity} ใบ`,
      rewardLabel,
      firstItem.optionKey,
      firstItem.conditionLabel,
      totalNex,
      firstItem.imageUrl,
      JSON.stringify(items),
      now,
      expiresAt
    );

    await insertCardRareDetailLogs({
      redemptionId,
      code,
      userId,
      items,
      createdAt: now,
      expiresAt,
    });

    const redemption = await getRedemptionByCode(code);

    await createLocalNotification({
      userId,
      type: "wallet",
      title: "สร้าง QR แลก CARD RARE แล้ว",
      body: `${rewardLabel} รวม ${totalNex.toLocaleString("th-TH")} NEX ต้องให้พนักงานสแกนภายใน 1 ชั่วโมง`,
      href: "/card-rare",
      image: firstItem.imageUrl,
      meta: {
        source: "card-rare-redemption",
        code,
        cardNo: firstItem.cardNo,
        cardName: firstItem.cardName,
        optionKey: firstItem.optionKey,
        conditionLabel: firstItem.conditionLabel,
        totalQuantity,
        totalNex,
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
