import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  cleanupAuctionDealMessagesForAuction,
  deleteAuctionDealMessagesForAuctionIds,
  getAuctionDealChatRoomId,
} from "@/lib/auction-deal-chat";
import { resolveCardDisplayImage, sanitizeCardImageUrl } from "@/lib/card-image";

export type AuctionRoomRecord = {
  id: string;
  roomNumber: number;
  cardNo: string;
  cardName: string;
  imageUrl: string;
  rarity: string;
  openingPrice: number;
  minBidStep: number;
  startsAt: string;
  endsAt: string;
  sellerId: string;
  sellerName: string;
  sellerImage: string;
  status: string;
  createdAt: string;
  confirmedWinnerId: string;
  confirmedAt: string | null;
  topBid: number;
  bidCount: number;
};

export type AuctionBidRecord = {
  id: string;
  auctionId: string;
  bidderId: string;
  bidderName: string;
  bidderImage: string;
  amount: number;
  message: string;
  createdAt: string;
};

type AuctionRoomRow = {
  id: string;
  roomNumber?: number | string | null;
  cardNo: string;
  cardName: string | null;
  imageUrl: string | null;
  rarity: string | null;
  openingPrice: Prisma.Decimal | number | string;
  minBidStep: Prisma.Decimal | number | string;
  startsAt: Date;
  endsAt: Date;
  sellerId: string;
  sellerName: string | null;
  sellerImage: string | null;
  status: string | null;
  createdAt: Date;
  confirmedWinnerId?: string | null;
  confirmedAt?: Date | null;
  topBid?: Prisma.Decimal | number | string | null;
  bidCount?: bigint | number | string | null;
};

type AuctionBidRow = {
  id: string;
  auctionId: string;
  bidderId: string;
  bidderName: string | null;
  bidderImage: string | null;
  amount: Prisma.Decimal | number | string;
  message: string | null;
  createdAt: Date;
};

export type CreateAuctionInput = {
  cardNo: string;
  cardName: string;
  imageUrl?: string | null;
  rarity?: string | null;
  openingPrice: number;
  minBidStep: number;
  startsAt: Date;
  endsAt: Date;
  sellerId: string;
  sellerName: string;
  sellerImage: string;
};

export type CreateAuctionBidInput = {
  auctionId: string;
  bidderId: string;
  bidderName: string;
  bidderImage: string;
  amount: number;
  message?: string | null;
};

export type ConfirmAuctionWinnerInput = {
  auctionId: string;
  winnerId: string;
  actorId: string;
  actorLineId?: string | null;
  isAdmin?: boolean;
};

let auctionSchemaReady: Promise<void> | null = null;
let auctionCleanupReadyAt = 0;
let auctionCleanupPromise: Promise<void> | null = null;

const AUCTION_CLEANUP_INTERVAL_MS = 60 * 1000;
const AUCTION_ROOMS_CACHE_MS = 1200;

type AuctionRoomsMemoryCache = {
  expiresAt: number;
  limit: number;
  rooms: AuctionRoomRecord[];
  promise?: Promise<AuctionRoomRecord[]>;
};

let auctionRoomsCache: AuctionRoomsMemoryCache | null = null;

export function invalidateAuctionRoomsCache() {
  auctionRoomsCache = null;
}

function hasDatabaseConfig() {
  return Boolean(String(process.env.DATABASE_URL || "").trim());
}

