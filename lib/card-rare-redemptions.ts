import { prisma } from "@/lib/prisma";
import {
  buildCardRareCode,
  CARD_RARE_CODE_PATTERN,
  extractCardRareCode,
} from "@/lib/card-rare-code";

export const CARD_RARE_REDEMPTION_TTL_MS = 60 * 60 * 1000;
export { buildCardRareCode, CARD_RARE_CODE_PATTERN, extractCardRareCode };

export type CardRareRedemptionStatus =
  | "pending"
  | "approved"
  | "cancelled"
  | "expired";

export type CardRareRedemptionRecord = {
  id: string;
  code: string;
  userId: string;
  cardNo: string;
  cardName: string;
  rewardLabel: string;
  optionKey: string | null;
  conditionLabel: string | null;
  nexValue: number;
  imageUrl: string | null;
  status: CardRareRedemptionStatus;
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

export async function ensureCardRareRedemptionSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CardRareRedemption" (
      "id" TEXT PRIMARY KEY,
      "code" TEXT NOT NULL UNIQUE,
      "userId" TEXT NOT NULL,
      "cardNo" TEXT NOT NULL,
      "cardName" TEXT NOT NULL,
      "rewardLabel" TEXT NOT NULL,
      "optionKey" TEXT NOT NULL DEFAULT 'standard',
      "conditionLabel" TEXT,
      "nexValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "imageUrl" TEXT,
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
    'CREATE INDEX IF NOT EXISTS "CardRareRedemption_userId_status_idx" ON "CardRareRedemption" ("userId", "status")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "CardRareRedemption_createdAt_idx" ON "CardRareRedemption" ("createdAt")'
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "CardRareRedemption" ADD COLUMN IF NOT EXISTS "optionKey" TEXT NOT NULL DEFAULT \'standard\''
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "CardRareRedemption" ADD COLUMN IF NOT EXISTS "conditionLabel" TEXT'
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "CardRareRedemption" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT'
  );
}

export async function expireStaleCardRareRedemptions(userId?: string) {
  await ensureCardRareRedemptionSchema();
  const now = new Date();

  if (userId) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE "CardRareRedemption"
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
      UPDATE "CardRareRedemption"
      SET "status" = 'expired', "cancelledAt" = $1, "cancelReason" = 'expired'
      WHERE "status" = 'pending'
        AND "expiresAt" <= $1
    `,
    now
  );
}

export function serializeCardRareRedemption(row: CardRareRedemptionRecord) {
  const status =
    row.status === "pending" && row.expiresAt.getTime() <= Date.now()
      ? "expired"
      : row.status;

  return {
    id: row.id,
    code: row.code,
    userId: row.userId,
    cardNo: row.cardNo,
    cardName: row.cardName,
    rewardLabel: row.rewardLabel,
    optionKey: row.optionKey || "standard",
    conditionLabel: row.conditionLabel || null,
    nexValue: Number(row.nexValue || 0),
    imageUrl: row.imageUrl || `/cards/${row.cardNo}.jpg`,
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
