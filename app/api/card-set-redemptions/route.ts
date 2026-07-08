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
  type CardSetRedemptionItem,
  type CardSetRedemptionRecord,
  type CardSetRedemptionType,
} from "@/lib/card-set-redemptions";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
};

type CardSetRedemptionRequestItem = {
  setId?: unknown;
  redemptionType?: unknown;
  quantity?: unknown;
};

function normalizeQuantity(value: unknown) {
  const quantity = Math.floor(Number(value || 1));
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(99, Math.max(1, quantity));
}

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

function buildRedemptionItem(
  input: CardSetRedemptionRequestItem
): CardSetRedemptionItem | null {
  const set = getCardSetById(String(input?.setId || "").trim());
  if (!set) return null;

  const requestedType = String(input?.redemptionType || "standard").trim();
  const bonusOptions = getCardSetBonusOptions(set);
  const redemptionType = (
    bonusOptions.some((option) => option.type === requestedType)
      ? requestedType
      : "standard"
  ) as CardSetRedemptionType;
  const choice = getCardSetRedemptionChoice(set, redemptionType);
  const quantity = normalizeQuantity(input?.quantity);

  return {
    setId: set.id,
    setOrder: set.order,
    setName: set.name,
    rewardLabel: choice.rewardLabel,
    redemptionType: choice.redemptionType,
    conditionLabel: choice.conditionLabel,
    nexValue: choice.nexValue,
    quantity,
    lineTotalNex: choice.nexValue * quantity,
  };
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
    const requestedItems: CardSetRedemptionRequestItem[] = Array.isArray(
      body?.items
    )
      ? body.items
      : [
          {
            setId: body?.setId,
            redemptionType: body?.redemptionType,
            quantity: 1,
          },
        ];

    const items = requestedItems
      .slice(0, 80)
      .map(buildRedemptionItem)
      .filter((item): item is CardSetRedemptionItem => Boolean(item));

    if (!items.length) {
      return NextResponse.json(
        { error: "ไม่พบเซ็ตการ์ดนี้" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

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

    const firstItem = items[0];
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalNex = items.reduce((sum, item) => sum + item.lineTotalNex, 0);
    const rewardLabel =
      items.length === 1 && totalQuantity === 1
        ? firstItem.rewardLabel
        : `CARD SET ${items.length} เซ็ต / ${totalQuantity} ชุด`;
    const code = buildCardSetCode(firstItem.setOrder);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CARD_SET_REDEMPTION_TTL_MS);

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "CardSetRedemption" (
          "id", "code", "userId", "setId", "setOrder", "setName",
          "rewardLabel", "redemptionType", "conditionLabel", "nexValue", "itemsJson",
          "status", "createdAt", "expiresAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, $13)
      `,
      crypto.randomUUID(),
      code,
      userId,
      firstItem.setId,
      firstItem.setOrder,
      items.length === 1 ? firstItem.setName : `CARD SET ${totalQuantity} ชุด`,
      rewardLabel,
      firstItem.redemptionType,
      firstItem.conditionLabel,
      totalNex,
      JSON.stringify(items),
      now,
      expiresAt
    );

    const redemption = await getRedemptionByCode(code);

    await createLocalNotification({
      userId,
      type: "wallet",
      title: "สร้าง QR แลก CARD SET แล้ว",
      body: `${rewardLabel} รวม ${totalNex.toLocaleString("th-TH")} NEX ต้องให้พนักงานสแกนภายใน 1 ชั่วโมง`,
      href: "/card-set",
      image: "/avatar.png",
      meta: {
        source: "card-set-redemption",
        code,
        setId: firstItem.setId,
        setName: firstItem.setName,
        redemptionType: firstItem.redemptionType,
        conditionLabel: firstItem.conditionLabel,
        totalQuantity,
        totalNex,
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
