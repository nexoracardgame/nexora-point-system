import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import {
  ensureLocalStoreFile,
  readLocalStoreJson,
  writeLocalStoreJson,
} from "@/lib/local-store-dir";
import { prisma } from "@/lib/prisma";

type StoredPushSubscription = {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PushNotificationPayload = {
  id: string;
  title: string;
  body: string;
  href: string;
  icon?: string | null;
  image?: string | null;
  tag?: string | null;
  type?: string | null;
};

type VapidKeyRecord = {
  id: string;
  publicKey: string;
  privateKey: string;
};

let pushSchemaReadyPromise: Promise<void> | null = null;
let cachedVapidKeys: Promise<VapidKeyRecord> | null = null;

function safeString(value: unknown) {
  return String(value || "").trim();
}

function normalizeSubscriptionRow(
  row: Record<string, unknown>
): StoredPushSubscription {
  return {
    id: safeString(row.id),
    userId: safeString(row.userId || row.userid),
    endpoint: safeString(row.endpoint),
    p256dh: safeString(row.p256dh),
    auth: safeString(row.auth),
    userAgent: safeString(row.userAgent || row.useragent) || null,
    createdAt: new Date(
      safeString(row.createdAt || row.createdat) || Date.now()
    ).toISOString(),
    updatedAt: new Date(
      safeString(row.updatedAt || row.updatedat) || Date.now()
    ).toISOString(),
  };
}

async function ensurePushSchema() {
  if (!pushSchemaReadyPromise) {
    pushSchemaReadyPromise = (async () => {
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS "AppPushSubscription" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "endpoint" TEXT NOT NULL UNIQUE, "p256dh" TEXT NOT NULL, "auth" TEXT NOT NULL, "userAgent" TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "lastSuccessAt" TIMESTAMPTZ, "lastErrorAt" TIMESTAMPTZ, "lastError" TEXT)'
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "AppPushSubscription_user_idx" ON "AppPushSubscription" ("userId", "updatedAt")'
      );
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS "AppPushVapidKey" ("id" TEXT PRIMARY KEY, "publicKey" TEXT NOT NULL, "privateKey" TEXT NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())'
      );
    })();
  }

  return pushSchemaReadyPromise;
}

async function readSubscriptionStore() {
  await ensureLocalStoreFile("push-subscriptions.json");
  return readLocalStoreJson<StoredPushSubscription>("push-subscriptions.json");
}

async function writeSubscriptionStore(items: StoredPushSubscription[]) {
  await ensureLocalStoreFile("push-subscriptions.json");
  await writeLocalStoreJson(
    "push-subscriptions.json",
    JSON.stringify(items, null, 2)
  );
}

function readEnvVapidKeys(): VapidKeyRecord | null {
  const publicKey = safeString(
    process.env.WEB_PUSH_PUBLIC_KEY ||
      process.env.VAPID_PUBLIC_KEY ||
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY
  );
  const privateKey = safeString(
    process.env.WEB_PUSH_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY
  );

  if (!publicKey || !privateKey) {
    return null;
  }

  return {
    id: "env",
    publicKey,
    privateKey,
  };
}

async function getDbVapidKeys() {
  await ensurePushSchema();

  const existingRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    'SELECT * FROM "AppPushVapidKey" WHERE "id" = $1 LIMIT 1',
    "default"
  );
  const existing = existingRows[0];

  if (existing) {
    return {
      id: "default",
      publicKey: safeString(existing.publicKey || existing.publickey),
      privateKey: safeString(existing.privateKey || existing.privatekey),
    };
  }

  const generated = webpush.generateVAPIDKeys();
  await prisma.$executeRawUnsafe(
    'INSERT INTO "AppPushVapidKey" ("id", "publicKey", "privateKey", "createdAt") VALUES ($1, $2, $3, NOW()) ON CONFLICT ("id") DO NOTHING',
    "default",
    generated.publicKey,
    generated.privateKey
  );

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    'SELECT * FROM "AppPushVapidKey" WHERE "id" = $1 LIMIT 1',
    "default"
  );
  const row = rows[0];

  return {
    id: "default",
    publicKey: safeString(row?.publicKey || row?.publickey || generated.publicKey),
    privateKey: safeString(row?.privateKey || row?.privatekey || generated.privateKey),
  };
}

async function getLocalVapidKeys() {
  await ensureLocalStoreFile("push-vapid-keys.json");
  const existing = await readLocalStoreJson<VapidKeyRecord>(
    "push-vapid-keys.json"
  );
  const current = existing.find((item) => item.id === "default");

  if (current?.publicKey && current?.privateKey) {
    return current;
  }

  const generated = webpush.generateVAPIDKeys();
  const next = {
    id: "default",
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
  };

  await writeLocalStoreJson(
    "push-vapid-keys.json",
    JSON.stringify([next], null, 2)
  );

  return next;
}

export async function getVapidKeys() {
  if (!cachedVapidKeys) {
    cachedVapidKeys = (async () => {
      const envKeys = readEnvVapidKeys();
      if (envKeys) {
        return envKeys;
      }

      try {
        return await getDbVapidKeys();
      } catch {
        return getLocalVapidKeys();
      }
    })();
  }

  return cachedVapidKeys;
}

export async function getWebPushPublicKey() {
  const keys = await getVapidKeys();
  return keys.publicKey;
}