function toNumber(value: unknown) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toIso(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeCardNo(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? digits.padStart(3, "0").slice(-3) : "";
}

function normalizeRoom(row: AuctionRoomRow): AuctionRoomRecord {
  const cardNo = normalizeCardNo(row.cardNo);
  const imageUrl = resolveCardDisplayImage(cardNo, row.imageUrl);

  return {
    id: String(row.id || ""),
    roomNumber: Math.max(0, Math.floor(toNumber(row.roomNumber))),
    cardNo,
    cardName: String(row.cardName || `Card #${cardNo}`).trim(),
    imageUrl,
    rarity: String(row.rarity || "Legendary").trim(),
    openingPrice: toNumber(row.openingPrice),
    minBidStep: toNumber(row.minBidStep),
    startsAt: toIso(row.startsAt),
    endsAt: toIso(row.endsAt),
    sellerId: String(row.sellerId || ""),
    sellerName: String(row.sellerName || "Unknown Seller").trim(),
    sellerImage: String(row.sellerImage || "/default-avatar.png").trim(),
    status: String(row.status || "active").trim(),
    createdAt: toIso(row.createdAt),
    confirmedWinnerId: String(row.confirmedWinnerId || "").trim(),
    confirmedAt: row.confirmedAt ? toIso(row.confirmedAt) : null,
    topBid: toNumber(row.topBid),
    bidCount: toNumber(row.bidCount),
  };
}

function normalizeBid(row: AuctionBidRow): AuctionBidRecord {
  return {
    id: String(row.id || ""),
    auctionId: String(row.auctionId || ""),
    bidderId: String(row.bidderId || ""),
    bidderName: String(row.bidderName || "Unknown Bidder").trim(),
    bidderImage: String(row.bidderImage || "/default-avatar.png").trim(),
    amount: toNumber(row.amount),
    message: String(row.message || "").trim(),
    createdAt: toIso(row.createdAt),
  };
}

export async function ensureAuctionSchema() {
  if (!hasDatabaseConfig()) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!auctionSchemaReady) {
    auctionSchemaReady = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AuctionRoom" (
          "id" TEXT PRIMARY KEY,
          "roomNumber" INTEGER,
          "cardNo" TEXT NOT NULL,
          "cardName" TEXT,
          "imageUrl" TEXT,
          "rarity" TEXT,
          "openingPrice" NUMERIC NOT NULL,
          "minBidStep" NUMERIC NOT NULL,
          "startsAt" TIMESTAMPTZ NOT NULL,
          "endsAt" TIMESTAMPTZ NOT NULL,
          "sellerId" TEXT NOT NULL,
          "sellerName" TEXT,
          "sellerImage" TEXT,
          "status" TEXT NOT NULL DEFAULT 'active',
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AuctionBid" (
          "id" TEXT PRIMARY KEY,
          "auctionId" TEXT NOT NULL REFERENCES "AuctionRoom"("id") ON DELETE CASCADE,
          "bidderId" TEXT NOT NULL,
          "bidderName" TEXT,
          "bidderImage" TEXT,
          "amount" NUMERIC NOT NULL,
          "message" TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AuctionBlacklist" (
          "userId" TEXT PRIMARY KEY,
          "reason" TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "AuctionRoom_status_endsAt_idx"
        ON "AuctionRoom" ("status", "endsAt" DESC)
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "AuctionBid_auctionId_createdAt_idx"
        ON "AuctionBid" ("auctionId", "createdAt" ASC)
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AuctionRoom"
        ADD COLUMN IF NOT EXISTS "confirmedWinnerId" TEXT
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AuctionRoom"
        ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMPTZ
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AuctionRoom"
        ADD COLUMN IF NOT EXISTS "roomNumber" INTEGER
      `);

      await prisma.$executeRawUnsafe(`
        WITH ordered AS (
          SELECT
            "id",
            ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS rn
          FROM "AuctionRoom"
          WHERE "roomNumber" IS NULL
        ),
        available AS (
          SELECT
            n,
            ROW_NUMBER() OVER (ORDER BY n ASC) AS rn
          FROM generate_series(
            1,
            GREATEST((SELECT COUNT(*)::int + 100 FROM "AuctionRoom"), 100)
          ) AS n
          WHERE NOT EXISTS (
            SELECT 1
            FROM "AuctionRoom" ar
            WHERE ar."roomNumber" = n
          )
        ),
        mapped AS (
          SELECT ordered."id", available.n
          FROM ordered
          JOIN available ON available.rn = ordered.rn
        )
        UPDATE "AuctionRoom" r
        SET "roomNumber" = mapped.n
        FROM mapped
        WHERE r."id" = mapped."id"
      `);

      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "AuctionRoom_roomNumber_key"
        ON "AuctionRoom" ("roomNumber")
        WHERE "roomNumber" IS NOT NULL
      `);
    })();
  }

  return auctionSchemaReady;
}

