import "server-only";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  ensureLocalStoreFile,
  readLocalStoreJson,
  writeLocalStoreJson,
} from "@/lib/local-store-dir";
import { syncPawnLedgerEntries } from "@/lib/pawn-ledger-sync";

type DbRow = Record<string, unknown>;

export type CardBankEntryMode = "bank" | "pawn";
export type CardBankIntakeMode = "specific" | "sets" | "bulk";
export type CardBankStatus = "stored" | "pawned" | "converted" | "withdrawn" | "forfeited";
export type CardBankAssetTier = "bronze" | "silver" | "gold" | "set" | "pure" | "unknown";

export type CardBankAsset = {
  id: string;
  ownerId: string;
  ownerLineId: string | null;
  ownerName: string;
  entryMode: CardBankEntryMode;
  intakeMode: CardBankIntakeMode;
  cardNo: string | null;
  cardName: string;
  cardType: string | null;
  assetTier: CardBankAssetTier;
  quantity: number;
  imageUrl: string | null;
  setId: string | null;
  setName: string | null;
  setOrder: number | null;
  setCardTotal: number | null;
  withFoilBonus: boolean;
  valueTHB: number;
  nexValue: number;
  coinValue: number;
  status: CardBankStatus;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  sourcePayload?: Record<string, unknown> | null;
};

export type CreateCardBankEntriesInput = {
  owner: {
    id: string;
    lineId?: string | null;
    name: string;
  };
  entryMode: CardBankEntryMode;
  intakeMode: CardBankIntakeMode;
  items?: Array<{
    cardNo: string;
    cardName: string;
    cardType: "normal" | "foil";
    rarity?: string | null;
    assetTier?: string | null;
    quantity: number;
    imageUrl?: string | null;
  }>;
  setItems?: Array<{
    setId: string;
    order: number;
    setName: string;
    quantity: number;
    nexValue: number;
    reward?: string;
    withFoilBonus: boolean;
    cardTotal: number;
  }>;
  bulk?: {
    nexValue: number;
    coinValue: number;
    category?: string | null;
  };
  pawn?: {
    principalTHB: number;
    interestRate: number;
    dueDays: number;
    note?: string | null;
  };
  actor: {
    id: string;
    name: string;
  };
};

export type WithdrawCardBankAssetInput = {
  assetId: string;
  quantity: number;
  nexValue?: number;
  coinValue?: number;
  actor: {
    id: string;
    name: string;
  };
  note?: string | null;
};

export type CardBankAdminSummary = {
  pendingCount: number;
  storedQuantity: number;
  pawnedQuantity: number;
  forfeitedQuantity: number;
  latestAssets: CardBankAsset[];
};

export function getCardBankAssetsVersion(assets: CardBankAsset[]) {
  return assets
    .map((asset) =>
      [
        asset.id,
        asset.status,
        asset.quantity,
        asset.nexValue,
        asset.coinValue,
        asset.updatedAt,
      ].join(":")
    )
    .sort()
    .join("|");
}

let schemaReadyPromise: Promise<void> | null = null;

function hasDatabaseConfig() {
  return Boolean(String(process.env.DATABASE_URL || "").trim());
}

function normalizeDate(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function rowValue(row: DbRow, camelKey: string, lowerKey: string) {
  return row[camelKey] ?? row[lowerKey];
}

function normalizeEntryMode(value: unknown): CardBankEntryMode {
  return String(value || "").toLowerCase() === "pawn" ? "pawn" : "bank";
}

function normalizeIntakeMode(value: unknown): CardBankIntakeMode {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "sets" || normalized === "bulk") return normalized;
  return "specific";
}

function normalizeStatus(value: unknown): CardBankStatus {
  const normalized = String(value || "").toLowerCase();
  if (
    normalized === "pawned" ||
    normalized === "converted" ||
    normalized === "withdrawn" ||
    normalized === "forfeited"
  ) {
    return normalized;
  }
  return "stored";
}

function normalizeAssetTier(value: unknown): CardBankAssetTier {
  const normalized = String(value || "").trim().toLowerCase();
  if (/bronze|บรอนซ์/.test(normalized)) return "bronze";
  if (/silver|ซิลเวอร์/.test(normalized)) return "silver";
  if (/gold|โกลด์/.test(normalized)) return "gold";
  if (/set|เซ็ต/.test(normalized)) return "set";
  if (/pure|nex|coin|เพียว/.test(normalized)) return "pure";
  return "unknown";
}

function toNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function toNonNegativeNumber(value: unknown) {
  return Math.max(0, toNumber(value));
}

function toNonNegativeInt(value: unknown) {
  return Math.max(0, Math.floor(toNumber(value)));
}

function toNullableString(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

function toAssetRecord(row: DbRow): CardBankAsset {
  const rawSourcePayload = rowValue(row, "sourcePayload", "sourcepayload");
  let sourcePayload: Record<string, unknown> | null = null;
  if (rawSourcePayload && typeof rawSourcePayload === "object" && !Array.isArray(rawSourcePayload)) {
    sourcePayload = rawSourcePayload as Record<string, unknown>;
  } else if (typeof rawSourcePayload === "string") {
    try {
      const parsed = JSON.parse(rawSourcePayload);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        sourcePayload = parsed as Record<string, unknown>;
      }
    } catch {}
  }

  return {
    id: String(row.id || ""),
    ownerId: String(rowValue(row, "ownerId", "ownerid") || ""),
    ownerLineId: toNullableString(rowValue(row, "ownerLineId", "ownerlineid")),
    ownerName: String(rowValue(row, "ownerName", "ownername") || "").trim() || "NEXORA Customer",
    entryMode: normalizeEntryMode(rowValue(row, "entryMode", "entrymode")),
    intakeMode: normalizeIntakeMode(rowValue(row, "intakeMode", "intakemode")),
    cardNo: toNullableString(rowValue(row, "cardNo", "cardno")),
    cardName: String(rowValue(row, "cardName", "cardname") || "").trim() || "Card Bank Asset",
    cardType: toNullableString(rowValue(row, "cardType", "cardtype")),
    assetTier: normalizeAssetTier(rowValue(row, "assetTier", "assettier")),
    quantity: Math.max(1, Math.floor(toNumber(row.quantity) || 1)),
    imageUrl: toNullableString(rowValue(row, "imageUrl", "imageurl")),
    setId: toNullableString(rowValue(row, "setId", "setid")),
    setName: toNullableString(rowValue(row, "setName", "setname")),
    setOrder: rowValue(row, "setOrder", "setorder") == null ? null : Math.floor(toNumber(rowValue(row, "setOrder", "setorder"))),
    setCardTotal: rowValue(row, "setCardTotal", "setcardtotal") == null ? null : Math.floor(toNumber(rowValue(row, "setCardTotal", "setcardtotal"))),
    withFoilBonus: Boolean(rowValue(row, "withFoilBonus", "withfoilbonus")),
    valueTHB: toNumber(rowValue(row, "valueTHB", "valuethb")),
    nexValue: toNumber(rowValue(row, "nexValue", "nexvalue")),
    coinValue: Math.floor(toNumber(rowValue(row, "coinValue", "coinvalue"))),
    status: normalizeStatus(row.status),
    createdById: toNullableString(rowValue(row, "createdById", "createdbyid")),
    createdByName: toNullableString(rowValue(row, "createdByName", "createdbyname")),
    createdAt: normalizeDate(rowValue(row, "createdAt", "createdat")),
    updatedAt: normalizeDate(rowValue(row, "updatedAt", "updatedat")),
    sourcePayload,
  };
}

async function ensureCardBankSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS "CardBankAsset" ("id" TEXT PRIMARY KEY, "ownerId" TEXT NOT NULL, "ownerLineId" TEXT, "ownerName" TEXT NOT NULL, "entryMode" TEXT NOT NULL DEFAULT \'bank\', "intakeMode" TEXT NOT NULL DEFAULT \'specific\', "cardNo" TEXT, "cardName" TEXT NOT NULL, "cardType" TEXT, "assetTier" TEXT NOT NULL DEFAULT \'unknown\', "quantity" INTEGER NOT NULL DEFAULT 1, "imageUrl" TEXT, "setId" TEXT, "setName" TEXT, "setOrder" INTEGER, "setCardTotal" INTEGER, "withFoilBonus" BOOLEAN NOT NULL DEFAULT FALSE, "valueTHB" DOUBLE PRECISION NOT NULL DEFAULT 0, "nexValue" DOUBLE PRECISION NOT NULL DEFAULT 0, "coinValue" INTEGER NOT NULL DEFAULT 0, "status" TEXT NOT NULL DEFAULT \'stored\', "sourcePayload" JSONB, "createdById" TEXT, "createdByName" TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "CardBankAsset" ADD COLUMN IF NOT EXISTS "assetTier" TEXT NOT NULL DEFAULT \'unknown\''
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "CardBankAsset_owner_status_idx" ON "CardBankAsset" ("ownerId", "status", "createdAt" DESC)'
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "CardBankAsset_createdAt_idx" ON "CardBankAsset" ("createdAt" DESC)'
      );
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS "CardBankMovement" ("id" TEXT PRIMARY KEY, "assetId" TEXT, "ownerId" TEXT NOT NULL, "action" TEXT NOT NULL, "beforeState" JSONB, "afterState" JSONB, "staffId" TEXT, "staffName" TEXT, "note" TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())'
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "CardBankMovement_owner_createdAt_idx" ON "CardBankMovement" ("ownerId", "createdAt" DESC)'
      );
    })();
  }

  return schemaReadyPromise;
}

