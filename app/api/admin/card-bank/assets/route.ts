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
  getPawnCollateralSummary,
} from "@/lib/pawn-terms";
import {
  getNexoraCoinReward,
  getNexoraSingleCardNexReward,
} from "@/lib/nexora-card-rewards";

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

function normalizePawnPayload(rawPawn: Record<string, unknown> | undefined, fallbackCollateralValueTHB = 0) {
  if (!rawPawn || rawPawn.principalTHB === undefined) return null;

  const collateralValueTHB = Math.max(
    0,
    cleanNumber(rawPawn.collateralValueTHB || fallbackCollateralValueTHB)
  );
  const collateralSummary = getPawnCollateralSummary(collateralValueTHB);
  const requestedPrincipalTHB = Math.max(0, cleanNumber(rawPawn.principalTHB));
  const principalTHB =
    requestedPrincipalTHB > 0 ? requestedPrincipalTHB : collateralSummary.maxPrincipalTHB;

  if (collateralSummary.maxPrincipalTHB <= 0) {
    throw new Error("invalid_collateral_value");
  }

  if (principalTHB > collateralSummary.maxPrincipalTHB) {
    throw new Error(
      `principal_over_limit:${collateralSummary.maxPrincipalTHB}`
    );
  }

  return {
    principalTHB,
    interestRate: PAWN_STANDARD_INTEREST_RATE,
    maintenanceFeeTHB: PAWN_STANDARD_MAINTENANCE_FEE_THB,
    collateralValueTHB: collateralSummary.collateralValueTHB,
    dueDays: Math.max(1, Math.floor(cleanNumber(rawPawn.dueDays || 30)) || 30),
    note: cleanText(rawPawn.note) || null,
  };
}

function cleanQuantity(value: unknown) {
  const quantity = Math.floor(cleanNumber(value));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function normalizeCardNo(value: unknown) {
  const digits = cleanText(value).replace(/\D/g, "");
  if (!digits) return "";
  const number = Number(digits.slice(-3));
  if (!Number.isFinite(number) || number < 1 || number > 293) return "";
  return String(number).padStart(3, "0");
}

function resolveSpecificCardCollateralValueTHB(item: Record<string, unknown>, quantity: number) {
  const explicitTotalValue = Math.max(0, cleanNumber(item.collateralValueTHB));
  if (explicitTotalValue > 0) return explicitTotalValue;

  const perCardValue = Math.max(0, cleanNumber(item.valueTHB || item.estimatedValueTHB));
  if (perCardValue > 0) return perCardValue * quantity;

  const cardNo = normalizeCardNo(item.cardNo);
  const coinValue = getNexoraCoinReward(cardNo)?.coinValue || 0;
  if (coinValue > 0) return coinValue * quantity;

  const singleCardNexValue = getNexoraSingleCardNexReward(cardNo)?.nexValue || 0;
  if (singleCardNexValue > 0) return Math.round(singleCardNexValue / 2) * quantity;

  return 0;
}

function resolveSetCollateralValueTHB(item: Record<string, unknown>, quantity: number) {
  const explicitTotalValue = Math.max(0, cleanNumber(item.collateralValueTHB));
  if (explicitTotalValue > 0) return explicitTotalValue;

  const fullValuePerSet = Math.max(
    0,
    cleanNumber(item.fullNexValue || item.valueTHB || item.nexValue)
  );
  return fullValuePerSet * quantity;
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

  try {
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
          .map((item) => {
            const quantity = cleanQuantity(item.quantity);
            const fallbackCollateralValueTHB = resolveSpecificCardCollateralValueTHB(item, quantity);
            return {
              cardNo: normalizeCardNo(item.cardNo),
              cardName: cleanText(item.cardName),
              cardType: cleanText(item.cardType).toLowerCase() === "foil" ? ("foil" as const) : ("normal" as const),
              rarity: cleanText(item.rarity),
              assetTier: cleanText(item.assetTier),
              quantity,
              imageUrl: cleanText(item.imageUrl) || null,
              pawn: normalizePawnPayload(asObject(item.pawn), fallbackCollateralValueTHB) || undefined,
            };
          })
          .filter((item) => item.cardNo && item.cardName)
      : [];

    const setItems = Array.isArray(body.setItems)
      ? body.setItems
          .map((item) => asObject(item))
          .map((item) => {
            const quantity = cleanQuantity(item.quantity);
            const fallbackCollateralValueTHB = resolveSetCollateralValueTHB(item, quantity);
            return {
              setId: cleanText(item.setId),
              order: Math.floor(cleanNumber(item.order)),
              setName: cleanText(item.setName),
              quantity,
              nexValue: cleanNumber(item.nexValue),
              reward: cleanText(item.reward),
              withFoilBonus: Boolean(item.withFoilBonus),
              cardTotal: Math.floor(cleanNumber(item.cardTotal)),
              pawn: normalizePawnPayload(asObject(item.pawn), fallbackCollateralValueTHB) || undefined,
            };
          })
          .filter((item) => item.setId && item.setName)
      : [];

    const bulkObject = asObject(body.bulk);
    const bulk = {
      nexValue: cleanNumber(bulkObject.nexValue),
      coinValue: Math.floor(cleanNumber(bulkObject.coinValue)),
      category: cleanText(bulkObject.category) || "pure",
      pawn: normalizePawnPayload(
        asObject(bulkObject.pawn),
        cleanNumber(bulkObject.nexValue) + cleanNumber(bulkObject.coinValue)
      ) || undefined,
    };
    const pawn = undefined;

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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    if (message.startsWith("principal_over_limit:")) {
      const limit = Number(message.split(":")[1] || 0);
      return badRequest(`เงินต้นเกินเพดาน รับยอดได้ไม่เกิน ${limit.toLocaleString("th-TH")} บาท`);
    }
    if (message === "invalid_collateral_value") {
      return badRequest("ยังไม่พบมูลค่าจริงของการ์ด กรุณารอข้อมูลการ์ดก่อนบันทึก");
    }
    return NextResponse.json(
      {
        ok: false,
        error: message || "sync_failed",
      },
      { status: 400 }
    );
  }
}
