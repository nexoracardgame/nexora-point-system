import { prisma } from "@/lib/prisma";

type DmRoomClearStateRow = {
  roomId: string;
  clearedAt: Date | string;
};

let dmRoomClearStateSchemaReadyPromise: Promise<void> | null = null;

function normalizeTimestamp(value?: string | Date | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

async function ensureDmRoomClearStateSchema() {
  if (!dmRoomClearStateSchemaReadyPromise) {
    dmRoomClearStateSchemaReadyPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "dmRoomClearState" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "roomId" TEXT NOT NULL,
          "clearedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "dmRoomClearState_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "dmRoomClearState_userId_roomId_key"
        ON "dmRoomClearState"("userId", "roomId")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "dmRoomClearState_userId_idx"
        ON "dmRoomClearState"("userId")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "dmRoomClearState_roomId_idx"
        ON "dmRoomClearState"("roomId")
      `);
    })().catch((error) => {
      dmRoomClearStateSchemaReadyPromise = null;
      throw error;
    });
  }

  return dmRoomClearStateSchemaReadyPromise;
}

export function isRoomActivityVisibleAfterClear(
  value?: string | Date | null,
  clearedAt?: string | Date | null
) {
  const activityTime = normalizeTimestamp(value)
    ? new Date(normalizeTimestamp(value) as string).getTime()
    : 0;
  const clearedTime = normalizeTimestamp(clearedAt)
    ? new Date(normalizeTimestamp(clearedAt) as string).getTime()
    : 0;

  if (!clearedTime) {
    return true;
  }

  if (!activityTime) {
    return false;
  }

  return activityTime > clearedTime;
}

export async function getDmRoomClearedAtMap(
  userId: string,
  roomIds: string[]
) {
  const safeUserId = String(userId || "").trim();
  const safeRoomIds = Array.from(
    new Set(roomIds.map((roomId) => String(roomId || "").trim()).filter(Boolean))
  );

  if (!safeUserId || safeRoomIds.length === 0) {
    return new Map<string, string>();
  }

  try {
    await ensureDmRoomClearStateSchema();
    const placeholders = safeRoomIds.map((_, index) => `$${index + 2}`).join(", ");
    const rows = await prisma.$queryRawUnsafe<DmRoomClearStateRow[]>(
      `SELECT "roomId", "clearedAt" FROM "dmRoomClearState" WHERE "userId" = $1 AND "roomId" IN (${placeholders})`,
      safeUserId,
      ...safeRoomIds
    );

    return new Map(
      (rows || [])
        .map((row) => [
          String(row.roomId || "").trim(),
          normalizeTimestamp(row.clearedAt) || "",
        ] as const)
        .filter(([roomId, clearedAt]) => Boolean(roomId && clearedAt))
    );
  } catch (error) {
    console.error("LOAD DM CLEAR STATE MAP ERROR:", error);
    return new Map<string, string>();
  }
}

export async function getDmRoomClearedAtForUser(userId: string, roomId: string) {
  const map = await getDmRoomClearedAtMap(userId, [roomId]);
  return map.get(String(roomId || "").trim()) || null;
}

export async function clearDmRoomForUser(
  userId: string,
  roomId: string,
  clearedAtInput?: string | Date | null
) {
  const safeUserId = String(userId || "").trim();
  const safeRoomId = String(roomId || "").trim();
  const clearedAt = normalizeTimestamp(clearedAtInput) || new Date().toISOString();

  if (!safeUserId || !safeRoomId) {
    return null;
  }

  try {
    await ensureDmRoomClearStateSchema();
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "dmRoomClearState" ("id", "userId", "roomId", "clearedAt", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $4, $4)
        ON CONFLICT ("userId", "roomId")
        DO UPDATE SET "clearedAt" = EXCLUDED."clearedAt", "updatedAt" = EXCLUDED."updatedAt"
      `,
      `${safeUserId}:${safeRoomId}`,
      safeUserId,
      safeRoomId,
      clearedAt
    );

    return clearedAt;
  } catch (error) {
    console.error("UPSERT DM CLEAR STATE ERROR:", error);
    return null;
  }
}