async function readLocalAssets() {
  await ensureLocalStoreFile("local-card-bank-assets.json");
  return readLocalStoreJson<CardBankAsset>("local-card-bank-assets.json");
}

async function writeLocalAssets(items: CardBankAsset[]) {
  await writeLocalStoreJson(
    "local-card-bank-assets.json",
    JSON.stringify(items, null, 2)
  );
}

function stripSourcePayload(asset: CardBankAsset) {
  const { sourcePayload, ...rest } = asset;
  void sourcePayload;
  return rest;
}

function buildAssets(input: CreateCardBankEntriesInput) {
  const now = new Date().toISOString();
  const status: CardBankStatus = input.entryMode === "pawn" ? "pawned" : "stored";
  const pawnSource = input.entryMode === "pawn" ? input.pawn || null : null;
  const base = {
    ownerId: input.owner.id,
    ownerLineId: input.owner.lineId || null,
    ownerName: input.owner.name,
    entryMode: input.entryMode,
    intakeMode: input.intakeMode,
    status,
    createdById: input.actor.id,
    createdByName: input.actor.name,
    createdAt: now,
    updatedAt: now,
  };

  if (input.intakeMode === "sets") {
      return (input.setItems || []).map((item) => ({
        ...base,
        id: randomUUID(),
      cardNo: null,
      cardName: item.setName,
      cardType: item.withFoilBonus ? "foil-set" : "set",
      assetTier: "set" as CardBankAssetTier,
      quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
      imageUrl: null,
      setId: item.setId,
      setName: item.setName,
      setOrder: Math.floor(Number(item.order || 0)),
      setCardTotal: Math.floor(Number(item.cardTotal || 0)),
        withFoilBonus: Boolean(item.withFoilBonus),
      valueTHB: pawnSource?.principalTHB ? Number(pawnSource.principalTHB || 0) : 0,
        nexValue: Number(item.nexValue || 0),
        coinValue: 0,
      sourcePayload: {
        ...item,
        pawn: pawnSource,
      },
      }));
  }

  if (input.intakeMode === "bulk") {
    return [
      {
        ...base,
        id: randomUUID(),
        cardNo: null,
        cardName: "Bulk Card Pool",
        cardType: "bulk",
        assetTier: normalizeAssetTier(input.bulk?.category || "pure"),
        quantity: 1,
        imageUrl: null,
        setId: null,
        setName: null,
        setOrder: null,
        setCardTotal: null,
        withFoilBonus: false,
        valueTHB: pawnSource?.principalTHB ? Number(pawnSource.principalTHB || 0) : 0,
        nexValue: Number(input.bulk?.nexValue || 0),
        coinValue: Math.floor(Number(input.bulk?.coinValue || 0)),
        sourcePayload: {
          ...(input.bulk || {}),
          pawn: pawnSource,
        },
      },
    ];
  }

  return (input.items || []).map((item) => ({
    ...base,
    id: randomUUID(),
    cardNo: item.cardNo,
    cardName: item.cardName,
    cardType: item.cardType,
    assetTier: normalizeAssetTier(item.assetTier || item.rarity),
    quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
    imageUrl: item.imageUrl || null,
    setId: null,
    setName: null,
    setOrder: null,
    setCardTotal: null,
    withFoilBonus: item.cardType === "foil",
    valueTHB: pawnSource?.principalTHB ? Number(pawnSource.principalTHB || 0) : 0,
    nexValue: 0,
    coinValue: 0,
    sourcePayload: {
      ...item,
      pawn: pawnSource,
    },
  }));
}

