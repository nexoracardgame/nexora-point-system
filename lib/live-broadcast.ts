import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/staff-auth";

export type LivePlatform = "youtube" | "facebook" | "tiktok";
export type LiveStatus = "active" | "ended";

export type LiveBroadcastRecord = {
  id: string;
  platform: LivePlatform;
  sourceUrl: string;
  embedUrl: string;
  title: string;
  ownerUserId: string;
  ownerName: string;
  status: LiveStatus;
  createdAt: string;
  endedAt: string | null;
  expiresAt: string | null;
};

export type LiveBanRecord = {
  userId: string;
  reason: string;
  bannedByUserId: string;
  bannedByName: string;
  createdAt: string;
  liftedAt: string | null;
};

type DbClient = typeof prisma | Prisma.TransactionClient;

const ACTIVE_TTL_HOURS = 24;
const ACTIVE_STATUS = "active";
const ENDED_STATUS = "ended";
const DEFAULT_LIVE_BAN_REASON =
  "บัญชีนี้ถูกระงับสิทธิ์การไลฟ์เนื่องจากละเมิดข้อบังคับและกฎชุมชนของ NEXORA";

class LiveBusyError extends Error {
  active: LiveBroadcastRecord | null;

  constructor(active: LiveBroadcastRecord | null) {
    super("live_busy");
    this.active = active;
  }
}

function isLiveSchemaError(error: unknown) {
  const source = error as {
    code?: string;
    meta?: { code?: string; message?: string };
    message?: string;
  } | null;
  const code = String(source?.code || source?.meta?.code || "").trim();
  const message = String(source?.message || source?.meta?.message || "")
    .trim()
    .toLowerCase();

  return (
    code === "42P01" ||
    code === "42703" ||
    message.includes("does not exist") ||
    message.includes("column") ||
    message.includes("relation")
  );
}

function cleanHost(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function toSafeUrl(rawUrl: string) {
  let trimmed = extractFirstLiveUrl(rawUrl);
  if (!trimmed) {
    throw new Error("empty_url");
  }

  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed.replace(/^\/+/, "")}`;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("invalid_url");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("invalid_protocol");
  }

  return unwrapSharedUrl(url);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanSharedUrlCandidate(value: string) {
  return decodeHtmlEntities(value)
    .trim()
    .replace(/[),.。]+$/g, "");
}

function cleanLiveUrlCandidate(value: string) {
  return cleanSharedUrlCandidate(value).replace(/[\s;]+$/g, "");
}

function extractFirstLiveUrl(rawValue: string) {
  const raw = String(rawValue || "").trim();
  if (!raw) return "";

  const iframeSrc = raw.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
  if (iframeSrc) {
    return cleanLiveUrlCandidate(iframeSrc);
  }

  const direct = raw.match(/https?:\/\/[^\s<>"']+/i)?.[0];
  if (direct) {
    return cleanLiveUrlCandidate(direct);
  }

  const www = raw.match(/\bwww\.[^\s<>"']+/i)?.[0];
  if (www) {
    return `https://${cleanLiveUrlCandidate(www)}`;
  }

  const bare = raw.match(
    /\b(?:youtu\.be|youtube\.com|m\.youtube\.com|facebook\.com|m\.facebook\.com|fb\.watch|tiktok\.com|m\.tiktok\.com)[^\s<>"']*/i
  )?.[0];
  if (bare) {
    return cleanLiveUrlCandidate(bare);
  }

  return cleanLiveUrlCandidate(raw);
}

function unwrapSharedUrl(url: URL) {
  const host = cleanHost(url.hostname);
  const redirectParamNames = ["u", "url", "q", "target", "redirect", "redirect_url"];

  if (
    host.endsWith("facebook.com") ||
    host.endsWith("youtube.com") ||
    host.endsWith("google.com") ||
    host.endsWith("tiktok.com")
  ) {
    for (const paramName of redirectParamNames) {
      const value = url.searchParams.get(paramName);
      if (!value) continue;

      try {
        const nested = new URL(decodeHtmlEntities(value));
        if (nested.protocol === "https:" || nested.protocol === "http:") {
          return nested;
        }
      } catch {
        continue;
      }
    }
  }

  return url;
}

