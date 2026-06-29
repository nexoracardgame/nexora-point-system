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

export type CardSetRedemptionRecord = {
  id: string;
  code: string;
  userId: string;
  setId: string;
  setOrder: number;
  setName: string;
  rewardLabel: string;
  nexValue: number;
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

export function getCardSetCoverImage(set: NexoraCollectionSet) {
  const firstCardId = getCollectionCardIds(set)[0];
  return firstCardId ? `/cards/${firstCardId}.jpg` : "/avatar.png";
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
    'CREATE INDEX IF NOT EXISTS "CardSetRedemption_userId_status_idx" ON "CardSetRedemption" ("userId", "status")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "CardSetRedemption_createdAt_idx" ON "CardSetRedemption" ("createdAt")'
  );
}

export async function expireStaleCardSetRedemptions(userId?: string) {
  await ensureCardSetRedemptionSchema();
  const now = new Date();

  if (userId) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE "CardSetRedemption"
        SET "status" = 'expired', "cancelledAt" = $1, "cancelReason" = 'expired'
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
      UPDATE "CardSetRedemption"
      SET "status" = 'expired', "cancelledAt" = $1, "cancelReason" = 'expired'
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

  return {
    id: row.id,
    code: row.code,
    userId: row.userId,
    setId: row.setId,
    setOrder: row.setOrder,
    setName: row.setName,
    rewardLabel: row.rewardLabel,
    nexValue: Number(row.nexValue || 0),
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
    valueLabel: `${Number(row.nexValue || 0).toLocaleString("th-TH")} NEX`,
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