export async function createCardBankEntries(input: CreateCardBankEntriesInput) {
  const assets = buildAssets(input);
  if (assets.length === 0) return [];

  if (!hasDatabaseConfig()) {
    const current = await readLocalAssets();
    await writeLocalAssets([...assets.map(stripSourcePayload), ...current]);
    if (assets.some((asset) => asset.entryMode === "pawn")) {
      try {
        const syncResult = await syncPawnLedgerEntries(assets);
        if (!syncResult.ok) {
          console.warn("Pawn ledger sync failed (local store):", syncResult.error || "unknown");
        }
      } catch (error) {
        console.warn("Pawn ledger sync error (local store):", error);
      }
    }
    return assets.map(stripSourcePayload);
  }

  await ensureCardBankSchema();

  await prisma.$transaction(
    assets.map((asset) =>
      prisma.$executeRawUnsafe(
        'INSERT INTO "CardBankAsset" ("id", "ownerId", "ownerLineId", "ownerName", "entryMode", "intakeMode", "cardNo", "cardName", "cardType", "assetTier", "quantity", "imageUrl", "setId", "setName", "setOrder", "setCardTotal", "withFoilBonus", "valueTHB", "nexValue", "coinValue", "status", "sourcePayload", "createdById", "createdByName") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23,$24)',
        asset.id,
        asset.ownerId,
        asset.ownerLineId,
        asset.ownerName,
        asset.entryMode,
        asset.intakeMode,
        asset.cardNo,
        asset.cardName,
        asset.cardType,
        asset.assetTier,
        asset.quantity,
        asset.imageUrl,
        asset.setId,
        asset.setName,
        asset.setOrder,
        asset.setCardTotal,
        asset.withFoilBonus,
        asset.valueTHB,
        asset.nexValue,
        asset.coinValue,
        asset.status,
        JSON.stringify(asset.sourcePayload || {}),
        asset.createdById,
        asset.createdByName
      )
    )
  );

  await prisma.$transaction(
    assets.map((asset) =>
      prisma.$executeRawUnsafe(
        'INSERT INTO "CardBankMovement" ("id", "assetId", "ownerId", "action", "beforeState", "afterState", "staffId", "staffName", "note") VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9)',
        randomUUID(),
        asset.id,
        asset.ownerId,
        asset.entryMode === "pawn" ? "pawn_start" : "deposit",
        "null",
        JSON.stringify(asset),
        asset.createdById,
        asset.createdByName,
        `Created from admin ${asset.intakeMode} intake`
      )
    )
  );

  if (assets.some((asset) => asset.entryMode === "pawn")) {
    try {
      const syncResult = await syncPawnLedgerEntries(assets);
      if (!syncResult.ok) {
        console.warn("Pawn ledger sync failed:", syncResult.error || "unknown");
      }
    } catch (error) {
      console.warn("Pawn ledger sync error:", error);
    }
  }

  return assets.map(stripSourcePayload);
}