function getYoutubeId(url: URL) {
  const host = cleanHost(url.hostname);

  if (host === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] || "";
  }

  if (!host.endsWith("youtube.com") && !host.endsWith("youtube-nocookie.com")) {
    return "";
  }

  if (url.pathname === "/watch") {
    return url.searchParams.get("v") || "";
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const embedLike = ["embed", "shorts", "live", "v", "e"];
  if (parts.length >= 2 && embedLike.includes(parts[0])) {
    return parts[1] || "";
  }

  return "";
}

function withEmbedParams(url: URL, muted: boolean) {
  url.searchParams.set("autoplay", "1");
  url.searchParams.set("mute", muted ? "1" : "0");
  url.searchParams.set("playsinline", "1");
  url.searchParams.set("rel", "0");
  return url.toString();
}

function getTikTokVideoId(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  const videoIndex = parts.findIndex((part) => part === "video");
  if (videoIndex >= 0 && parts[videoIndex + 1]) {
    return parts[videoIndex + 1].replace(/\D/g, "");
  }

  const numericPart = [...parts]
    .reverse()
    .find((part) => /^\d{12,}$/.test(part));

  return numericPart || "";
}

function getTikTokUsername(url: URL) {
  const usernamePart = url.pathname
    .split("/")
    .filter(Boolean)
    .find((part) => part.startsWith("@"));

  return usernamePart ? usernamePart.slice(1).trim() : "";
}

function withTikTokPlayerParams(url: URL) {
  url.searchParams.set("autoplay", "1");
  url.searchParams.set("muted", "0");
  url.searchParams.set("controls", "1");
  url.searchParams.set("progress_bar", "1");
  url.searchParams.set("volume_control", "1");
  url.searchParams.set("fullscreen_button", "1");
  url.searchParams.set("rel", "0");
  return url.toString();
}

export function buildLiveEmbed(rawUrl: string) {
  const sourceUrl = toSafeUrl(rawUrl);
  const host = cleanHost(sourceUrl.hostname);

  if (
    host === "youtu.be" ||
    host.endsWith("youtube.com") ||
    host.endsWith("youtube-nocookie.com")
  ) {
    const videoId = getYoutubeId(sourceUrl).trim();
    const parts = sourceUrl.pathname.split("/").filter(Boolean);
    const channelId =
      parts[0] === "channel" && parts[1] && parts.includes("live")
        ? parts[1]
        : sourceUrl.pathname === "/embed/live_stream"
          ? sourceUrl.searchParams.get("channel") || ""
        : "";

    return {
      platform: "youtube" as const,
      sourceUrl: sourceUrl.toString(),
      embedUrl: videoId
        ? withEmbedParams(
            new URL(
              `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`
            ),
            false
          )
        : channelId
          ? withEmbedParams(
              new URL(
                `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(
                  channelId
                )}`
              ),
              false
            )
          : sourceUrl.toString(),
      title: "YouTube Live",
    };
  }

  if (host.endsWith("facebook.com") || host === "fb.watch") {
    const embedUrl = new URL("https://www.facebook.com/plugins/video.php");
    embedUrl.searchParams.set("href", sourceUrl.toString());
    embedUrl.searchParams.set("show_text", "false");
    embedUrl.searchParams.set("autoplay", "true");
    embedUrl.searchParams.set("mute", "false");
    embedUrl.searchParams.set("width", "560");

    return {
      platform: "facebook" as const,
      sourceUrl: sourceUrl.toString(),
      embedUrl: embedUrl.toString(),
      title: "Facebook Live",
    };
  }

  if (host.endsWith("tiktok.com")) {
    const videoId = getTikTokVideoId(sourceUrl);
    const username = getTikTokUsername(sourceUrl);
    const isLiveUrl = sourceUrl.pathname
      .split("/")
      .filter(Boolean)
      .includes("live");
    const embedUrl = videoId
      ? withTikTokPlayerParams(
          new URL(
            `https://www.tiktok.com/player/v1/${encodeURIComponent(videoId)}`
          )
        )
      : username && isLiveUrl
        ? `https://www.tiktok.com/@${encodeURIComponent(username)}/live`
        : sourceUrl.toString();

    return {
      platform: "tiktok" as const,
      sourceUrl: sourceUrl.toString(),
      embedUrl,
      title: "TikTok Live",
    };
  }

  throw new Error("unsupported_platform");
}

