import { prisma } from "@/lib/prisma";
import {
  buildCardSetCode,
  CARD_SET_CODE_PATTERN,
  extractCardSetCode,
} from "@/lib/card-set-code";
import {
  getCollectionCardIds,
  nexoraCollectionSets,
  type NexoraCollectionSet,
} from "@/lib/nexora-collection-sets";

export const CARD_SET_REDEMPTION_TTL_MS = 60 * 60 * 1000;
export { buildCardSetCode, CARD_SET_CODE_PATTERN, extractCardSetCode };

export type CardSetRedemptionStatus =
  | "pending"
  | "approved"
  | "cancelled"
  | "expired";
export type CardSetRedemptionType =
  | "standard"
  | "foil_bonus"
  | "foil_sequence_1"
  | "foil_sequence_9"
  | "foil_sequence_18";

export type CardSetRedemptionOption = {
  type: CardSetRedemptionType;
  label: string;
  requiredFoilCount: number;
  nexValue: number;
};

export type CardSetRedemptionRecord = {
  id: string;
  code: string;
  userId: string;
  setId: string;
  setOrder: number;
  setName: string;
  rewardLabel: string;
  redemptionType: CardSetRedemptionType | null;
  conditionLabel: string | null;
  nexValue: number;
  itemsJson: string | null;
  createdByAdminMode: boolean | null;
  adminCreatorId: string | null;
  status: CardSetRedemptionStatus;
  createdAt: Date;
  expiresAt: Date;
  approvedAt: Date | null;
  approvedById: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  userName: string | null;
  userDisplayName: string | null;
  userImage: string | null;
  userLineId: string | null;
};

export type CardSetRedemptionItem = {
  setId: string;
  setOrder: number;
  setName: string;
  rewardLabel: string;
  redemptionType: CardSetRedemptionType;
  conditionLabel: string | null;
  nexValue: number;
  quantity: number;
  lineTotalNex: number;
};

function normalizeCardSetRedemptionType(
  value: unknown
): CardSetRedemptionType {
  const type = String(value || "standard").trim();
  return (
    type === "foil_bonus" ||
    type === "foil_sequence_1" ||
    type === "foil_sequence_9" ||
    type === "foil_sequence_18"
      ? type
      : "standard"
  ) as CardSetRedemptionType;
}

export function getCardSetById(setId: string) {
  return (
    nexoraCollectionSets.find((set) => set.id === setId) ||
    nexoraCollectionSets.find((set) => String(set.order) === setId) ||
    null
  );
}

