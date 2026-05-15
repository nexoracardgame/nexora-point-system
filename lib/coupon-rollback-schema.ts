import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = typeof prisma | Prisma.TransactionClient;

export async function ensureCouponRollbackSchema(db: DbClient = prisma) {
  await db.$executeRawUnsafe(
    'ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3)'
  );
  await db.$executeRawUnsafe(
    'ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "reversedById" TEXT'
  );
  await db.$executeRawUnsafe(
    'ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "reversalReason" TEXT'
  );
  await db.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Coupon_reversedAt_idx" ON "Coupon"("reversedAt")'
  );
}