function rowValue(row: Record<string, unknown>, key: string) {
  return row[key] ?? row[key.toLowerCase()];
}

function serializeDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function isLiveModeratorRole(role?: string | null) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "superadmin" || isStaffRole(normalized);
}

function normalizeLiveRow(row: unknown): LiveBroadcastRecord | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const source = row as Record<string, unknown>;
  const createdAt = serializeDate(rowValue(source, "createdAt")) || new Date().toISOString();

  return {
    id: String(rowValue(source, "id") || ""),
    platform: String(rowValue(source, "platform") || "youtube") as LivePlatform,
    sourceUrl: String(rowValue(source, "sourceUrl") || ""),
    embedUrl: String(rowValue(source, "embedUrl") || ""),
    title: String(rowValue(source, "title") || "Live"),
    ownerUserId: String(rowValue(source, "ownerUserId") || ""),
    ownerName: String(rowValue(source, "ownerName") || "NEXORA"),
    status: String(rowValue(source, "status") || ACTIVE_STATUS) as LiveStatus,
    createdAt,
    endedAt: serializeDate(rowValue(source, "endedAt")),
    expiresAt: serializeDate(rowValue(source, "expiresAt")),
  };
}

function normalizeLiveBanRow(row: unknown): LiveBanRecord | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const source = row as Record<string, unknown>;
  const userId = String(rowValue(source, "userId") || "").trim();
  if (!userId) {
    return null;
  }

  return {
    userId,
    reason:
      String(rowValue(source, "reason") || "").trim() ||
      DEFAULT_LIVE_BAN_REASON,
    bannedByUserId: String(rowValue(source, "bannedByUserId") || "").trim(),
    bannedByName:
      String(rowValue(source, "bannedByName") || "").trim() || "NEXORA Admin",
    createdAt:
      serializeDate(rowValue(source, "createdAt")) || new Date().toISOString(),
    liftedAt: serializeDate(rowValue(source, "liftedAt")),
  };
}

