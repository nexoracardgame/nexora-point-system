import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type CalculatorState = {
  bronze: number;
  silver: number;
  gold: number;
};

let schemaReadyPromise: Promise<void> | null = null;

function ensureCollectionStateSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = prisma
      .$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS "CollectionState" ("userId" TEXT PRIMARY KEY, "ownedCards" JSONB NOT NULL DEFAULT \'[]\'::jsonb, "calculator" JSONB NOT NULL DEFAULT \'{}\'::jsonb, "selectedSetId" TEXT, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())'
      )
      .then(() =>
        prisma.$executeRawUnsafe(
          'ALTER TABLE "CollectionState" ADD COLUMN IF NOT EXISTS "ownedFoilCards" JSONB NOT NULL DEFAULT \'[]\'::jsonb'
        )
      )
      .then(() =>
        prisma.$executeRawUnsafe(
          'ALTER TABLE "CollectionState" ADD COLUMN IF NOT EXISTS "cardFinishMode" TEXT NOT NULL DEFAULT \'normal\''
        )
      )
      .then(() => undefined);
  }

  return schemaReadyPromise;
}

function getSessionUserId(session: unknown) {
  const user = (session as { user?: { id?: string } } | null)?.user;
  return String(user?.id || "").trim();
}

function normalizeOwnedCards(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(
      source
        .map((item) => Number.parseInt(String(item), 10))
        .filter((item) => Number.isFinite(item) && item >= 1 && item <= 293)
    )
  ).sort((a, b) => a - b);
}

function normalizeCalculator(value: unknown): CalculatorState {
  const raw = value && typeof value === "object" ? value : {};
  const source = raw as Partial<Record<keyof CalculatorState, unknown>>;
  return {
    bronze: Math.max(0, Number(source.bronze || 0)),
    silver: Math.max(0, Number(source.silver || 0)),
    gold: Math.max(0, Number(source.gold || 0)),
  };
}

function normalizeCardFinish(value: unknown) {
  return value === "foil" ? "foil" : "normal";
}

function normalizeRow(row?: Record<string, unknown> | null) {
  if (!row) {
    return {
      ownedCards: [],
      ownedFoilCards: [],
      calculator: { bronze: 0, silver: 0, gold: 0 },
      selectedSetId: "",
      cardFinishMode: "normal",
      updatedAt: null,
    };
  }

  return {
    ownedCards: normalizeOwnedCards(row.ownedCards || row.ownedcards),
    ownedFoilCards: normalizeOwnedCards(
      row.ownedFoilCards || row.ownedfoilcards
    ),
    calculator: normalizeCalculator(row.calculator),
    selectedSetId: String(row.selectedSetId || row.selectedsetid || "").trim(),
    cardFinishMode: normalizeCardFinish(
      row.cardFinishMode || row.cardfinishmode
    ),
    updatedAt: row.updatedAt || row.updatedat || null,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = getSessionUserId(session);

  if (!userId) {
    return NextResponse.json({ state: normalizeRow(null) }, { status: 401 });
  }

  await ensureCollectionStateSchema();
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    'SELECT "ownedCards", "ownedFoilCards", "calculator", "selectedSetId", "cardFinishMode", "updatedAt" FROM "CollectionState" WHERE "userId" = $1 LIMIT 1',
    userId
  );

  return NextResponse.json(
    { state: normalizeRow(rows[0]) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = getSessionUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const ownedCards = normalizeOwnedCards(body?.ownedCards);
  const ownedFoilCards = normalizeOwnedCards(body?.ownedFoilCards);
  const calculator = normalizeCalculator(body?.calculator);
  const selectedSetId = String(body?.selectedSetId || "").trim();
  const cardFinishMode = normalizeCardFinish(body?.cardFinishMode);

  await ensureCollectionStateSchema();
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    'INSERT INTO "CollectionState" ("userId", "ownedCards", "ownedFoilCards", "calculator", "selectedSetId", "cardFinishMode", "updatedAt") VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, NOW()) ON CONFLICT ("userId") DO UPDATE SET "ownedCards" = EXCLUDED."ownedCards", "ownedFoilCards" = EXCLUDED."ownedFoilCards", "calculator" = EXCLUDED."calculator", "selectedSetId" = EXCLUDED."selectedSetId", "cardFinishMode" = EXCLUDED."cardFinishMode", "updatedAt" = NOW() RETURNING "ownedCards", "ownedFoilCards", "calculator", "selectedSetId", "cardFinishMode", "updatedAt"',
    userId,
    JSON.stringify(ownedCards),
    JSON.stringify(ownedFoilCards),
    JSON.stringify(calculator),
    selectedSetId,
    cardFinishMode
  );

  return NextResponse.json(
    { success: true, state: normalizeRow(rows[0]) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