export function parseCardSetNexValue(reward: string) {
  const matches = Array.from(
    String(reward || "").matchAll(/([\d,]+)\s*Nex/gi)
  )
    .map((match) => Number(String(match[1] || "").replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);

  return matches.length ? Math.max(...matches) : 0;
}

function parseNexValues(reward: string) {
  return Array.from(String(reward || "").matchAll(/([\d,]+)\s*Nex/gi))
    .map((match) => Number(String(match[1] || "").replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
}

export function getCardSetBonusOptions(set: NexoraCollectionSet) {
  if (set.order === 40) {
    return [
      {
        type: "foil_sequence_1" as const,
        label: "การ์ดลำดับเลขที่ 1 ครบทั้ง 5 แบบ",
        requiredFoilCount: 5,
        nexValue: 100000,
      },
      {
        type: "foil_sequence_9" as const,
        label: "การ์ดลำดับเลขที่ 9 ครบทั้ง 5 แบบ",
        requiredFoilCount: 5,
        nexValue: 100000,
      },
      {
        type: "foil_sequence_18" as const,
        label: "การ์ดลำดับเลขที่ 18 ครบทั้ง 5 แบบ",
        requiredFoilCount: 5,
        nexValue: 50000,
      },
    ] satisfies CardSetRedemptionOption[];
  }

  const reward = String(set.reward || "");
  const match = reward.match(
    /(ใช้การ์ดฟอยล์ไม่ซ้ำเพิ่ม\s*([\d,]+)\s*แบบ\s*รับเพิ่มทั้งหมดเป็น\s*([\d,]+)\s*Nex)/i
  );

  if (!match) return [];

  const bonusNexValue = Number(String(match[3] || "").replace(/,/g, ""));
  if (!Number.isFinite(bonusNexValue) || bonusNexValue <= 0) return [];

  return [
    {
      type: "foil_bonus" as const,
      label: match[1].trim(),
      requiredFoilCount: Number(String(match[2] || "").replace(/,/g, "")) || 0,
      nexValue: bonusNexValue,
    },
  ] satisfies CardSetRedemptionOption[];
}

export function getCardSetBonusOption(set: NexoraCollectionSet) {
  return getCardSetBonusOptions(set)[0] || null;
}

export function getCardSetRedemptionChoice(
  set: NexoraCollectionSet,
  type: CardSetRedemptionType = "standard"
) {
  const values = parseNexValues(set.reward);
  const baseNexValue = values.length ? Math.min(...values) : 0;
  const options = getCardSetBonusOptions(set);
  const selected = options.find((option) => option.type === type);

  if (selected) {
    return {
      redemptionType: selected.type,
      conditionLabel: selected.label,
      rewardLabel: `${set.reward} • เลือกเงื่อนไขเสริม: ${selected.label}`,
      nexValue: selected.nexValue,
    };
  }

  return {
    redemptionType: "standard" as const,
    conditionLabel: null,
    rewardLabel: options.length > 0
      ? String(set.reward || "").split(";")[0]?.trim() || set.reward
      : set.reward,
    nexValue: baseNexValue,
  };
}

export function getCardSetCoverImage(set: NexoraCollectionSet) {
  const firstCardId = getCollectionCardIds(set)[0];
  return firstCardId ? `/cards/${firstCardId}.jpg` : "/avatar.png";
}

function normalizeCardSetRedemptionItem(
  item: CardSetRedemptionItem
): CardSetRedemptionItem {
  const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));
  const fallbackNexValue = Number(item.nexValue || 0);
  const set =
    getCardSetById(item.setId) ||
    getCardSetById(String(item.setOrder || "")) ||
    null;

  if (!set) {
    return {
      ...item,
      redemptionType: normalizeCardSetRedemptionType(item.redemptionType),
      nexValue: fallbackNexValue,
      quantity,
      lineTotalNex: fallbackNexValue * quantity,
    };
  }

  const choice = getCardSetRedemptionChoice(
    set,
    normalizeCardSetRedemptionType(item.redemptionType)
  );

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

export async function ensureCardSetRedemptionSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CardSetRedemption" (
      "id" TEXT PRIMARY KEY,
      "code" TEXT NOT NULL UNIQUE,
      "userId" TEXT NOT NULL,
      "setId" TEXT NOT NULL,
      "setOrder" INTEGER NOT NULL,
      "setName" TEXT NOT NULL,
      "rewardLabel" TEXT NOT NULL,
      "redemptionType" TEXT NOT NULL DEFAULT 'standard',
      "conditionLabel" TEXT,
      "nexValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "itemsJson" TEXT,
      "createdByAdminMode" BOOLEAN NOT NULL DEFAULT false,
      "adminCreatorId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "approvedAt" TIMESTAMP(3),
      "approvedById" TEXT,
      "cancelledAt" TIMESTAMP(3),
      "cancelReason" TEXT
    )
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "CardSetRedemption_userId_status_idx" ON "CardSetRedemption" ("userId", "status")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "CardSetRedemption_createdAt_idx" ON "CardSetRedemption" ("createdAt")'
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "CardSetRedemption" ADD COLUMN IF NOT EXISTS "redemptionType" TEXT NOT NULL DEFAULT \'standard\''
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "CardSetRedemption" ADD COLUMN IF NOT EXISTS "conditionLabel" TEXT'
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "CardSetRedemption" ADD COLUMN IF NOT EXISTS "itemsJson" TEXT'
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "CardSetRedemption" ADD COLUMN IF NOT EXISTS "createdByAdminMode" BOOLEAN NOT NULL DEFAULT false'
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "CardSetRedemption" ADD COLUMN IF NOT EXISTS "adminCreatorId" TEXT'
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CardSetRedemptionLog" (
      "id" TEXT PRIMARY KEY,
      "redemptionId" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "itemIndex" INTEGER NOT NULL,
      "setId" TEXT NOT NULL,
      "setOrder" INTEGER NOT NULL,
      "setName" TEXT NOT NULL,
      "rewardLabel" TEXT NOT NULL,
      "redemptionType" TEXT NOT NULL DEFAULT 'standard',
      "conditionLabel" TEXT,
      "nexValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "approvedAt" TIMESTAMP(3),
      "approvedById" TEXT,
      "cancelledAt" TIMESTAMP(3),
      "cancelReason" TEXT
    )
  `);
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "CardSetRedemptionLog_redemptionId_idx" ON "CardSetRedemptionLog" ("redemptionId")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "CardSetRedemptionLog_code_idx" ON "CardSetRedemptionLog" ("code")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "CardSetRedemptionLog_userId_status_idx" ON "CardSetRedemptionLog" ("userId", "status")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "CardSetRedemptionLog_createdAt_idx" ON "CardSetRedemptionLog" ("createdAt")'
  );
}

function parseCardSetRedemptionItems(row: CardSetRedemptionRecord): CardSetRedemptionItem[] {
  if (row.itemsJson) {
    try {
      const parsed = JSON.parse(row.itemsJson);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            const quantity = Math.max(1, Math.floor(Number(item?.quantity || 1)));
            const nexValue = Number(item?.nexValue || 0);
            const setId = String(item?.setId || "").trim();
            const setName = String(item?.setName || "").trim();
            const setOrder = Number(item?.setOrder || 0);
            if (!setId || !setName || !Number.isFinite(nexValue)) return null;

            return normalizeCardSetRedemptionItem({
              setId,
              setOrder,
              setName,
              rewardLabel: String(item?.rewardLabel || setName),
              redemptionType: normalizeCardSetRedemptionType(
                item?.redemptionType
              ),
              conditionLabel: item?.conditionLabel
                ? String(item.conditionLabel)
                : null,
              nexValue,
              quantity,
              lineTotalNex: Number(item?.lineTotalNex || nexValue * quantity),
            });
          })
          .filter((item): item is CardSetRedemptionItem => Boolean(item));
      }
    } catch {
      // Fall back to the legacy single-set columns below.
    }
  }

  const quantity = 1;
  const nexValue = Number(row.nexValue || 0);
  return [
    normalizeCardSetRedemptionItem({
      setId: row.setId,
      setOrder: row.setOrder,
      setName: row.setName,
      rewardLabel: row.rewardLabel,
      redemptionType: normalizeCardSetRedemptionType(row.redemptionType),
      conditionLabel: row.conditionLabel || null,
      nexValue,
      quantity,
      lineTotalNex: nexValue,
    }),
  ];
}

export async function syncPendingCardSetRedemptionPricing(userId?: string) {
  await ensureCardSetRedemptionSchema();

  const rows = userId
    ? await prisma.$queryRawUnsafe<CardSetRedemptionRecord[]>(
        `
          SELECT
            r.*,
            u."name" AS "userName",
            u."displayName" AS "userDisplayName",
            u."image" AS "userImage",
            u."lineId" AS "userLineId"
          FROM "CardSetRedemption" r
          LEFT JOIN "User" u ON u."id" = r."userId"
          WHERE r."status" = 'pending'
            AND r."expiresAt" > CURRENT_TIMESTAMP
            AND r."userId" = $1
        `,
        userId
      )
    : await prisma.$queryRawUnsafe<CardSetRedemptionRecord[]>(`
        SELECT
          r.*,
          u."name" AS "userName",
          u."displayName" AS "userDisplayName",
          u."image" AS "userImage",
          u."lineId" AS "userLineId"
        FROM "CardSetRedemption" r
        LEFT JOIN "User" u ON u."id" = r."userId"
        WHERE r."status" = 'pending'
          AND r."expiresAt" > CURRENT_TIMESTAMP
      `);

  for (const row of rows) {
    const items = parseCardSetRedemptionItems(row);
    if (!items.length) continue;

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalNex = items.reduce((sum, item) => sum + item.lineTotalNex, 0);
    const firstItem = items[0];
    if (!firstItem) continue;
    const rewardLabel =
      items.length === 1 && totalQuantity === 1
        ? firstItem.rewardLabel
        : `CARD SET ${items.length} เซ็ต / ${totalQuantity} ชุด`;
    const setName =
      items.length === 1 ? firstItem.setName : `CARD SET ${totalQuantity} ชุด`;
    const nextItemsJson = JSON.stringify(items);

    if (
      row.itemsJson !== nextItemsJson ||
      Number(row.nexValue || 0) !== totalNex ||
      row.rewardLabel !== rewardLabel ||
      row.conditionLabel !== firstItem.conditionLabel ||
      row.redemptionType !== firstItem.redemptionType
    ) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE "CardSetRedemption"
          SET "setId" = $2,
              "setOrder" = $3,
              "setName" = $4,
              "rewardLabel" = $5,
              "redemptionType" = $6,
              "conditionLabel" = $7,
              "nexValue" = $8,
              "itemsJson" = $9
          WHERE "id" = $1
            AND "status" = 'pending'
        `,
        row.id,
        firstItem.setId,
        firstItem.setOrder,
        setName,
        rewardLabel,
        firstItem.redemptionType,
        firstItem.conditionLabel,
        totalNex,
        nextItemsJson
      );
    }

    for (const item of items) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE "CardSetRedemptionLog"
          SET "setId" = $3,
              "setOrder" = $4,
              "setName" = $5,
              "rewardLabel" = $6,
              "redemptionType" = $7,
              "conditionLabel" = $8,
              "nexValue" = $9
          WHERE "redemptionId" = $1
            AND "status" = 'pending'
            AND ("setId" = $2 OR "setOrder" = $4)
            AND "redemptionType" = $7
        `,
        row.id,
        item.setId,
        item.setId,
        item.setOrder,
        item.setName,
        item.rewardLabel,
        item.redemptionType,
        item.conditionLabel,
        item.nexValue
      );
    }
  }
}

export async function expireStaleCardSetRedemptions(userId?: string) {
  await ensureCardSetRedemptionSchema();
  const now = new Date();

  if (userId) {
    await prisma.$executeRawUnsafe(
      `
        DELETE FROM "CardSetRedemptionLog"
        WHERE "status" = 'expired'
          AND "userId" = $1
      `,
      userId
    );
    await prisma.$executeRawUnsafe(
      `
        DELETE FROM "CardSetRedemption"
        WHERE "status" = 'expired'
          AND "userId" = $1
      `,
      userId
    );
    await prisma.$executeRawUnsafe(
      `
        DELETE FROM "CardSetRedemptionLog"
        WHERE "status" = 'pending'
          AND "expiresAt" <= $1
          AND "userId" = $2
      `,
      now,
      userId
    );
    await prisma.$executeRawUnsafe(
      `
        DELETE FROM "CardSetRedemption"
        WHERE "status" = 'pending'
          AND "expiresAt" <= $1
          AND "userId" = $2
      `,
      now,
      userId
    );
    return;
  }

  await prisma.$executeRawUnsafe(
    `
      DELETE FROM "CardSetRedemptionLog"
      WHERE "status" = 'expired'
    `
  );
  await prisma.$executeRawUnsafe(
    `
      DELETE FROM "CardSetRedemption"
      WHERE "status" = 'expired'
    `
  );
  await prisma.$executeRawUnsafe(
    `
      DELETE FROM "CardSetRedemptionLog"
      WHERE "status" = 'pending'
        AND "expiresAt" <= $1
    `,
    now
  );
  await prisma.$executeRawUnsafe(
    `
      DELETE FROM "CardSetRedemption"
      WHERE "status" = 'pending'
        AND "expiresAt" <= $1
    `,
    now
  );
}

export function serializeCardSetRedemption(row: CardSetRedemptionRecord) {
  const status =
    row.status === "pending" && row.expiresAt.getTime() <= Date.now()
      ? "expired"
      : row.status;

  const items = parseCardSetRedemptionItems(row);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalNex = items.reduce((sum, item) => sum + item.lineTotalNex, 0);
  const firstItem = items[0] || null;
  const useSingleItemFields = Boolean(firstItem && items.length === 1);

  return {
    id: row.id,
    code: row.code,
    userId: row.userId,
    setId: firstItem?.setId || row.setId,
    setOrder: firstItem?.setOrder || row.setOrder,
    setName: useSingleItemFields ? firstItem?.setName || row.setName : row.setName,
    rewardLabel: useSingleItemFields
      ? firstItem?.rewardLabel || row.rewardLabel
      : row.rewardLabel,
    redemptionType: firstItem?.redemptionType || row.redemptionType || "standard",
    conditionLabel: useSingleItemFields
      ? firstItem?.conditionLabel || null
      : row.conditionLabel || null,
    nexValue: totalNex || Number(row.nexValue || 0),
    items,
    itemCount: items.length,
    totalQuantity,
    createdByAdminMode: Boolean(row.createdByAdminMode),
    adminCreatorId: row.adminCreatorId,
    status,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    approvedById: row.approvedById,
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    cancelReason: row.cancelReason,
    userName:
      String(row.userDisplayName || row.userName || "").trim() ||
      "NEXORA User",
    userImage: row.userImage || "/avatar.png",
    lineId: row.userLineId || "",
    valueLabel: `${Number(totalNex || row.nexValue || 0).toLocaleString("th-TH")} NEX`,
    statusLabel:
      status === "approved"
        ? "การแลกเสร็จสมบูรณ์"
        : status === "cancelled"
          ? "ยกเลิกแล้ว"
          : status === "expired"
            ? "หมดเวลา"
            : "รอพนักงานสแกน",
  };
}
