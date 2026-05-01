import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ACTIVE_STALE_SECONDS = 5;

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

async function ensurePresenceSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OnlinePresence" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "lineId" TEXT,
      "tabId" TEXT NOT NULL,
      "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "OnlinePresence_lastSeenAt_idx"
    ON "OnlinePresence" ("lastSeenAt" DESC)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "OnlinePresence_userId_idx"
    ON "OnlinePresence" ("userId")
  `);
}

async function readActiveOnlineIds() {
  await ensurePresenceSchema();

  await prisma.$executeRawUnsafe(
    `
      DELETE FROM "OnlinePresence"
      WHERE "lastSeenAt" < NOW() - ($1::text || ' seconds')::interval
    `,
    String(ACTIVE_STALE_SECONDS * 4)
  );

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT DISTINCT "userId", "lineId"
      FROM "OnlinePresence"
      WHERE "lastSeenAt" >= NOW() - ($1::text || ' seconds')::interval
      ORDER BY "userId" ASC
    `,
    String(ACTIVE_STALE_SECONDS)
  );

  return Array.from(
    new Set(
      rows
        .flatMap((row) => [row.userId, row.lineId])
        .map(normalizeId)
        .filter(Boolean)
    )
  );
}

async function parseBody(request: Request) {
  const text = await request.text().catch(() => "");
  if (!text) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function getSessionUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | {
        id?: string | null;
        lineId?: string | null;
      }
    | undefined;
  const userId = normalizeId(user?.id);
  const lineId = normalizeId(user?.lineId || userId);

  if (!userId) {
    return null;
  }

  return { userId, lineId };
}

export async function GET() {
  const actor = await getSessionUser();
  if (!actor) {
    return noStoreJson({ onlineIds: [] }, { status: 401 });
  }

  try {
    return noStoreJson({ onlineIds: await readActiveOnlineIds() });
  } catch (error) {
    console.error("PRESENCE GET ERROR:", error);
    return noStoreJson({ onlineIds: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await getSessionUser();
  if (!actor) {
    return noStoreJson({ onlineIds: [] }, { status: 401 });
  }

  try {
    const body = await parseBody(request);
    const action = normalizeId(body.action || "online").toLowerCase();
    const tabId = normalizeId(body.tabId) || "default";
    const lineId = normalizeId(body.lineId) || actor.lineId;
    const rowId = `${actor.userId}:${tabId}`;

    await ensurePresenceSchema();

    if (action === "offline") {
      await prisma.$executeRawUnsafe(
        `
          DELETE FROM "OnlinePresence"
          WHERE "id" = $1 OR ("userId" = $2 AND "tabId" = $3)
        `,
        rowId,
        actor.userId,
        tabId
      );

      return noStoreJson({ onlineIds: await readActiveOnlineIds() });
    }

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "OnlinePresence" (
          "id", "userId", "lineId", "tabId", "lastSeenAt", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
        ON CONFLICT ("id")
        DO UPDATE SET
          "lineId" = EXCLUDED."lineId",
          "lastSeenAt" = NOW(),
          "updatedAt" = NOW()
      `,
      rowId,
      actor.userId,
      lineId,
      tabId
    );

    return noStoreJson({ onlineIds: await readActiveOnlineIds() });
  } catch (error) {
    console.error("PRESENCE POST ERROR:", error);
    return noStoreJson({ onlineIds: [] }, { status: 500 });
  }
}