export async function ensureLiveBroadcastSchema(db: DbClient = prisma) {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LiveBroadcast" (
      "id" TEXT PRIMARY KEY,
      "platform" TEXT NOT NULL,
      "sourceUrl" TEXT NOT NULL,
      "embedUrl" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "ownerUserId" TEXT NOT NULL,
      "ownerName" TEXT NOT NULL DEFAULT 'NEXORA',
      "status" TEXT NOT NULL DEFAULT 'active',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "endedAt" TIMESTAMPTZ,
      "expiresAt" TIMESTAMPTZ
    )
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcast"
    ADD COLUMN IF NOT EXISTS "id" TEXT
  `);

  await db.$executeRawUnsafe(`
    UPDATE "LiveBroadcast"
    SET "id" = 'live-' || md5(random()::text || clock_timestamp()::text)
    WHERE "id" IS NULL OR "id" = ''
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcast"
    ALTER COLUMN "id" SET NOT NULL
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcast"
    ADD COLUMN IF NOT EXISTS "platform" TEXT NOT NULL DEFAULT 'youtube'
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcast"
    ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT NOT NULL DEFAULT ''
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcast"
    ADD COLUMN IF NOT EXISTS "embedUrl" TEXT NOT NULL DEFAULT ''
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcast"
    ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT 'Live'
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcast"
    ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT NOT NULL DEFAULT ''
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcast"
    ADD COLUMN IF NOT EXISTS "ownerName" TEXT NOT NULL DEFAULT 'NEXORA'
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcast"
    ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active'
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcast"
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcast"
    ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcast"
    ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMPTZ
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcast"
    ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LiveBroadcastBan" (
      "userId" TEXT PRIMARY KEY,
      "reason" TEXT NOT NULL DEFAULT '${DEFAULT_LIVE_BAN_REASON.replace(/'/g, "''")}',
      "bannedByUserId" TEXT NOT NULL,
      "bannedByName" TEXT NOT NULL DEFAULT 'NEXORA Admin',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "liftedAt" TIMESTAMPTZ
    )
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcastBan"
    ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT ''
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcastBan"
    ADD COLUMN IF NOT EXISTS "reason" TEXT NOT NULL DEFAULT '${DEFAULT_LIVE_BAN_REASON.replace(/'/g, "''")}'
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcastBan"
    ADD COLUMN IF NOT EXISTS "bannedByUserId" TEXT NOT NULL DEFAULT ''
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcastBan"
    ADD COLUMN IF NOT EXISTS "bannedByName" TEXT NOT NULL DEFAULT 'NEXORA Admin'
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcastBan"
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "LiveBroadcastBan"
    ADD COLUMN IF NOT EXISTS "liftedAt" TIMESTAMPTZ
  `);

  await db.$executeRawUnsafe(
    `
      UPDATE "LiveBroadcast"
      SET "status" = $1, "endedAt" = COALESCE("endedAt", NOW())
      WHERE "status" = $2
        AND ctid NOT IN (
          SELECT ctid
          FROM "LiveBroadcast"
          WHERE "status" = $2
          ORDER BY "createdAt" DESC
          LIMIT 1
        )
    `,
    ENDED_STATUS,
    ACTIVE_STATUS
  );

  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "LiveBroadcast_one_active_idx"
    ON "LiveBroadcast" ("status")
    WHERE "status" = 'active'
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "LiveBroadcast_createdAt_idx"
    ON "LiveBroadcast" ("createdAt" DESC)
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "LiveBroadcastBan_active_idx"
    ON "LiveBroadcastBan" ("createdAt" DESC)
    WHERE "liftedAt" IS NULL
  `);
}

async function expireOldLiveBroadcasts(db: DbClient = prisma) {
  await db.$executeRawUnsafe(
    `
      UPDATE "LiveBroadcast"
      SET "status" = $1, "endedAt" = COALESCE("endedAt", NOW())
      WHERE "status" = $2
        AND "expiresAt" IS NOT NULL
        AND "expiresAt" < NOW()
    `,
    ENDED_STATUS,
    ACTIVE_STATUS
  );
}

export async function getActiveLiveBroadcastBan(
  userId: string,
  db: DbClient = prisma,
  options?: { ensureSchema?: boolean }
) {
  const safeUserId = String(userId || "").trim();
  if (!safeUserId) {
    return null;
  }

  if (options?.ensureSchema !== false) {
    await ensureLiveBroadcastSchema(db);
  }
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT *
      FROM "LiveBroadcastBan"
      WHERE "userId" = $1 AND "liftedAt" IS NULL
      LIMIT 1
    `,
    safeUserId
  );

  return normalizeLiveBanRow(rows[0]);
}

async function getUserRoleForLiveModeration(userId: string, db: DbClient) {
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT "role"
      FROM "User"
      WHERE "id" = $1 OR "lineId" = $1
      LIMIT 1
    `,
    userId
  );

  return String(rows[0]?.role || "").trim().toLowerCase();
}

