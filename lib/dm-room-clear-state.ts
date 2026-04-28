import { prisma } from "@/lib/prisma";

type DmRoomClearStateRow = {
  roomId: string;
  clearedAt: Date | string;
};

type DmConversationClearStateRow = {
  peerUserId: string;
  clearedAt: Date | string;
};

let dmRoomClearStateSchemaReadyPromise: Promise<void> | null = null;
let dmConversationClearStateSchemaReadyPromise: Promise<void> | null = null;

function normalizeTimestamp(value?: string | Date | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

async function resolveUserAliases(rawUserId: string) {
  const value = String(rawUserId || "").trim();

  if (!value) {
    return [];
  }

  const user = await prisma.user
    .findFirst({
      where: {
        OR: [{ id: value }, { lineId: value }],
      },
      select: {
        id: true,
        lineId: true,
      },
    })
    .catch(() => null);

  return Array.from(
    new Set(
      [value, user?.id, user?.lineId]
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
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

async function ensureDmConversationClearStateSchema() {
  if (!dmConversationClearStateSchemaReadyPromise) {
    dmConversationClearStateSchemaReadyPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "dmConversationClearState" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "peerUserId" TEXT NOT NULL,
          "clearedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "dmConversationClearState_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "dmConversationClearState_userId_peerUserId_key"
        ON "dmConversationClearState"("userId", "peerUserId")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "dmConversationClearState_userId_idx"
        ON "dmConversationClearState"("userId")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "dmConversationClearState_peerUserId_idx"
        ON "dmConversationClearState"("peerUserId")
      `);
    })().catch((error) => {
      dmConversationClearStateSchemaReadyPromise = null;
      throw error;
    });
  }

  return dmConversationClearStateSchemaReadyPromise;
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

export async function getDmConversationClearedAtMap(
  userId: string,
  peerUserIds: string[]
) {
  const safeUserId = String(userId || "").trim();
  const safePeerUserIds = Array.from(
    new Set(peerUserIds.map((peerUserId) => String(peerUserId || "").trim()).filter(Boolean))
  );

  if (!safeUserId || safePeerUserIds.length === 0) {
    return new Map<string, string>();
  }

  try {
    await ensureDmConversationClearStateSchema();
    const placeholders = safePeerUserIds
      .map((_, index) => `$${index + 2}`)
      .join(", ");
    const rows = await prisma.$queryRawUnsafe<DmConversationClearStateRow[]>(
      `SELECT "peerUserId", "clearedAt" FROM "dmConversationClearState" WHERE "userId" = $1 AND "peerUserId" IN (${placeholders})`,
      safeUserId,
      ...safePeerUserIds
    );

    return new Map(
      (rows || [])
        .map((row) => [
          String(row.peerUserId || "").trim(),
          normalizeTimestamp(row.clearedAt) || "",
        ] as const)
        .filter(([peerUserId, clearedAt]) => Boolean(peerUserId && clearedAt))
    );
  } catch (error) {
    console.error("LOAD DM CONVERSATION CLEAR STATE MAP ERROR:", error);
    return new Map<string, string>();
  }
}

export async function getDmConversationClearedAtForUser(
  userId: string,
  peerUserId: string
) {
  const map = await getDmConversationClearedAtMap(userId, [peerUserId]);
  return map.get(String(peerUserId || "").trim()) || null;
}

export async function getDmConversationClearedAtForUserAliases(
  userId: string,
  peerUserIds: string[]
) {
  const aliasLists = await Promise.all(
    peerUserIds.map((peerUserId) => resolveUserAliases(peerUserId))
  );
  const aliases = Array.from(new Set(aliasLists.flat().filter(Boolean)));

  if (aliases.length === 0) {
    return null;
  }

  const map = await getDmConversationClearedAtMap(userId, aliases);
  return getLatestClearTimestamp(
    ...aliases.map((alias) => map.get(alias) || null)
  );
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

export async function clearDmConversationForUser(
  userId: string,
  peerUserId: string,
  clearedAtInput?: string | Date | null
) {
  const safeUserId = String(userId || "").trim();
  const safePeerUserId = String(peerUserId || "").trim();
  const clearedAt = normalizeTimestamp(clearedAtInput) || new Date().toISOString();

  if (!safeUserId || !safePeerUserId) {
    return null;
  }

  try {
    await ensureDmConversationClearStateSchema();
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "dmConversationClearState" ("id", "userId", "peerUserId", "clearedAt", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $4, $4)
        ON CONFLICT ("userId", "peerUserId")
        DO UPDATE SET "clearedAt" = EXCLUDED."clearedAt", "updatedAt" = EXCLUDED."updatedAt"
      `,
      `${safeUserId}:${safePeerUserId}`,
      safeUserId,
      safePeerUserId,
      clearedAt
    );

    return clearedAt;
  } catch (error) {
    console.error("UPSERT DM CONVERSATION CLEAR STATE ERROR:", error);
    return null;
  }
}

export async function clearDmConversationForUserAliases(
  userId: string,
  peerUserIds: string[],
  clearedAtInput?: string | Date | null
) {
  const aliasLists = await Promise.all(
    peerUserIds.map((peerUserId) => resolveUserAliases(peerUserId))
  );
  const aliases = Array.from(new Set(aliasLists.flat().filter(Boolean)));

  if (aliases.length === 0) {
    return null;
  }

  const results = await Promise.all(
    aliases.map((alias) =>
      clearDmConversationForUser(userId, alias, clearedAtInput)
    )
  );

  return getLatestClearTimestamp(...results);
}

export function getLatestClearTimestamp(
  ...values: Array<string | Date | null | undefined>
) {
  const timestamps = values
    .map((value) => normalizeTimestamp(value))
    .filter(Boolean)
    .map((value) => new Date(String(value)).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}
