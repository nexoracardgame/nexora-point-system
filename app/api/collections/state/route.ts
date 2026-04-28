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
      .then(() => undefined);
  }

  return schemaReadyPromise;
}

function getSessionUserId(session: Awaited<ReturnType<typeof getServerSession>>) {
  return String(
    (session?.user as { id?: string } | undefined)?.id || ""
  ).trim();
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

function normalizeRow(row?: Record<string, unknown> | null) {
  if (!row) {
    return {
      ownedCards: [],
      calculator: { bronze: 0, silver: 0, gold: 0 },
      selectedSetId: "",
      updatedAt: null,
    };
  }

  return {
    ownedCards: normalizeOwnedCards(row.ownedCards || row.ownedcards),
    calculator: normalizeCalculator(row.calculator),
    selectedSetId: String(row.selectedSetId || row.selectedsetid || "").trim(),
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
    'SELECT "ownedCards", "calculator", "selectedSetId", "updatedAt" FROM "CollectionState" WHERE "userId" = $1 LIMIT 1',
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
  const calculator = normalizeCalculator(body?.calculator);
  const selectedSetId = String(body?.selectedSetId || "").trim();

  await ensureCollectionStateSchema();
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    'INSERT INTO "CollectionState" ("userId", "ownedCards", "calculator", "selectedSetId", "updatedAt") VALUES ($1, $2::jsonb, $3::jsonb, $4, NOW()) ON CONFLICT ("userId") DO UPDATE SET "ownedCards" = EXCLUDED."ownedCards", "calculator" = EXCLUDED."calculator", "selectedSetId" = EXCLUDED."selectedSetId", "updatedAt" = NOW() RETURNING "ownedCards", "calculator", "selectedSetId", "updatedAt"',
    userId,
    JSON.stringify(ownedCards),
    JSON.stringify(calculator),
    selectedSetId
  );

  return NextResponse.json(
    { success: true, state: normalizeRow(rows[0]) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