export async function getActiveLiveBroadcast(
  db: DbClient = prisma,
  options?: { ensureSchema?: boolean; expireOld?: boolean }
) {
  if (options?.ensureSchema !== false) {
    await ensureLiveBroadcastSchema(db);
  }

  if (options?.expireOld !== false) {
    await expireOldLiveBroadcasts(db);
  }

  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT *
      FROM "LiveBroadcast"
      WHERE "status" = $1
      ORDER BY "createdAt" DESC
      LIMIT 1
    `,
    ACTIVE_STATUS
  );

  return normalizeLiveRow(rows[0]);
}

export async function createLiveBroadcast(input: {
  sourceUrl: string;
  ownerUserId: string;
  ownerName?: string;
}) {
  const embed = buildLiveEmbed(input.sourceUrl);

  const createInCurrentSchema = () =>
    prisma.$transaction(async (tx) => {
      await expireOldLiveBroadcasts(tx);

      const ban = await getActiveLiveBroadcastBan(input.ownerUserId, tx, {
        ensureSchema: false,
      });
      if (ban) {
        return {
          ok: false as const,
          reason: "banned" as const,
          active: null,
          ban,
        };
      }

      const existing = await getActiveLiveBroadcast(tx, {
        ensureSchema: false,
        expireOld: false,
      });
      if (existing) {
        throw new LiveBusyError(existing);
      }

      const id = randomUUID();
      const title = embed.title;
      const ownerName = input.ownerName?.trim() || "NEXORA";

      const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
        `
          INSERT INTO "LiveBroadcast" (
            "id", "platform", "sourceUrl", "embedUrl", "title",
            "ownerUserId", "ownerName", "status", "lastSeenAt", "expiresAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW() + ($9::text || ' hours')::interval)
          RETURNING *
        `,
        id,
        embed.platform,
        embed.sourceUrl,
        embed.embedUrl,
        title,
        input.ownerUserId,
        ownerName,
        ACTIVE_STATUS,
        String(ACTIVE_TTL_HOURS)
      );

      return {
        ok: true as const,
        active: normalizeLiveRow(rows[0]),
      };
    });

  try {
    return await createInCurrentSchema();
  } catch (error) {
    if (error instanceof LiveBusyError) {
      return {
        ok: false as const,
        reason: "busy" as const,
        active: error.active,
      };
    }

    if (isLiveSchemaError(error)) {
      await ensureLiveBroadcastSchema(prisma);
      return await createInCurrentSchema();
    }

    throw error;
  }
}

export async function touchLiveBroadcast(input: {
  actorUserId: string;
  actorRole?: string | null;
}) {
  await ensureLiveBroadcastSchema(prisma);
  await expireOldLiveBroadcasts(prisma);

  const active = await getActiveLiveBroadcast(prisma);
  if (!active) {
    return { ok: true as const, active: null };
  }

  const canTouch =
    active.ownerUserId === input.actorUserId ||
    isLiveModeratorRole(input.actorRole);

  if (!canTouch) {
    return { ok: false as const, reason: "forbidden" as const, active };
  }

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      UPDATE "LiveBroadcast"
      SET "lastSeenAt" = NOW()
      WHERE "id" = $1 AND "status" = $2
      RETURNING *
    `,
    active.id,
    ACTIVE_STATUS
  );

  return {
    ok: true as const,
    active: normalizeLiveRow(rows[0]),
  };
}

