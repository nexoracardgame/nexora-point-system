import {
  ensureLocalStoreFile,
  readLocalStoreJson,
  writeLocalStoreJson,
} from "@/lib/local-store-dir";

export type LocalNotificationType = "deal" | "wishlist" | "friend";

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

export async function getLocalNotificationsForUser(
  userId: string,
  options?: {
    unreadOnly?: boolean;
    limit?: number;
  }
) {
  const unreadOnly = options?.unreadOnly ?? false;
  const limit = options?.limit ?? 60;
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
  const items = await readStore();

  const notification: LocalNotificationRecord = {
    id: `local-notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    readAt: null,
    ...input,
  };

  items.unshift(notification);
  await writeStore(items);
  return notification;
}

export async function markLocalNotificationsRead(userId: string, ids: string[]) {
  if (!userId || ids.length === 0) {
    return [];
  }

  const idSet = new Set(ids);
  const readAt = new Date().toISOString();
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