export async function withdrawCardBankAsset(input: WithdrawCardBankAssetInput) {
  const assetId = String(input.assetId || "").trim();
  const requestedQuantity = Math.max(1, Math.floor(Number(input.quantity || 1)));
  const requestedNexValue = toNonNegativeNumber(input.nexValue);
  const requestedCoinValue = toNonNegativeInt(input.coinValue);
  if (!assetId) {
    throw new Error("Missing asset id");
  }

  if (!hasDatabaseConfig()) {
    const current = await readLocalAssets();
    const asset = current.find((item) => item.id === assetId);
    if (!asset) throw new Error("Asset not found");
    if (asset.status === "withdrawn" || asset.status === "converted" || asset.status === "forfeited") {
      throw new Error("Asset is already closed");
    }

    const isBulk = asset.intakeMode === "bulk";
    const withdrawNexValue = isBulk ? requestedNexValue : 0;
    const withdrawCoinValue = isBulk ? requestedCoinValue : 0;

    if (isBulk && withdrawNexValue <= 0 && withdrawCoinValue <= 0) {
      throw new Error("Bulk withdrawal requires NEX or COIN amount");
    }
    if (isBulk && withdrawNexValue > asset.nexValue) {
      throw new Error("Withdraw NEX is greater than the remaining pool");
    }
    if (isBulk && withdrawCoinValue > asset.coinValue) {
      throw new Error("Withdraw COIN is greater than the remaining pool");
    }

    const withdrawQuantity = isBulk ? asset.quantity : Math.min(requestedQuantity, asset.quantity);
    const remainingQuantity = isBulk ? asset.quantity : asset.quantity - withdrawQuantity;
    const remainingNexValue = isBulk ? asset.nexValue - withdrawNexValue : asset.nexValue;
    const remainingCoinValue = isBulk ? asset.coinValue - withdrawCoinValue : asset.coinValue;
    const isClosed = isBulk
      ? remainingNexValue <= 0 && remainingCoinValue <= 0
      : remainingQuantity <= 0;
    const updatedAsset: CardBankAsset = {
      ...asset,
      quantity: Math.max(0, remainingQuantity),
      nexValue: Math.max(0, remainingNexValue),
      coinValue: Math.max(0, remainingCoinValue),
      status: isClosed ? "withdrawn" : asset.status,
      updatedAt: new Date().toISOString(),
    };

    await writeLocalAssets(
      current.map((item) => (item.id === assetId ? updatedAsset : item))
    );
    if (asset.entryMode === "pawn") {
      try {
        const syncResult = await syncPawnLedgerEntries([updatedAsset]);
        if (!syncResult.ok) {
          console.warn("Pawn ledger sync failed (local withdraw):", syncResult.error || "unknown");
        }
      } catch (error) {
        console.warn("Pawn ledger sync error (local withdraw):", error);
      }
    }
    return {
      asset: updatedAsset,
      withdrawnQuantity: withdrawQuantity,
      withdrawnNexValue: withdrawNexValue,
      withdrawnCoinValue: withdrawCoinValue,
      remainingQuantity: updatedAsset.quantity,
      remainingNexValue: updatedAsset.nexValue,
      remainingCoinValue: updatedAsset.coinValue,
    };
  }

  await ensureCardBankSchema();
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<DbRow[]>(
      'SELECT * FROM "CardBankAsset" WHERE "id" = $1 FOR UPDATE',
      assetId
    );
    const asset = rows[0] ? toAssetRecord(rows[0]) : null;
    if (!asset) throw new Error("Asset not found");
    if (asset.status === "withdrawn" || asset.status === "converted" || asset.status === "forfeited") {
      throw new Error("Asset is already closed");
    }

    const isBulk = asset.intakeMode === "bulk";
    const withdrawNexValue = isBulk ? requestedNexValue : 0;
    const withdrawCoinValue = isBulk ? requestedCoinValue : 0;

    if (isBulk && withdrawNexValue <= 0 && withdrawCoinValue <= 0) {
      throw new Error("Bulk withdrawal requires NEX or COIN amount");
    }
    if (isBulk && withdrawNexValue > asset.nexValue) {
      throw new Error("Withdraw NEX is greater than the remaining pool");
    }
    if (isBulk && withdrawCoinValue > asset.coinValue) {
      throw new Error("Withdraw COIN is greater than the remaining pool");
    }

    const withdrawQuantity = isBulk ? asset.quantity : Math.min(requestedQuantity, asset.quantity);
    const remainingQuantity = isBulk ? asset.quantity : asset.quantity - withdrawQuantity;
    const remainingNexValue = isBulk ? asset.nexValue - withdrawNexValue : asset.nexValue;
    const remainingCoinValue = isBulk ? asset.coinValue - withdrawCoinValue : asset.coinValue;
    const isClosed = isBulk
      ? remainingNexValue <= 0 && remainingCoinValue <= 0
      : remainingQuantity <= 0;
    const afterState = {
      ...asset,
      quantity: Math.max(0, remainingQuantity),
      nexValue: Math.max(0, remainingNexValue),
      coinValue: Math.max(0, remainingCoinValue),
      status: isClosed ? "withdrawn" as const : asset.status,
      updatedAt: new Date().toISOString(),
    };

    await tx.$executeRawUnsafe(
      'UPDATE "CardBankAsset" SET "quantity" = $1, "nexValue" = $2, "coinValue" = $3, "status" = $4, "updatedAt" = NOW() WHERE "id" = $5',
      afterState.quantity,
      afterState.nexValue,
      afterState.coinValue,
      afterState.status,
      assetId
    );
    await tx.$executeRawUnsafe(
      'INSERT INTO "CardBankMovement" ("id", "assetId", "ownerId", "action", "beforeState", "afterState", "staffId", "staffName", "note") VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9)',
      randomUUID(),
      asset.id,
      asset.ownerId,
      "withdraw",
      JSON.stringify(asset),
      JSON.stringify({
        ...afterState,
        withdrawnQuantity: withdrawQuantity,
        withdrawnNexValue: withdrawNexValue,
        withdrawnCoinValue: withdrawCoinValue,
      }),
      input.actor.id,
      input.actor.name,
      String(input.note || "Return card asset to customer").trim()
    );

    if (asset.entryMode === "pawn") {
      try {
        const syncResult = await syncPawnLedgerEntries([{ ...afterState, sourcePayload: asset.sourcePayload }]);
        if (!syncResult.ok) {
          console.warn("Pawn ledger sync failed (db withdraw):", syncResult.error || "unknown");
        }
      } catch (error) {
        console.warn("Pawn ledger sync error (db withdraw):", error);
      }
    }

    return {
      asset: afterState,
      withdrawnQuantity: withdrawQuantity,
      withdrawnNexValue: withdrawNexValue,
      withdrawnCoinValue: withdrawCoinValue,
      remainingQuantity: afterState.quantity,
      remainingNexValue: afterState.nexValue,
      remainingCoinValue: afterState.coinValue,
    };
  });
}

