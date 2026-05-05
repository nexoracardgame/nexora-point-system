import "server-only";

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  BOX_PRODUCT_PUBLIC_DIR,
  type BoxMarketListing,
  type BoxProductType,
  type DealerVerificationStatus,
} from "@/lib/box-market-types";
import {
  ensureLocalStoreFile,
  readLocalStoreJson,
  writeLocalStoreJson,
} from "@/lib/local-store-dir";

type DbRow = Record<string, unknown>;

export type CreateBoxMarketListingInput = {
  sellerId: string;
  sellerName: string;
  sellerImage: string;
  title: string;
  productType: BoxProductType;
  description: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
};

export type UpdateBoxMarketListingPriceInput = {
  listingId: string;
  actorId: string;
  price: number;
};

export type DeleteBoxMarketListingInput = {
  listingId: string;
  actorId: string;
  isAdmin: boolean;
};

export type DealerVerificationInput = {
  userId: string;
  fullName: string;
  memberId: string;
  phone: string;
  nationalId: string;
  lineContactId: string | null;
  email: string | null;
};

export type DealerVerificationProfile = DealerVerificationStatus & {
  fullName: string;
  memberId: string;
};

type LocalDealerVerification = {
  id: string;
  userId: string;
  fullName: string;
  memberId: string;
  phone: string;
  nationalIdHash: string;
  nationalIdLast4: string;
  lineContactId: string | null;
  email: string | null;
  status: "verified";
  verifiedAt: string;
  createdAt: string;
  updatedAt: string;
};

let schemaReadyPromise: Promise<void> | null = null;

function hasDatabaseConfig() {
  return Boolean(String(process.env.DATABASE_URL || "").trim());
}

function normalizeProductType(value: unknown): BoxProductType {
  return String(value || "").trim().toLowerCase() === "pack" ? "pack" : "box";
}

function normalizeDate(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function rowValue(row: DbRow, camelKey: string, lowerKey: string) {
  return row[camelKey] ?? row[lowerKey];
}

function sanitizeBoxProductImageUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return raw.startsWith(`/${BOX_PRODUCT_PUBLIC_DIR}/`) ? raw : null;
}

function toListingRecord(row: DbRow): BoxMarketListing {
  const imageUrl = sanitizeBoxProductImageUrl(
    String(rowValue(row, "imageUrl", "imageurl") || "")
  );

  return {
    id: String(row.id || ""),
    sellerId: String(rowValue(row, "sellerId", "sellerid") || ""),
    sellerName:
      String(rowValue(row, "sellerName", "sellername") || "").trim() ||
      "NEXORA Seller",
    sellerImage:
      String(rowValue(row, "sellerImage", "sellerimage") || "").trim() ||
      "/avatar.png",
    title: String(row.title || "").trim() || "กล่องสุ่มการ์ด",
    productType: normalizeProductType(
      rowValue(row, "productType", "producttype")
    ),
    description: String(row.description || "").trim(),
    price: Number(row.price || 0),
    quantity: Math.max(1, Number(row.quantity || 1)),
    imageName: String(rowValue(row, "imageName", "imagename") || "").trim() || null,
    imageUrl,
    status: String(row.status || "active"),
    isDealerVerified: Boolean(
      rowValue(row, "isDealerVerified", "isdealerverified")
    ),
    createdAt: normalizeDate(rowValue(row, "createdAt", "createdat")),
    updatedAt: normalizeDate(rowValue(row, "updatedAt", "updatedat")),
  };
}

function getImageName(imageUrl: string | null) {
  if (!imageUrl) return null;
  try {
    return decodeURIComponent(imageUrl.split("/").pop() || "").trim() || null;
  } catch {
    return imageUrl.split("/").pop() || null;
  }
}

function hashNationalId(value: string) {
  const normalized = String(value || "").replace(/[^\d]/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}

function getNationalIdLast4(value: string) {
  const normalized = String(value || "").replace(/[^\d]/g, "");
  return normalized.slice(-4);
}

async function ensureBoxMarketSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS "BoxMarketListing" ("id" TEXT PRIMARY KEY, "sellerId" TEXT NOT NULL, "sellerName" TEXT NOT NULL, "sellerImage" TEXT NOT NULL DEFAULT \'/avatar.png\', "title" TEXT NOT NULL, "productType" TEXT NOT NULL DEFAULT \'box\', "description" TEXT NOT NULL DEFAULT \'\', "price" DOUBLE PRECISION NOT NULL, "quantity" INTEGER NOT NULL DEFAULT 1, "imageName" TEXT, "imageUrl" TEXT, "status" TEXT NOT NULL DEFAULT \'active\', "isDealerVerified" BOOLEAN NOT NULL DEFAULT FALSE, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())'
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "BoxMarketListing_status_createdAt_idx" ON "BoxMarketListing" ("status", "createdAt" DESC)'
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "BoxMarketListing_seller_idx" ON "BoxMarketListing" ("sellerId", "createdAt" DESC)'
      );
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS "DealerVerification" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL UNIQUE, "fullName" TEXT NOT NULL, "memberId" TEXT NOT NULL, "phone" TEXT NOT NULL, "nationalIdHash" TEXT NOT NULL, "nationalIdLast4" TEXT NOT NULL, "lineContactId" TEXT, "email" TEXT, "status" TEXT NOT NULL DEFAULT \'verified\', "verifiedAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())'
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "DealerVerification_status_idx" ON "DealerVerification" ("status", "verifiedAt" DESC)'
      );
    })();
  }

  return schemaReadyPromise;
}

