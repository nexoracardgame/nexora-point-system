import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createCardBankEntries,
  type CardBankEntryMode,
  type CardBankIntakeMode,
} from "@/lib/card-bank-store";
import { publishCardBankEvent } from "@/lib/card-bank-realtime";
import { isStaffRole } from "@/lib/staff-auth";
import {
  PAWN_STANDARD_INTEREST_RATE,
  PAWN_STANDARD_MAINTENANCE_FEE_THB,
  PAWN_STANDARD_LOAN_TO_VALUE_RATIO,
} from "@/lib/pawn-terms";

export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string;
  lineId?: string;
  name?: string | null;
  role?: string | null;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function clampPawnPrincipal(principalTHB: number, collateralValueTHB: number) {
  const maxPrincipalTHB = Math.floor(Math.max(0, collateralValueTHB) * PAWN_STANDARD_LOAN_TO_VALUE_RATIO);
  return Math.max(0, Math.min(Math.floor(principalTHB), maxPrincipalTHB));
}

function cleanQuantity(value: unknown) {
  const quantity = Math.floor(cleanNumber(value));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function normalizeEntryMode(value: unknown): CardBankEntryMode | null {
  const mode = cleanText(value).toLowerCase();
  return mode === "bank" || mode === "pawn" ? mode : null;
}

function normalizeIntakeMode(value: unknown): CardBankIntakeMode | null {
  const mode = cleanText(value).toLowerCase();
  return mode === "specific" || mode === "sets" || mode === "bulk" ? mode : null;
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const sessionUser = ((session || {}) as { user?: SessionUser }).user || {};

  if (!sessionUser.id || !isStaffRole(sessionUser.role)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = asObject(await request.json().catch(() => ({})));
  const owner = asObject(body.owner);
  const ownerId = cleanText(owner.id);
  const ownerName = cleanText(owner.name) || "NEXORA Customer";
  const entryMode = normalizeEntryMode(body.entryMode);
  const intakeMode = normalizeIntakeMode(body.intakeMode);

  if (!ownerId) return badRequest("Missing owner id");
  if (!entryMode) return badRequest("Invalid entry mode");
  if (!intakeMode) return badRequest("Invalid intake mode");

  const items = Array.isArray(body.items)
    ? body.items
        .map((item) => asObject(item))
        .map((item) => ({
          cardNo: cleanText(item.cardNo).replace(/\D/g, "").padStart(3, "0").slice(-3),
          cardName: cleanText(item.cardName),
          cardType: cleanText(item.cardType).toLowerCase() === "foil" ? ("foil" as const) : ("normal" as const),
          rarity: cleanText(item.rarity),
          assetTier: cleanText(item.assetTier),
          quantity: cleanQuantity(item.quantity),
          imageUrl: cleanText(item.imageUrl) || null,
          pawn: asObject(item.pawn).principalTHB !== undefined
            ? {
                principalTHB: Math.max(0, cleanNumber(asObject(item.pawn).principalTHB)),
                interestRate: PAWN_STANDARD_INTEREST_RATE,
                maintenanceFeeTHB: PAWN_STANDARD_MAINTENANCE_FEE_THB,
                dueDays: Math.max(1, Math.floor(cleanNumber(asObject(item.pawn).dueDays || 30)) || 30),
                note: cleanText(asObject(item.pawn).note) || null,
              }
            : undefined,
        }))
        .filter((item) => item.cardNo && item.cardName)
    : [];

  const setItems = Array.isArray(body.setItems)
    ? body.setItems
        .map((item) => asObject(item))
        .map((item) => ({
          setId: cleanText(item.setId),
          order: Math.floor(cleanNumber(item.order)),
          setName: cleanText(item.setName),
          quantity: cleanQuantity(item.quantity),
          nexValue: cleanNumber(item.nexValue),
          reward: cleanText(item.reward),
          withFoilBonus: Boolean(item.withFoilBonus),
          cardTotal: Math.floor(cleanNumber(item.cardTotal)),
          pawn: asObject(item.pawn).principalTHB !== undefined
            ? {
                principalTHB: Math.max(0, cleanNumber(asObject(item.pawn).principalTHB)),
                interestRate: PAWN_STANDARD_INTEREST_RATE,
                maintenanceFeeTHB: PAWN_STANDARD_MAINTENANCE_FEE_THB,
                dueDays: Math.max(1, Math.floor(cleanNumber(asObject(item.pawn).dueDays || 30)) || 30),
                note: cleanText(asObject(item.pawn).note) || null,
              }
            : undefined,
        }))
        .filter((item) => item.setId && item.setName)
    : [];

  const bulkObject = asObject(body.bulk);
  const bulk = {
    nexValue: cleanNumber(bulkObject.nexValue),
    coinValue: Math.floor(cleanNumber(bulkObject.coinValue)),
    category: cleanText(bulkObject.category) || "pure",
    pawn: asObject(bulkObject.pawn).principalTHB !== undefined
      ? {
          principalTHB: Math.max(0, cleanNumber(asObject(bulkObject.pawn).principalTHB)),
          interestRate: PAWN_STANDARD_INTEREST_RATE,
          maintenanceFeeTHB: PAWN_STANDARD_MAINTENANCE_FEE_THB,
          collateralValueTHB: Math.max(0, cleanNumber(asObject(bulkObject.pawn).collateralValueTHB || cleanNumber(bulkObject.nexValue) + cleanNumber(bulkObject.coinValue))),
          dueDays: Math.max(1, Math.floor(cleanNumber(asObject(bulkObject.pawn).dueDays || 30)) || 30),
          note: cleanText(asObject(bulkObject.pawn).note) || null,
        }
      : undefined,
  };
  const pawnObject = asObject(body.pawn);
  const pawn =
    entryMode === "pawn"
      ? {
          principalTHB: Math.max(0, cleanNumber(pawnObject.principalTHB)),
          interestRate: PAWN_STANDARD_INTEREST_RATE,
          maintenanceFeeTHB: PAWN_STANDARD_MAINTENANCE_FEE_THB,
          collateralValueTHB: Math.max(0, cleanNumber(pawnObject.collateralValueTHB || cleanNumber(pawnObject.principalTHB) / PAWN_STANDARD_LOAN_TO_VALUE_RATIO)),
          dueDays: Math.max(1, Math.floor(cleanNumber(pawnObject.dueDays || 30)) || 30),
          note: cleanText(pawnObject.note) || null,
      }
      : undefined;

  if (pawn) {
    pawn.principalTHB = clampPawnPrincipal(pawn.principalTHB, pawn.collateralValueTHB);
  }
  if (bulk.pawn) {
    bulk.pawn.principalTHB = clampPawnPrincipal(bulk.pawn.principalTHB, bulk.pawn.collateralValueTHB);
  }

  if (intakeMode === "specific" && items.length === 0) {
    return badRequest("Specific intake requires at least one card");
  }
  if (intakeMode === "sets" && setItems.length === 0) {
    return badRequest("Set intake requires at least one set");
  }
  if (intakeMode === "bulk" && bulk.nexValue <= 0 && bulk.coinValue <= 0) {
    return badRequest("Bulk intake requires NEX or COIN value");
  }

  const assets = await createCardBankEntries({
    owner: {
      id: ownerId,
      lineId: cleanText(owner.lineId) || null,
      name: ownerName,
    },
    entryMode,
    intakeMode,
    items,
    setItems,
    bulk,
    pawn,
    actor: {
      id: sessionUser.id,
      name: cleanText(sessionUser.name) || cleanText(sessionUser.lineId) || "NEXORA Staff",
    },
  });

  revalidatePath("/admin/card-bank");
  revalidatePath("/admin/card-bank/pawn");
  revalidatePath("/admin/card-bank/create");
  revalidatePath("/card-bank");
  publishCardBankEvent({
    ownerId,
    action: "deposit",
  });

  return NextResponse.json({
    ok: true,
    createdCount: assets.length,
    assets,
  });
}
