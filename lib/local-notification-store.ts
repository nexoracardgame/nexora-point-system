import {
  ensureLocalStoreFile,
  readLocalStoreJson,
  writeLocalStoreJson,
} from "@/lib/local-store-dir";
import { prisma } from "@/lib/prisma";
import { sendPushNotificationToUser } from "@/lib/push-notification-store";

export type LocalNotificationType = "deal" | "wishlist" | "friend" | "wallet";

export type LocalNotificationMeta = Record<string, string | number | boolean | null>;

export type LocalNotificationRecord = {
  id: string;
  userId: string;
  type: LocalNotificationType;
  title: string;
  body: string;
  href: string;
  image: string;
  meta?: LocalNotificationMeta | null;
  createdAt: string;
  readAt: string | null;
};

let notificationSchemaReadyPromise: Promise<void> | null = null;

function normalizeDbNotification(
  row: Record<string, unknown>
): LocalNotificationRecord {
  const rawMeta = row.meta;
  const meta =
    rawMeta && typeof rawMeta === "object"
      ? (rawMeta as LocalNotificationMeta)
      : null;

  return {
    id: String(row.id || ""),
    userId: String(row.userId || row.userid || ""),
    type: String(row.type || "deal") as LocalNotificationType,
    title: String(row.title || ""),
    body: String(row.body || ""),
    href: String(row.href || "/"),
    image: String(row.image || "/avatar.png"),
    meta,
    createdAt: new Date(
      String(row.createdAt || row.createdat || new Date().toISOString())
    ).toISOString(),
    readAt: row.readAt || row.readat
      ? new Date(String(row.readAt || row.readat)).toISOString()
      : null,
  };
}

async function ensureNotificationSchema() {
  if (!notificationSchemaReadyPromise) {
    notificationSchemaReadyPromise = (async () => {
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS "AppNotification" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "type" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL, "href" TEXT NOT NULL, "image" TEXT NOT NULL DEFAULT \'/avatar.png\', "meta" JSONB, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "readAt" TIMESTAMPTZ)'
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "AppNotification_user_type_read_idx" ON "AppNotification" ("userId", "type", "readAt", "createdAt")'
      );
    })();
  }

  return notificationSchemaReadyPromise;
}

async function ensureStoreFile() {
  return ensureLocalStoreFile("local-notifications.json");
}

async function readStore() {
  await ensureStoreFile();
  return readLocalStoreJson<LocalNotificationRecord>("local-notifications.json");
}

async function writeStore(items: LocalNotificationRecord[]) {
  await ensureStoreFile();
  await writeLocalStoreJson(
    "local-notifications.json",
    JSON.stringify(items, null, 2)
  );
}

async function deliverLocalNotificationPush(notification: LocalNotificationRecord) {
  await sendPushNotificationToUser(notification.userId, {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    href: notification.href,
    icon: notification.image,
    tag: notification.id,
    type: notification.type,
  }).catch(() => undefined);
}

