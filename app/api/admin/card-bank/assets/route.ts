import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createCardBankEntries,
  type CardBankEntryMode,
  type CardBankIntakeMode,
} from "@/lib/card-bank-store";
import { isStaffRole } from "@/lib/staff-auth";

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
          quantity: cleanQuantity(item.quantity),
          imageUrl: cleanText(item.imageUrl) || null,
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
        }))
        .filter((item) => item.setId && item.setName)
    : [];

  const bulkObject = asObject(body.bulk);
  const bulk = {
    nexValue: cleanNumber(bulkObject.nexValue),
    coinValue: Math.floor(cleanNumber(bulkObject.coinValue)),
  };

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
    actor: {
      id: sessionUser.id,
      name: cleanText(sessionUser.name) || cleanText(sessionUser.lineId) || "NEXORA Staff",
    },
  });

  revalidatePath("/admin/card-bank");
  revalidatePath("/admin/card-bank/create");
  revalidatePath("/card-bank");

  return NextResponse.json({
    ok: true,
    createdCount: assets.length,
    assets,
  });
}