async function cleanupExpiredAuctionRooms(force = false) {
  const now = Date.now();
  if (!force && now < auctionCleanupReadyAt) {
    return;
  }

  if (auctionCleanupPromise) {
    await auctionCleanupPromise;
    return;
  }

  auctionCleanupReadyAt = now + AUCTION_CLEANUP_INTERVAL_MS;
  auctionCleanupPromise = (async () => {
    const expiredRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        SELECT "id"
        FROM "AuctionRoom"
        WHERE "endsAt" < NOW() - INTERVAL '7 days'
      `
    );
    const expiredIds = expiredRows.map((row) => String(row.id || "").trim()).filter(Boolean);

    if (expiredIds.length > 0) {
      await deleteAuctionDealMessagesForAuctionIds(expiredIds).catch((error) => {
        console.error("CLEANUP EXPIRED AUCTION DEAL CHAT ERROR:", error);
      });
      invalidateAuctionRoomsCache();
    }

    await prisma.$executeRawUnsafe(`
      DELETE FROM "AuctionRoom"
      WHERE "endsAt" < NOW() - INTERVAL '7 days'
    `);
  })().finally(() => {
    auctionCleanupPromise = null;
  });

  await auctionCleanupPromise;
}

export async function getAuctionRooms(limit = 300) {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const now = Date.now();
  if (
    auctionRoomsCache &&
    auctionRoomsCache.limit === safeLimit &&
    auctionRoomsCache.expiresAt > now
  ) {
    return auctionRoomsCache.rooms;
  }

  if (auctionRoomsCache?.promise && auctionRoomsCache.limit === safeLimit) {
    return auctionRoomsCache.promise;
  }

  await ensureAuctionSchema();

  const promise = (async () => {
    await cleanupExpiredAuctionRooms();

    const rows = await prisma.$queryRawUnsafe<AuctionRoomRow[]>(
      `
        WITH latest_rooms AS (
          SELECT *
          FROM "AuctionRoom"
          ORDER BY "createdAt" DESC
          LIMIT $1
        ),
        bid_stats AS (
          SELECT
            "auctionId",
            MAX("amount") AS "topBid",
            COUNT(*) AS "bidCount"
          FROM "AuctionBid"
          WHERE "auctionId" IN (SELECT "id" FROM latest_rooms)
          GROUP BY "auctionId"
        )
        SELECT
          r.*,
          COALESCE(bid_stats."topBid", 0) AS "topBid",
          COALESCE(bid_stats."bidCount", 0) AS "bidCount"
        FROM latest_rooms r
        LEFT JOIN bid_stats ON bid_stats."auctionId" = r."id"
        ORDER BY r."createdAt" DESC
      `,
      safeLimit
    );

    const rooms = rows.map(normalizeRoom);
    auctionRoomsCache = {
      expiresAt: Date.now() + AUCTION_ROOMS_CACHE_MS,
      limit: safeLimit,
      rooms,
    };
    return rooms;
  })().catch((error) => {
    if (auctionRoomsCache?.promise === promise) {
      auctionRoomsCache = null;
    }
    throw error;
  });

  auctionRoomsCache = {
    expiresAt: now + AUCTION_ROOMS_CACHE_MS,
    limit: safeLimit,
    rooms: auctionRoomsCache?.rooms || [],
    promise,
  };

  return promise;
}

export async function getAuctionRoomWithBids(id: string) {
  await ensureAuctionSchema();
  await cleanupExpiredAuctionRooms();

  const rows = await prisma.$queryRawUnsafe<AuctionRoomRow[]>(
    `
      SELECT
        r.*,
        COALESCE((SELECT MAX(b."amount") FROM "AuctionBid" b WHERE b."auctionId" = r."id"), 0) AS "topBid",
        COALESCE((SELECT COUNT(*) FROM "AuctionBid" b WHERE b."auctionId" = r."id"), 0) AS "bidCount"
      FROM "AuctionRoom" r
      WHERE r."id" = $1
      LIMIT 1
    `,
    id
  );

  const room = rows[0] ? normalizeRoom(rows[0]) : null;
  if (!room) {
    return null;
  }

  const bidRows = await prisma.$queryRawUnsafe<AuctionBidRow[]>(
    `
      SELECT *
      FROM "AuctionBid"
      WHERE "auctionId" = $1
      ORDER BY "createdAt" ASC
    `,
    id
  );

  const bids = bidRows.map(normalizeBid);
  const currentTop = bids.reduce((max, bid) => Math.max(max, bid.amount), 0);
  const nextMinimumBid = (currentTop || room.openingPrice) + room.minBidStep;

  return {
    room: {
      ...room,
      topBid: currentTop,
      bidCount: bids.length,
    },
    bids,
    nextMinimumBid,
  };
}

export async function deleteAuctionRoom(id: string) {
  await ensureAuctionSchema();
  await deleteAuctionDealMessagesForAuctionIds([id]).catch((error) => {
    console.error("DELETE AUCTION DEAL CHAT ERROR:", error);
  });

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `DELETE FROM "AuctionRoom" WHERE "id" = $1 RETURNING "id"`,
    id
  );

  if (rows.length > 0) {
    invalidateAuctionRoomsCache();
  }

  return rows.length > 0;
}

export async function canDeleteAuctionRoom(input: {
  id: string;
  actorId: string;
  actorLineId?: string | null;
  isAdmin?: boolean;
}) {
  await ensureAuctionSchema();

  if (input.isAdmin) {
    return true;
  }

  const actorIds = [input.actorId, input.actorLineId]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (actorIds.length === 0) {
    return false;
  }

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      sellerId: string | null;
      confirmedWinnerId: string | null;
      confirmedAt: Date | null;
    }>
  >(
    `
      SELECT "sellerId", "confirmedWinnerId", "confirmedAt"
      FROM "AuctionRoom"
      WHERE "id" = $1
      LIMIT 1
    `,
    input.id
  );

  const room = rows[0];
  if (!room?.confirmedWinnerId || !room.confirmedAt) {
    return false;
  }

  return actorIds.includes(String(room.sellerId || "").trim());
}

export async function createAuctionRoom(input: CreateAuctionInput) {
  await ensureAuctionSchema();

  const id = randomUUID();
  const cardNo = normalizeCardNo(input.cardNo);
  const imageUrl = sanitizeCardImageUrl(input.imageUrl) || resolveCardDisplayImage(cardNo, null);

  const room = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('auction_room_number'))`);

    const numberRows = await tx.$queryRawUnsafe<Array<{ roomNumber: number }>>(
      `
        WITH candidates AS (
          SELECT generate_series(
            1,
            GREATEST((SELECT COUNT(*)::int + 1 FROM "AuctionRoom"), 1)
          ) AS n
        )
        SELECT n AS "roomNumber"
        FROM candidates
        WHERE NOT EXISTS (
          SELECT 1
          FROM "AuctionRoom" r
          WHERE r."roomNumber" = n
        )
        ORDER BY n ASC
        LIMIT 1
      `
    );
    const roomNumber = Number(numberRows[0]?.roomNumber || 1);

    const rows = await tx.$queryRawUnsafe<AuctionRoomRow[]>(
      `
        INSERT INTO "AuctionRoom" (
          "id",
          "roomNumber",
          "cardNo",
          "cardName",
          "imageUrl",
          "rarity",
          "openingPrice",
          "minBidStep",
          "startsAt",
          "endsAt",
          "sellerId",
          "sellerName",
          "sellerImage",
          "status"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active')
        RETURNING *, 0 AS "topBid", 0 AS "bidCount"
      `,
      id,
      roomNumber,
      cardNo,
      input.cardName,
      imageUrl,
      String(input.rarity || "Legendary").trim() || "Legendary",
      input.openingPrice,
      input.minBidStep,
      input.startsAt,
      input.endsAt,
      input.sellerId,
      input.sellerName,
      input.sellerImage
    );

    return normalizeRoom(rows[0]);
  });

  invalidateAuctionRoomsCache();
  return room;
}