export async function stopLiveBroadcast(input: {
  actorUserId: string;
  actorRole?: string | null;
}) {
  await ensureLiveBroadcastSchema(prisma);
  await expireOldLiveBroadcasts(prisma);

  const active = await getActiveLiveBroadcast(prisma);
  if (!active) {
    return { ok: true as const, active: null };
  }

  const canStop =
    active.ownerUserId === input.actorUserId ||
    isLiveModeratorRole(input.actorRole);

  if (!canStop) {
    return { ok: false as const, reason: "forbidden" as const, active };
  }

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      UPDATE "LiveBroadcast"
      SET "status" = $1, "endedAt" = NOW()
      WHERE "id" = $2 AND "status" = $3
      RETURNING *
    `,
    ENDED_STATUS,
    active.id,
    ACTIVE_STATUS
  );

  return {
    ok: true as const,
    active: normalizeLiveRow(rows[0]),
  };
}

export async function banLiveBroadcaster(input: {
  targetUserId: string;
  actorUserId: string;
  actorRole?: string | null;
  actorName?: string | null;
  reason?: string | null;
}) {
  const targetUserId = String(input.targetUserId || "").trim();
  if (!targetUserId) {
    return { ok: false as const, reason: "target_required" as const };
  }

  if (!isLiveModeratorRole(input.actorRole)) {
    return { ok: false as const, reason: "forbidden" as const };
  }

  if (targetUserId === input.actorUserId) {
    return { ok: false as const, reason: "cannot_ban_self" as const };
  }

  const banInCurrentSchema = () => prisma.$transaction(async (tx) => {
    const actorRole = String(input.actorRole || "").trim().toLowerCase();
    const targetRole = await getUserRoleForLiveModeration(targetUserId, tx);
    if (isLiveModeratorRole(targetRole) && actorRole !== "superadmin") {
      return { ok: false as const, reason: "protected_user" as const };
    }

    const reason =
      String(input.reason || "").trim() || DEFAULT_LIVE_BAN_REASON;
    const actorName =
      String(input.actorName || "").trim() || "NEXORA Admin";
    const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        INSERT INTO "LiveBroadcastBan" (
          "userId", "reason", "bannedByUserId", "bannedByName", "createdAt", "liftedAt"
        )
        VALUES ($1, $2, $3, $4, NOW(), NULL)
        ON CONFLICT ("userId") DO UPDATE
        SET
          "reason" = EXCLUDED."reason",
          "bannedByUserId" = EXCLUDED."bannedByUserId",
          "bannedByName" = EXCLUDED."bannedByName",
          "createdAt" = NOW(),
          "liftedAt" = NULL
        RETURNING *
      `,
      targetUserId,
      reason,
      input.actorUserId,
      actorName
    );

    await tx.$executeRawUnsafe(
      `
        UPDATE "LiveBroadcast"
        SET "status" = $1, "endedAt" = COALESCE("endedAt", NOW())
        WHERE "ownerUserId" = $2 AND "status" = $3
      `,
      ENDED_STATUS,
      targetUserId,
      ACTIVE_STATUS
    );

    return {
      ok: true as const,
      ban: normalizeLiveBanRow(rows[0]),
      active: await getActiveLiveBroadcast(tx, {
        ensureSchema: false,
        expireOld: false,
      }),
    };
  });

  try {
    return await banInCurrentSchema();
  } catch (error) {
    if (isLiveSchemaError(error)) {
      await ensureLiveBroadcastSchema(prisma);
      return await banInCurrentSchema();
    }

    throw error;
  }
}

export async function unbanLiveBroadcaster(input: {
  targetUserId: string;
  actorRole?: string | null;
}) {
  const targetUserId = String(input.targetUserId || "").trim();
  if (!targetUserId) {
    return { ok: false as const, reason: "target_required" as const };
  }

  if (!isLiveModeratorRole(input.actorRole)) {
    return { ok: false as const, reason: "forbidden" as const };
  }

  const unbanInCurrentSchema = async () => {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        UPDATE "LiveBroadcastBan"
        SET "liftedAt" = NOW()
        WHERE "userId" = $1 AND "liftedAt" IS NULL
        RETURNING *
      `,
      targetUserId
    );

    return {
      ok: true as const,
      ban: normalizeLiveBanRow(rows[0]),
      active: await getActiveLiveBroadcast(prisma, {
        ensureSchema: false,
        expireOld: false,
      }),
    };
  };

  try {
    return await unbanInCurrentSchema();
  } catch (error) {
    if (isLiveSchemaError(error)) {
      await ensureLiveBroadcastSchema(prisma);
      return await unbanInCurrentSchema();
    }

    throw error;
  }
}