export async function getCardBankAssetsForUser(userId: string) {
  const safeUserId = String(userId || "").trim();
  if (!safeUserId) return [];

  if (!hasDatabaseConfig()) {
    return (await readLocalAssets())
      .filter((asset) => asset.ownerId === safeUserId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  try {
    await ensureCardBankSchema();
    const rows = await prisma.$queryRawUnsafe<DbRow[]>(
      'SELECT * FROM "CardBankAsset" WHERE "ownerId" = $1 ORDER BY "createdAt" DESC, "id" ASC',
      safeUserId
    );
    return rows.map(toAssetRecord);
  } catch {
    return [];
  }
}

export async function getCardBankAdminSummary(): Promise<CardBankAdminSummary> {
  if (!hasDatabaseConfig()) {
    const assets = await readLocalAssets();
    return summarizeAssets(assets);
  }

  try {
    await ensureCardBankSchema();
    const [latestRows, aggregateRows] = await Promise.all([
      prisma.$queryRawUnsafe<DbRow[]>(
        'SELECT * FROM "CardBankAsset" WHERE "status" IN (\'stored\', \'pawned\') ORDER BY "createdAt" DESC, "id" ASC LIMIT 80'
      ),
      prisma.$queryRawUnsafe<DbRow[]>(
        'SELECT "status", "intakeMode", COUNT(*) AS "assetCount", COALESCE(SUM("quantity"), 0) AS "quantityTotal" FROM "CardBankAsset" GROUP BY "status", "intakeMode"'
      ),
    ]);
    const latestAssets = latestRows.map(toAssetRecord);
    return {
      pendingCount: aggregateRows
        .filter((row) => normalizeStatus(row.status) === "stored" && normalizeIntakeMode(rowValue(row, "intakeMode", "intakemode")) !== "bulk")
        .reduce((sum, row) => sum + Math.floor(toNumber(rowValue(row, "assetCount", "assetcount"))), 0),
      storedQuantity: aggregateRows
        .filter((row) => normalizeStatus(row.status) === "stored")
        .reduce((sum, row) => sum + Math.floor(toNumber(rowValue(row, "quantityTotal", "quantitytotal"))), 0),
      pawnedQuantity: aggregateRows
        .filter((row) => normalizeStatus(row.status) === "pawned")
        .reduce((sum, row) => sum + Math.floor(toNumber(rowValue(row, "quantityTotal", "quantitytotal"))), 0),
      forfeitedQuantity: aggregateRows
        .filter((row) => normalizeStatus(row.status) === "forfeited")
        .reduce((sum, row) => sum + Math.floor(toNumber(rowValue(row, "quantityTotal", "quantitytotal"))), 0),
      latestAssets,
    };
  } catch {
    return summarizeAssets([]);
  }
}

function summarizeAssets(assets: CardBankAsset[]): CardBankAdminSummary {
  const latestAssets = assets
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);

  return {
    pendingCount: assets.filter((asset) => asset.status === "stored" && asset.intakeMode !== "bulk").length,
    storedQuantity: assets
      .filter((asset) => asset.status === "stored")
      .reduce((sum, asset) => sum + asset.quantity, 0),
    pawnedQuantity: assets
      .filter((asset) => asset.status === "pawned")
      .reduce((sum, asset) => sum + asset.quantity, 0),
    forfeitedQuantity: assets
      .filter((asset) => asset.status === "forfeited")
      .reduce((sum, asset) => sum + asset.quantity, 0),
    latestAssets,
  };
}