export async function isAuctionBlacklisted(userId: string) {
  await ensureAuctionSchema();

  const rows = await prisma.$queryRawUnsafe<Array<{ userId: string }>>(
    `SELECT "userId" FROM "AuctionBlacklist" WHERE "userId" = $1 LIMIT 1`,
    userId
  );

  return rows.length > 0;
}

export async function createAuctionBid(input: CreateAuctionBidInput) {
  await ensureAuctionSchema();

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      input.auctionId
    );

    const blacklistRows = await tx.$queryRawUnsafe<Array<{ userId: string }>>(
      `SELECT "userId" FROM "AuctionBlacklist" WHERE "userId" = $1 LIMIT 1`,
      input.bidderId
    );

    if (blacklistRows.length > 0) {
      throw new Error("AUCTION_BLACKLISTED");
    }

    const roomRows = await tx.$queryRawUnsafe<AuctionRoomRow[]>(
      `SELECT * FROM "AuctionRoom" WHERE "id" = $1 LIMIT 1`,
      input.auctionId
    );
    const room = roomRows[0] ? normalizeRoom(roomRows[0]) : null;

    if (!room) {
      throw new Error("AUCTION_NOT_FOUND");
    }

    if (room.sellerId === input.bidderId) {
      throw new Error("OWNER_CANNOT_BID");
    }

    const now = Date.now();
    const startsAtMs = new Date(room.startsAt).getTime();
    const endsAtMs = new Date(room.endsAt).getTime();

    if (now < startsAtMs) {
      throw new Error("AUCTION_NOT_STARTED");
    }

    if (now > endsAtMs || room.status !== "active") {
      throw new Error("AUCTION_ENDED");
    }

    const topRows = await tx.$queryRawUnsafe<Array<{ topBid: Prisma.Decimal | number | string | null }>>(
      `SELECT COALESCE(MAX("amount"), 0) AS "topBid" FROM "AuctionBid" WHERE "auctionId" = $1`,
      input.auctionId
    );

    const currentTop = toNumber(topRows[0]?.topBid);
    const minimumBid = (currentTop || room.openingPrice) + room.minBidStep;

    if (input.amount < minimumBid) {
      const error = new Error("BID_TOO_LOW");
      (error as Error & { minimumBid?: number }).minimumBid = minimumBid;
      throw error;
    }

    const bidRows = await tx.$queryRawUnsafe<AuctionBidRow[]>(
      `
        INSERT INTO "AuctionBid" (
          "id",
          "auctionId",
          "bidderId",
          "bidderName",
          "bidderImage",
          "amount",
          "message"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      randomUUID(),
      input.auctionId,
      input.bidderId,
      input.bidderName,
      input.bidderImage,
      input.amount,
      String(input.message || "").trim().slice(0, 180)
    );

    return {
      bid: normalizeBid(bidRows[0]),
      nextMinimumBid: input.amount + room.minBidStep,
    };
  });

  invalidateAuctionRoomsCache();
  return result;
}

export async function confirmAuctionWinner(input: ConfirmAuctionWinnerInput) {
  await ensureAuctionSchema();

  const actorIds = [input.actorId, input.actorLineId]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const updatedRoom = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      input.auctionId
    );

    const roomRows = await tx.$queryRawUnsafe<AuctionRoomRow[]>(
      `SELECT * FROM "AuctionRoom" WHERE "id" = $1 LIMIT 1`,
      input.auctionId
    );
    const room = roomRows[0] ? normalizeRoom(roomRows[0]) : null;

    if (!room) {
      throw new Error("AUCTION_NOT_FOUND");
    }

    if (!input.isAdmin && !actorIds.includes(room.sellerId)) {
      throw new Error("AUCTION_OWNER_ONLY");
    }

    const now = Date.now();
    if (now <= new Date(room.endsAt).getTime()) {
      throw new Error("AUCTION_NOT_ENDED");
    }

    const winnerId = String(input.winnerId || "").trim();
    if (!winnerId) {
      throw new Error("MISSING_WINNER");
    }

    if (room.confirmedWinnerId) {
      throw new Error("AUCTION_ALREADY_CONFIRMED");
    }

    const bidRows = await tx.$queryRawUnsafe<
      Array<{ bidderId: string; amount: Prisma.Decimal | number | string; createdAt: Date }>
    >(
      `
        SELECT DISTINCT ON ("bidderId")
          "bidderId",
          "amount",
          "createdAt"
        FROM "AuctionBid"
        WHERE "auctionId" = $1
        ORDER BY "bidderId", "createdAt" DESC, "amount" DESC
      `,
      input.auctionId
    );

    if (bidRows.length === 0 || !bidRows.some((bid) => bid.bidderId === winnerId)) {
      throw new Error("WINNER_NOT_FOUND");
    }

    const finalRanking = bidRows.sort((a, b) => {
      const amountDiff = toNumber(b.amount) - toNumber(a.amount);
      if (amountDiff !== 0) return amountDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    let elapsedMs = now - new Date(room.endsAt).getTime();
    let activeWinnerId = "";
    for (let index = 0; index < finalRanking.length; index += 1) {
      const hours = index === 0 ? 24 : index === 1 ? 12 : index === 2 ? 6 : 3;
      const windowMs = hours * 60 * 60 * 1000;
      if (elapsedMs < windowMs) {
        activeWinnerId = finalRanking[index]?.bidderId || "";
        break;
      }
      elapsedMs -= windowMs;
    }

    if (activeWinnerId !== winnerId) {
      throw new Error("AUCTION_WINNER_WINDOW_EXPIRED");
    }

    const updatedRows = await tx.$queryRawUnsafe<AuctionRoomRow[]>(
      `
        UPDATE "AuctionRoom"
        SET
          "confirmedWinnerId" = $2,
          "confirmedAt" = NOW(),
          "status" = 'settled'
        WHERE "id" = $1
        RETURNING *, 0 AS "topBid", 0 AS "bidCount"
      `,
      input.auctionId,
      winnerId
    );

    return normalizeRoom(updatedRows[0]);
  });

  if (updatedRoom?.confirmedWinnerId) {
    await cleanupAuctionDealMessagesForAuction(
      updatedRoom.id,
      [
        getAuctionDealChatRoomId(
          updatedRoom.id,
          updatedRoom.confirmedWinnerId
        ),
      ]
    ).catch((error) => {
      console.error("CONFIRM AUCTION DEAL CHAT CLEANUP ERROR:", error);
    });
  }

  invalidateAuctionRoomsCache();
  return updatedRoom;
}