export async function getLocalNotificationsForUser(
  userId: string,
  options?: {
    unreadOnly?: boolean;
    limit?: number;
  }
) {
  const unreadOnly = options?.unreadOnly ?? false;
  const limit = options?.limit ?? 60;
  try {
    await ensureNotificationSchema();
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      unreadOnly
        ? 'SELECT * FROM "AppNotification" WHERE "userId" = $1 AND "readAt" IS NULL ORDER BY "createdAt" DESC LIMIT $2'
        : 'SELECT * FROM "AppNotification" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT $2',
      userId,
      limit
    );
    return rows.map(normalizeDbNotification);
  } catch {
    // Local fallback keeps development usable when the DB is unavailable.
  }

  const items = await readStore();

  return items
    .filter((item) => item.userId === userId)
    .filter((item) => (unreadOnly ? !item.readAt : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function createLocalNotification(
  input: Omit<LocalNotificationRecord, "id" | "createdAt" | "readAt">
) {
  try {
    await ensureNotificationSchema();
    const id = `app-notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'INSERT INTO "AppNotification" ("id", "userId", "type", "title", "body", "href", "image", "meta", "createdAt", "readAt") VALUES ($1, $2, $3, $4, $5, $6, $7, CAST($8 AS JSONB), NOW(), NULL) RETURNING *',
      id,
      input.userId,
      input.type,
      input.title,
      input.body,
      input.href,
      input.image || "/avatar.png",
      JSON.stringify(input.meta || null)
    );
    const notification = normalizeDbNotification(rows[0]);
    await deliverLocalNotificationPush(notification);
    return notification;
  } catch {
    // Local fallback below.
  }

  const items = await readStore();

  const notification: LocalNotificationRecord = {
    id: `local-notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    readAt: null,
    ...input,
  };

  items.unshift(notification);
  await writeStore(items);
  await deliverLocalNotificationPush(notification);
  return notification;
}

export async function markLocalNotificationsRead(userId: string, ids: string[]) {
  if (!userId || ids.length === 0) {
    return [];
  }

  const idSet = new Set(ids);
  const readAt = new Date().toISOString();
  try {
    await ensureNotificationSchema();
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'UPDATE "AppNotification" SET "readAt" = NOW() WHERE "userId" = $1 AND "id" = ANY($2::text[]) AND "readAt" IS NULL RETURNING *',
      userId,
      ids
    );
    return rows.map(normalizeDbNotification);
  } catch {
    // Local fallback below.
  }

  const items = await readStore();
  const updated: LocalNotificationRecord[] = [];

  const next = items.map((item) => {
    if (item.userId !== userId || item.readAt || !idSet.has(item.id)) {
      return item;
    }

    const nextItem = {
      ...item,
      readAt,
    };

    updated.push(nextItem);
    return nextItem;
  });

  await writeStore(next);
  return updated;
}

export async function markLocalFriendRequestNotificationsRead(
  userIds: string[],
  requestId: string
) {
  const userIdSet = new Set(userIds.map((id) => String(id || "").trim()).filter(Boolean));
  const targetRequestId = String(requestId || "").trim();

  if (userIdSet.size === 0 || !targetRequestId) {
    return [];
  }

  const readAt = new Date().toISOString();
  try {
    await ensureNotificationSchema();
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'UPDATE "AppNotification" SET "readAt" = NOW() WHERE "userId" = ANY($1::text[]) AND "type" = \'friend\' AND "meta"->>\'requestId\' = $2 AND "readAt" IS NULL RETURNING *',
      Array.from(userIdSet),
      targetRequestId
    );
    return rows.map(normalizeDbNotification);
  } catch {
    // Local fallback below.
  }

  const items = await readStore();
  const updated: LocalNotificationRecord[] = [];

  const next = items.map((item) => {
    if (
      item.readAt ||
      item.type !== "friend" ||
      !userIdSet.has(item.userId) ||
      String(item.meta?.requestId || "") !== targetRequestId
    ) {
      return item;
    }

    const nextItem = {
      ...item,
      readAt,
    };

    updated.push(nextItem);
    return nextItem;
  });

  await writeStore(next);
  return updated;
}

export async function getWalletNotificationCount(userId: string) {
  const items = await getLocalNotificationsForUser(userId, {
    unreadOnly: true,
    limit: 100,
  });
  return items.filter((item) => item.type === "wallet").length;
}

export async function markWalletNotificationsRead(userId: string) {
  if (!userId) return [];

  try {
    await ensureNotificationSchema();
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'UPDATE "AppNotification" SET "readAt" = NOW() WHERE "userId" = $1 AND "type" = \'wallet\' AND "readAt" IS NULL RETURNING *',
      userId
    );
    return rows.map(normalizeDbNotification);
  } catch {
    const items = await getLocalNotificationsForUser(userId, {
      unreadOnly: true,
      limit: 100,
    });
    return markLocalNotificationsRead(
      userId,
      items.filter((item) => item.type === "wallet").map((item) => item.id)
    );
  }
}