async function readLocalListings() {
  await ensureLocalStoreFile("local-box-market-listings.json");
  return readLocalStoreJson<BoxMarketListing>("local-box-market-listings.json");
}

async function writeLocalListings(items: BoxMarketListing[]) {
  await writeLocalStoreJson(
    "local-box-market-listings.json",
    JSON.stringify(items, null, 2)
  );
}

async function readLocalVerifications() {
  await ensureLocalStoreFile("local-dealer-verifications.json");
  return readLocalStoreJson<LocalDealerVerification>(
    "local-dealer-verifications.json"
  );
}

async function writeLocalVerifications(items: LocalDealerVerification[]) {
  await writeLocalStoreJson(
    "local-dealer-verifications.json",
    JSON.stringify(items, null, 2)
  );
}

export async function getBoxMarketListings(limit = 120) {
  if (!hasDatabaseConfig()) {
    return (await readLocalListings())
      .filter((item) => String(item.status || "active").toLowerCase() === "active")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  try {
    await ensureBoxMarketSchema();
    const rows = await prisma.$queryRawUnsafe<DbRow[]>(
      'SELECT * FROM "BoxMarketListing" WHERE LOWER("status") = \'active\' ORDER BY "createdAt" DESC, "id" ASC LIMIT $1',
      limit
    );
    return rows.map(toListingRecord);
  } catch {
    return process.env.NODE_ENV === "production"
      ? []
      : (await readLocalListings())
          .filter((item) => String(item.status || "active").toLowerCase() === "active")
          .slice(0, limit);
  }
}

export async function getDealerVerificationStatus(
  userId: string
): Promise<DealerVerificationStatus> {
  const safeUserId = String(userId || "").trim();
  if (!safeUserId) {
    return { verified: false, status: "none", verifiedAt: null };
  }

  if (!hasDatabaseConfig()) {
    const local = (await readLocalVerifications()).find(
      (item) => item.userId === safeUserId && item.status === "verified"
    );
    return {
      verified: Boolean(local),
      status: local ? "verified" : "none",
      verifiedAt: local?.verifiedAt || null,
    };
  }

  try {
    await ensureBoxMarketSchema();
    const rows = await prisma.$queryRawUnsafe<DbRow[]>(
      'SELECT "status", "verifiedAt" FROM "DealerVerification" WHERE "userId" = $1 LIMIT 1',
      safeUserId
    );
    const row = rows[0];
    const status = String(row?.status || "").toLowerCase();
    const verifiedAt = row ? rowValue(row, "verifiedAt", "verifiedat") : null;
    return {
      verified: status === "verified",
      status: status === "verified" ? "verified" : "none",
      verifiedAt: verifiedAt ? normalizeDate(verifiedAt) : null,
    };
  } catch {
    if (process.env.NODE_ENV === "production") {
      return { verified: false, status: "none", verifiedAt: null };
    }

    const local = (await readLocalVerifications()).find(
      (item) => item.userId === safeUserId && item.status === "verified"
    );
    return {
      verified: Boolean(local),
      status: local ? "verified" : "none",
      verifiedAt: local?.verifiedAt || null,
    };
  }
}

export async function getDealerVerificationProfile(
  userId: string
): Promise<DealerVerificationProfile> {
  const safeUserId = String(userId || "").trim();
  if (!safeUserId) {
    return {
      verified: false,
      status: "none",
      verifiedAt: null,
      fullName: "",
      memberId: "",
    };
  }

  if (!hasDatabaseConfig()) {
    const local = (await readLocalVerifications()).find(
      (item) => item.userId === safeUserId && item.status === "verified"
    );
    return {
      verified: Boolean(local),
      status: local ? "verified" : "none",
      verifiedAt: local?.verifiedAt || null,
      fullName: local?.fullName || "",
      memberId: local?.memberId || "",
    };
  }

  try {
    await ensureBoxMarketSchema();
    const rows = await prisma.$queryRawUnsafe<DbRow[]>(
      'SELECT "status", "verifiedAt", "fullName", "memberId" FROM "DealerVerification" WHERE "userId" = $1 LIMIT 1',
      safeUserId
    );
    const row = rows[0];
    const status = String(row?.status || "").toLowerCase();
    const verifiedAt = row ? rowValue(row, "verifiedAt", "verifiedat") : null;
    return {
      verified: status === "verified",
      status: status === "verified" ? "verified" : "none",
      verifiedAt: verifiedAt ? normalizeDate(verifiedAt) : null,
      fullName: String(rowValue(row || {}, "fullName", "fullname") || "").trim(),
      memberId: String(rowValue(row || {}, "memberId", "memberid") || "").trim(),
    };
  } catch {
    if (process.env.NODE_ENV === "production") {
      return {
        verified: false,
        status: "none",
        verifiedAt: null,
        fullName: "",
        memberId: "",
      };
    }

    const local = (await readLocalVerifications()).find(
      (item) => item.userId === safeUserId && item.status === "verified"
    );
    return {
      verified: Boolean(local),
      status: local ? "verified" : "none",
      verifiedAt: local?.verifiedAt || null,
      fullName: local?.fullName || "",
      memberId: local?.memberId || "",
    };
  }
}

export async function upsertDealerVerification(input: DealerVerificationInput) {
  const userId = String(input.userId || "").trim();
  const now = new Date().toISOString();
  const nationalIdHash = hashNationalId(input.nationalId);
  const nationalIdLast4 = getNationalIdLast4(input.nationalId);

  if (!userId) {
    throw new Error("missing-user");
  }

  if (!hasDatabaseConfig()) {
    const items = await readLocalVerifications();
    const existing = items.find((item) => item.userId === userId);
    const nextRecord: LocalDealerVerification = {
      id: existing?.id || `dealer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      fullName: input.fullName.trim(),
      memberId: input.memberId.trim(),
      phone: input.phone.trim(),
      nationalIdHash,
      nationalIdLast4,
      lineContactId: input.lineContactId,
      email: input.email,
      status: "verified",
      verifiedAt: now,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await writeLocalVerifications([
      nextRecord,
      ...items.filter((item) => item.userId !== userId),
    ]);
    return { verified: true, status: "verified" as const, verifiedAt: now };
  }

  await ensureBoxMarketSchema();
  await prisma.$queryRawUnsafe<DbRow[]>(
    'INSERT INTO "DealerVerification" ("id", "userId", "fullName", "memberId", "phone", "nationalIdHash", "nationalIdLast4", "lineContactId", "email", "status", "verifiedAt", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, \'verified\', NOW(), NOW(), NOW()) ON CONFLICT ("userId") DO UPDATE SET "fullName" = EXCLUDED."fullName", "memberId" = EXCLUDED."memberId", "phone" = EXCLUDED."phone", "nationalIdHash" = EXCLUDED."nationalIdHash", "nationalIdLast4" = EXCLUDED."nationalIdLast4", "lineContactId" = EXCLUDED."lineContactId", "email" = EXCLUDED."email", "status" = \'verified\', "verifiedAt" = NOW(), "updatedAt" = NOW() RETURNING *',
    `dealer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    input.fullName.trim(),
    input.memberId.trim(),
    input.phone.trim(),
    nationalIdHash,
    nationalIdLast4,
    input.lineContactId,
    input.email
  );

  return getDealerVerificationStatus(userId);
}

export async function createBoxMarketListing(
  input: CreateBoxMarketListingInput
) {
  const sellerId = String(input.sellerId || "").trim();
  const price = Number(input.price || 0);
  const quantity = Math.max(1, Math.floor(Number(input.quantity || 1)));
  const imageUrl = sanitizeBoxProductImageUrl(input.imageUrl);
  const imageName = getImageName(imageUrl);
  const dealerStatus = await getDealerVerificationStatus(sellerId);
  const now = new Date().toISOString();
  const listing: BoxMarketListing = {
    id: `box-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sellerId,
    sellerName: input.sellerName.trim() || "NEXORA Seller",
    sellerImage: input.sellerImage.trim() || "/avatar.png",
    title: input.title.trim(),
    productType: normalizeProductType(input.productType),
    description: input.description.trim(),
    price,
    quantity,
    imageName,
    imageUrl,
    status: "active",
    isDealerVerified: dealerStatus.verified,
    createdAt: now,
    updatedAt: now,
  };

  if (!hasDatabaseConfig()) {
    await writeLocalListings([listing, ...(await readLocalListings())]);
    return listing;
  }

  try {
    await ensureBoxMarketSchema();
    const rows = await prisma.$queryRawUnsafe<DbRow[]>(
      'INSERT INTO "BoxMarketListing" ("id", "sellerId", "sellerName", "sellerImage", "title", "productType", "description", "price", "quantity", "imageName", "imageUrl", "status", "isDealerVerified", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, \'active\', $12, NOW(), NOW()) RETURNING *',
      listing.id,
      listing.sellerId,
      listing.sellerName,
      listing.sellerImage,
      listing.title,
      listing.productType,
      listing.description,
      listing.price,
      listing.quantity,
      listing.imageName,
      listing.imageUrl,
      listing.isDealerVerified
    );
    return toListingRecord(rows[0]);
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error("create-box-listing-failed");
    }

    await writeLocalListings([listing, ...(await readLocalListings())]);
    return listing;
  }
}

export async function updateBoxMarketListingPrice(
  input: UpdateBoxMarketListingPriceInput
) {
  const listingId = String(input.listingId || "").trim();
  const actorId = String(input.actorId || "").trim();
  const price = Number(input.price || 0);
  const now = new Date().toISOString();

  if (!listingId || !actorId) {
    throw new Error("missing-actor-or-listing");
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("invalid-price");
  }

  if (!hasDatabaseConfig()) {
    const items = await readLocalListings();
    const existing = items.find((item) => item.id === listingId);
    if (!existing) {
      throw new Error("listing-not-found");
    }
    if (existing.sellerId !== actorId) {
      throw new Error("forbidden");
    }

    const updated: BoxMarketListing = {
      ...existing,
      price,
      updatedAt: now,
    };
    await writeLocalListings(
      items.map((item) => (item.id === listingId ? updated : item))
    );
    return updated;
  }

  try {
    await ensureBoxMarketSchema();
    const rows = await prisma.$queryRawUnsafe<DbRow[]>(
      'UPDATE "BoxMarketListing" SET "price" = $1, "updatedAt" = NOW() WHERE "id" = $2 AND "sellerId" = $3 AND LOWER("status") = \'active\' RETURNING *',
      price,
      listingId,
      actorId
    );
    const updated = rows[0];
    if (!updated) {
      throw new Error("listing-not-found-or-forbidden");
    }
    return toListingRecord(updated);
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }

    const items = await readLocalListings();
    const existing = items.find((item) => item.id === listingId);
    if (!existing || existing.sellerId !== actorId) {
      throw new Error("listing-not-found-or-forbidden");
    }
    const updated: BoxMarketListing = {
      ...existing,
      price,
      updatedAt: now,
    };
    await writeLocalListings(
      items.map((item) => (item.id === listingId ? updated : item))
    );
    return updated;
  }
}

export async function deleteBoxMarketListing(
  input: DeleteBoxMarketListingInput
) {
  const listingId = String(input.listingId || "").trim();
  const actorId = String(input.actorId || "").trim();
  const isAdmin = Boolean(input.isAdmin);
  const now = new Date().toISOString();

  if (!listingId || !actorId) {
    throw new Error("missing-actor-or-listing");
  }

  if (!hasDatabaseConfig()) {
    const items = await readLocalListings();
    const existing = items.find((item) => item.id === listingId);
    if (!existing) {
      throw new Error("listing-not-found");
    }
    if (existing.sellerId !== actorId && !isAdmin) {
      throw new Error("forbidden");
    }

    await writeLocalListings(
      items.map((item) =>
        item.id === listingId
          ? { ...item, status: "deleted", updatedAt: now }
          : item
      )
    );
    return { success: true };
  }

  try {
    await ensureBoxMarketSchema();
    const rows = await prisma.$queryRawUnsafe<DbRow[]>(
      isAdmin
        ? 'UPDATE "BoxMarketListing" SET "status" = \'deleted\', "updatedAt" = NOW() WHERE "id" = $1 AND LOWER("status") = \'active\' RETURNING "id"'
        : 'UPDATE "BoxMarketListing" SET "status" = \'deleted\', "updatedAt" = NOW() WHERE "id" = $1 AND "sellerId" = $2 AND LOWER("status") = \'active\' RETURNING "id"',
      ...(isAdmin ? [listingId] : [listingId, actorId])
    );
    if (!rows[0]) {
      throw new Error("listing-not-found-or-forbidden");
    }
    return { success: true };
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }

    const items = await readLocalListings();
    const existing = items.find((item) => item.id === listingId);
    if (!existing || (existing.sellerId !== actorId && !isAdmin)) {
      throw new Error("listing-not-found-or-forbidden");
    }
    await writeLocalListings(
      items.map((item) =>
        item.id === listingId
          ? { ...item, status: "deleted", updatedAt: now }
          : item
      )
    );
    return { success: true };
  }
}
