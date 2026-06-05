import "server-only";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  ensureLocalStoreFile,
  readLocalStoreJson,
  writeLocalStoreJson,
} from "@/lib/local-store-dir";

type DbRow = Record<string, unknown>;

export type CardBankEntryMode = "bank" | "pawn";
export type CardBankIntakeMode = "specific" | "sets" | "bulk";
export type CardBankStatus = "stored" | "pawned" | "converted" | "withdrawn" | "forfeited";

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
  };
  actor: {
    id: string;
    name: string;
  };
};

export type WithdrawCardBankAssetInput = {
  assetId: string;
  quantity: number;
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

function toNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function toNullableString(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

function toAssetRecord(row: DbRow): CardBankAsset {
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
  };
}

async function ensureCardBankSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS "CardBankAsset" ("id" TEXT PRIMARY KEY, "ownerId" TEXT NOT NULL, "ownerLineId" TEXT, "ownerName" TEXT NOT NULL, "entryMode" TEXT NOT NULL DEFAULT \'bank\', "intakeMode" TEXT NOT NULL DEFAULT \'specific\', "cardNo" TEXT, "cardName" TEXT NOT NULL, "cardType" TEXT, "quantity" INTEGER NOT NULL DEFAULT 1, "imageUrl" TEXT, "setId" TEXT, "setName" TEXT, "setOrder" INTEGER, "setCardTotal" INTEGER, "withFoilBonus" BOOLEAN NOT NULL DEFAULT FALSE, "valueTHB" DOUBLE PRECISION NOT NULL DEFAULT 0, "nexValue" DOUBLE PRECISION NOT NULL DEFAULT 0, "coinValue" INTEGER NOT NULL DEFAULT 0, "status" TEXT NOT NULL DEFAULT \'stored\', "sourcePayload" JSONB, "createdById" TEXT, "createdByName" TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())'
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

function buildAssets(input: CreateCardBankEntriesInput) {
  const now = new Date().toISOString();
  const status: CardBankStatus = input.entryMode === "pawn" ? "pawned" : "stored";
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
      quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
      imageUrl: null,
      setId: item.setId,
      setName: item.setName,
      setOrder: Math.floor(Number(item.order || 0)),
      setCardTotal: Math.floor(Number(item.cardTotal || 0)),
      withFoilBonus: Boolean(item.withFoilBonus),
      valueTHB: 0,
      nexValue: Number(item.nexValue || 0),
      coinValue: 0,
      sourcePayload: item,
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
        quantity: 1,
        imageUrl: null,
        setId: null,
        setName: null,
        setOrder: null,
        setCardTotal: null,
        withFoilBonus: false,
        valueTHB: 0,
        nexValue: Number(input.bulk?.nexValue || 0),
        coinValue: Math.floor(Number(input.bulk?.coinValue || 0)),
        sourcePayload: input.bulk || {},
      },
    ];
  }

  return (input.items || []).map((item) => ({
    ...base,
    id: randomUUID(),
    cardNo: item.cardNo,
    cardName: item.cardName,
    cardType: item.cardType,
    quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
    imageUrl: item.imageUrl || null,
    setId: null,
    setName: null,
    setOrder: null,
    setCardTotal: null,
    withFoilBonus: item.cardType === "foil",
    valueTHB: 0,
    nexValue: 0,
    coinValue: 0,
    sourcePayload: item,
  }));
}

export async function createCardBankEntries(input: CreateCardBankEntriesInput) {
  const assets = buildAssets(input);
  if (assets.length === 0) return [];

  if (!hasDatabaseConfig()) {
    const current = await readLocalAssets();
    await writeLocalAssets([...assets.map(({ sourcePayload: _sourcePayload, ...asset }) => asset), ...current]);
    return assets.map(({ sourcePayload: _sourcePayload, ...asset }) => asset);
  }

  await ensureCardBankSchema();

  await prisma.$transaction(
    assets.map((asset) =>
      prisma.$executeRawUnsafe(
        'INSERT INTO "CardBankAsset" ("id", "ownerId", "ownerLineId", "ownerName", "entryMode", "intakeMode", "cardNo", "cardName", "cardType", "quantity", "imageUrl", "setId", "setName", "setOrder", "setCardTotal", "withFoilBonus", "valueTHB", "nexValue", "coinValue", "status", "sourcePayload", "createdById", "createdByName") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22,$23)',
        asset.id,
        asset.ownerId,
        asset.ownerLineId,
        asset.ownerName,
        asset.entryMode,
        asset.intakeMode,
        asset.cardNo,
        asset.cardName,
        asset.cardType,
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

  return assets.map(({ sourcePayload: _sourcePayload, ...asset }) => asset);
}

export async function withdrawCardBankAsset(input: WithdrawCardBankAssetInput) {
  const assetId = String(input.assetId || "").trim();
  const requestedQuantity = Math.max(1, Math.floor(Number(input.quantity || 1)));
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

    const withdrawQuantity = Math.min(requestedQuantity, asset.quantity);
    const remainingQuantity = asset.quantity - withdrawQuantity;
    const updatedAsset: CardBankAsset = {
      ...asset,
      quantity: Math.max(0, remainingQuantity),
      status: remainingQuantity <= 0 ? "withdrawn" : asset.status,
      updatedAt: new Date().toISOString(),
    };

    await writeLocalAssets(
      current.map((item) => (item.id === assetId ? updatedAsset : item))
    );
    return {
      asset: updatedAsset,
      withdrawnQuantity: withdrawQuantity,
      remainingQuantity: updatedAsset.quantity,
    };
  }

  await ensureCardBankSchema();
  const rows = await prisma.$queryRawUnsafe<DbRow[]>(
    'SELECT * FROM "CardBankAsset" WHERE "id" = $1 LIMIT 1',
    assetId
  );
  const asset = rows[0] ? toAssetRecord(rows[0]) : null;
  if (!asset) throw new Error("Asset not found");
  if (asset.status === "withdrawn" || asset.status === "converted" || asset.status === "forfeited") {
    throw new Error("Asset is already closed");
  }

  const withdrawQuantity = Math.min(requestedQuantity, asset.quantity);
  const remainingQuantity = asset.quantity - withdrawQuantity;
  const nextStatus = remainingQuantity <= 0 ? "withdrawn" : asset.status;
  const afterState = {
    ...asset,
    quantity: Math.max(0, remainingQuantity),
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  };

  await prisma.$transaction([
    prisma.$executeRawUnsafe(
      'UPDATE "CardBankAsset" SET "quantity" = $1, "status" = $2, "updatedAt" = NOW() WHERE "id" = $3',
      afterState.quantity,
      afterState.status,
      assetId
    ),
    prisma.$executeRawUnsafe(
      'INSERT INTO "CardBankMovement" ("id", "assetId", "ownerId", "action", "beforeState", "afterState", "staffId", "staffName", "note") VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9)',
      randomUUID(),
      asset.id,
      asset.ownerId,
      "withdraw",
      JSON.stringify(asset),
      JSON.stringify({
        ...afterState,
        withdrawnQuantity: withdrawQuantity,
      }),
      input.actor.id,
      input.actor.name,
      String(input.note || "Return card asset to customer").trim()
    ),
  ]);

  return {
    asset: afterState,
    withdrawnQuantity: withdrawQuantity,
    remainingQuantity: afterState.quantity,
  };
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
