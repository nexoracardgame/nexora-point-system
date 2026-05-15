import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = typeof prisma | Prisma.TransactionClient;

let rollbackSchemaReady = false;

export async function ensureCouponRollbackSchema(db: DbClient = prisma) {
  if (rollbackSchemaReady && db === prisma) {
    return;
  }

  try {
    await db.$queryRawUnsafe(
      'SELECT "reversedAt", "reversedById", "reversalReason" FROM "Coupon" LIMIT 0'
    );

    if (db === prisma) {
      rollbackSchemaReady = true;
    }
    return;
  } catch {
    // Older databases need the rollback columns created once.
  }

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

  if (db === prisma) {
    rollbackSchemaReady = true;
  }
}