export async function savePushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}) {
  const userId = safeString(input.userId);
  const endpoint = safeString(input.endpoint);
  const p256dh = safeString(input.p256dh);
  const auth = safeString(input.auth);
  const userAgent = safeString(input.userAgent) || null;

  if (!userId || !endpoint || !p256dh || !auth) {
    throw new Error("invalid push subscription");
  }

  try {
    await ensurePushSchema();
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'INSERT INTO "AppPushSubscription" ("id", "userId", "endpoint", "p256dh", "auth", "userAgent", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) ON CONFLICT ("endpoint") DO UPDATE SET "userId" = EXCLUDED."userId", "p256dh" = EXCLUDED."p256dh", "auth" = EXCLUDED."auth", "userAgent" = EXCLUDED."userAgent", "updatedAt" = NOW() RETURNING *',
      `push-sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      endpoint,
      p256dh,
      auth,
      userAgent
    );
    return normalizeSubscriptionRow(rows[0]);
  } catch {
    const items = await readSubscriptionStore();
    const now = new Date().toISOString();
    const existing = items.find((item) => item.endpoint === endpoint);
    const nextItem: StoredPushSubscription = {
      id:
        existing?.id ||
        `local-push-sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      endpoint,
      p256dh,
      auth,
      userAgent,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await writeSubscriptionStore([
      nextItem,
      ...items.filter((item) => item.endpoint !== endpoint),
    ]);

    return nextItem;
  }
}

export async function deletePushSubscriptionByEndpoint(endpoint: string) {
  const safeEndpoint = safeString(endpoint);
  if (!safeEndpoint) {
    return;
  }

  try {
    await ensurePushSchema();
    await prisma.$executeRawUnsafe(
      'DELETE FROM "AppPushSubscription" WHERE "endpoint" = $1',
      safeEndpoint
    );
    return;
  } catch {
    const items = await readSubscriptionStore();
    await writeSubscriptionStore(
      items.filter((item) => item.endpoint !== safeEndpoint)
    );
  }
}

async function getPushSubscriptionsForUser(userId: string) {
  const safeUserId = safeString(userId);
  if (!safeUserId) {
    return [];
  }

  try {
    await ensurePushSchema();
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'SELECT * FROM "AppPushSubscription" WHERE "userId" = $1 ORDER BY "updatedAt" DESC LIMIT 20',
      safeUserId
    );
    return rows.map(normalizeSubscriptionRow);
  } catch {
    const items = await readSubscriptionStore();
    return items
      .filter((item) => item.userId === safeUserId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 20);
  }
}

async function markPushSuccess(endpoint: string) {
  try {
    await ensurePushSchema();
    await prisma.$executeRawUnsafe(
      'UPDATE "AppPushSubscription" SET "lastSuccessAt" = NOW(), "lastErrorAt" = NULL, "lastError" = NULL WHERE "endpoint" = $1',
      endpoint
    );
  } catch {}
}

async function markPushError(endpoint: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  try {
    await ensurePushSchema();
    await prisma.$executeRawUnsafe(
      'UPDATE "AppPushSubscription" SET "lastErrorAt" = NOW(), "lastError" = $2 WHERE "endpoint" = $1',
      endpoint,
      message.slice(0, 500)
    );
  } catch {}
}

function getVapidSubject() {
  const raw = safeString(
    process.env.WEB_PUSH_SUBJECT || process.env.NEXTAUTH_URL
  );

  if (raw.startsWith("mailto:") || raw.startsWith("https://")) {
    return raw;
  }

  return "mailto:support@nexoracardgame.com";
}

function toWebPushSubscription(
  subscription: StoredPushSubscription
): WebPushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

function isGonePushSubscription(error: unknown) {
  const statusCode = Number(
    (error as { statusCode?: number | string } | null)?.statusCode || 0
  );
  return statusCode === 404 || statusCode === 410;
}

export async function sendPushNotificationToUser(
  userId: string,
  payload: PushNotificationPayload
) {
  const safeUserId = safeString(userId);
  const subscriptions = await getPushSubscriptionsForUser(safeUserId);

  if (!safeUserId || subscriptions.length === 0) {
    return;
  }

  const keys = await getVapidKeys();
  const body = JSON.stringify({
    ...payload,
    id: safeString(payload.id) || `push-${Date.now()}`,
    title: safeString(payload.title) || "NEX POINT",
    body: safeString(payload.body),
    href: safeString(payload.href) || "/",
    icon: safeString(payload.icon || payload.image) || "/icon-192-nex-point.png",
    tag: safeString(payload.tag || payload.id) || undefined,
  });
  const topic = safeString(payload.id)
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 32);

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(toWebPushSubscription(subscription), body, {
          TTL: 60 * 60 * 24,
          urgency: "high",
          timeout: 5000,
          topic: topic || undefined,
          vapidDetails: {
            subject: getVapidSubject(),
            publicKey: keys.publicKey,
            privateKey: keys.privateKey,
          },
        });
        await markPushSuccess(subscription.endpoint);
      } catch (error) {
        if (isGonePushSubscription(error)) {
          await deletePushSubscriptionByEndpoint(subscription.endpoint);
          return;
        }

        await markPushError(subscription.endpoint, error);
      }
    })
  );
}
