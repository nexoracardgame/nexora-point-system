import { createHash, randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = typeof prisma | Prisma.TransactionClient;

type CriticalBackupInput = {
  scope: "wallet" | "reward" | "coupon" | "admin" | "system";
  action: string;
  actorUserId?: string | null;
  targetUserId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  meta?: Record<string, unknown> | null;
  requestId?: string | null;
};

type CriticalBackupRow = {
  id: string;
  scope: string;
  action: string;
  actorUserId: string | null;
  targetUserId: string | null;
  entityType: string | null;
  entityId: string | null;
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
  meta: unknown;
  previousHash: string | null;
  hash: string;
  createdAt: Date;
};

function stableJson(value: unknown) {
  return JSON.stringify(value ?? null, (_key, current) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return current;
    }

    return Object.keys(current)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = (current as Record<string, unknown>)[key];
        return acc;
      }, {});
  });
}

function buildHash(payload: unknown) {
  const secret =
    process.env.CRITICAL_BACKUP_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "nexora-critical-backup";

  return createHash("sha256")
    .update(secret)
    .update("|")
    .update(stableJson(payload))
    .digest("hex");
}

export async function ensureCriticalBackupSchema(db: DbClient = prisma) {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CriticalBackupLog" (
      "id" TEXT PRIMARY KEY,
      "scope" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "actorUserId" TEXT,
      "targetUserId" TEXT,
      "entityType" TEXT,
      "entityId" TEXT,
      "beforeSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "afterSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "meta" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "requestId" TEXT,
      "previousHash" TEXT,
      "hash" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CriticalBackupLog_scope_created_idx"
    ON "CriticalBackupLog" ("scope", "createdAt" DESC)
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CriticalBackupLog_entity_idx"
    ON "CriticalBackupLog" ("entityType", "entityId", "createdAt" DESC)
  `);
}

export async function writeCriticalBackup(
  db: DbClient,
  input: CriticalBackupInput
) {
  await ensureCriticalBackupSchema(db);

  const previous = await db.$queryRawUnsafe<Array<{ hash: string | null }>>(
    'SELECT "hash" FROM "CriticalBackupLog" ORDER BY "createdAt" DESC LIMIT 1'
  );
  const previousHash = previous[0]?.hash || null;
  const id = `critical-${Date.now()}-${randomUUID()}`;

  const rowPayload = {
    id,
    previousHash,
    ...input,
    beforeSnapshot: input.beforeSnapshot ?? {},
    afterSnapshot: input.afterSnapshot ?? {},
    meta: input.meta ?? {},
  };
  const hash = buildHash(rowPayload);

  await db.$executeRawUnsafe(
    `INSERT INTO "CriticalBackupLog"
      ("id", "scope", "action", "actorUserId", "targetUserId", "entityType", "entityId",
       "beforeSnapshot", "afterSnapshot", "meta", "requestId", "previousHash", "hash")
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, CAST($8 AS JSONB), CAST($9 AS JSONB),
       CAST($10 AS JSONB), $11, $12, $13)`,
    id,
    input.scope,
    input.action,
    input.actorUserId || null,
    input.targetUserId || null,
    input.entityType || null,
    input.entityId || null,
    stableJson(input.beforeSnapshot ?? {}),
    stableJson(input.afterSnapshot ?? {}),
    stableJson(input.meta ?? {}),
    input.requestId || null,
    previousHash,
    hash
  );

  return {
    id,
    hash,
    previousHash,
  };
}

export async function listCriticalBackups(limit = 80) {
  await ensureCriticalBackupSchema(prisma);

  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  return prisma.$queryRawUnsafe<CriticalBackupRow[]>(
    `SELECT
      "id", "scope", "action", "actorUserId", "targetUserId", "entityType", "entityId",
      "beforeSnapshot", "afterSnapshot", "meta", "previousHash", "hash", "createdAt"
     FROM "CriticalBackupLog"
     ORDER BY "createdAt" DESC
     LIMIT $1`,
    safeLimit
  );
}

export async function getCriticalBackup(id: string) {
  await ensureCriticalBackupSchema(prisma);

  const rows = await prisma.$queryRawUnsafe<CriticalBackupRow[]>(
    `SELECT
      "id", "scope", "action", "actorUserId", "targetUserId", "entityType", "entityId",
      "beforeSnapshot", "afterSnapshot", "meta", "previousHash", "hash", "createdAt"
     FROM "CriticalBackupLog"
     WHERE "id" = $1
     LIMIT 1`,
    id
  );

  return rows[0] || null;
}
