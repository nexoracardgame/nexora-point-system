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

type DbClient = typeof prisma | Prisma.TransactionClient;

const ACTIVE_TTL_HOURS = 8;
const ACTIVE_STATUS = "active";
const ENDED_STATUS = "ended";

class LiveBusyError extends Error {
  active: LiveBroadcastRecord | null;

  constructor(active: LiveBroadcastRecord | null) {
    super("live_busy");
    this.active = active;
  }
}

function cleanHost(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function toSafeUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("empty_url");
  }

  const url = new URL(trimmed);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("invalid_protocol");
  }

  return url;
}

function getYoutubeId(url: URL) {
  const host = cleanHost(url.hostname);

  if (host === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] || "";
  }

  if (!host.endsWith("youtube.com")) {
    return "";
  }

  if (url.pathname === "/watch") {
    return url.searchParams.get("v") || "";
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const embedLike = ["embed", "shorts", "live"];
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

export function buildLiveEmbed(rawUrl: string) {
  const sourceUrl = toSafeUrl(rawUrl);
  const host = cleanHost(sourceUrl.hostname);

  if (host === "youtu.be" || host.endsWith("youtube.com")) {
    const videoId = getYoutubeId(sourceUrl).trim();
    if (!videoId) {
      throw new Error("unsupported_youtube_url");
    }

    return {
      platform: "youtube" as const,
      sourceUrl: sourceUrl.toString(),
      embedUrl: withEmbedParams(
        new URL(`https://www.youtube.com/embed/${encodeURIComponent(videoId)}`),
        true
      ),
      title: "YouTube Live",
    };
  }

  if (host.endsWith("facebook.com") || host === "fb.watch") {
    const embedUrl = new URL("https://www.facebook.com/plugins/video.php");
    embedUrl.searchParams.set("href", sourceUrl.toString());
    embedUrl.searchParams.set("show_text", "false");
    embedUrl.searchParams.set("autoplay", "true");
    embedUrl.searchParams.set("mute", "true");
    embedUrl.searchParams.set("width", "560");

    return {
      platform: "facebook" as const,
      sourceUrl: sourceUrl.toString(),
      embedUrl: embedUrl.toString(),
      title: "Facebook Live",
    };
  }

  if (host.endsWith("tiktok.com")) {
    const embedUrl = new URL("https://www.tiktok.com/embed/v2");
    const videoId = sourceUrl.pathname.split("/").filter(Boolean).pop() || "";

    if (videoId && /^\d+$/.test(videoId)) {
      embedUrl.pathname = `/embed/v2/${videoId}`;
    } else {
      embedUrl.searchParams.set("url", sourceUrl.toString());
    }

    return {
      platform: "tiktok" as const,
      sourceUrl: sourceUrl.toString(),
      embedUrl: embedUrl.toString(),
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
      "endedAt" TIMESTAMPTZ,
      "expiresAt" TIMESTAMPTZ
    )
  `);

  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "LiveBroadcast_one_active_idx"
    ON "LiveBroadcast" ("status")
    WHERE "status" = 'active'
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "LiveBroadcast_createdAt_idx"
    ON "LiveBroadcast" ("createdAt" DESC)
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

export async function getActiveLiveBroadcast(db: DbClient = prisma) {
  await ensureLiveBroadcastSchema(db);
  await expireOldLiveBroadcasts(db);

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

  try {
    return await prisma.$transaction(async (tx) => {
      await ensureLiveBroadcastSchema(tx);
      await expireOldLiveBroadcasts(tx);

      const existing = await getActiveLiveBroadcast(tx);
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
            "ownerUserId", "ownerName", "status", "expiresAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() + ($9::text || ' hours')::interval)
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
  } catch (error) {
    if (error instanceof LiveBusyError) {
      return {
        ok: false as const,
        reason: "busy" as const,
        active: error.active,
      };
    }

    throw error;
  }
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

  const role = String(input.actorRole || "").toLowerCase();
  const canStop =
    active.ownerUserId === input.actorUserId ||
    role === "admin" ||
    isStaffRole(role);

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
