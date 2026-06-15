import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withdrawCardBankAsset } from "@/lib/card-bank-store";
import { publishCardBankEvent } from "@/lib/card-bank-realtime";
import { isStaffRole } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string;
  lineId?: string;
  name?: string | null;
  role?: string | null;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanQuantity(value: unknown) {
  const quantity = Math.floor(Number(value || 1));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function cleanNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/card-bank/assets/[assetId]/withdraw">
) {
  const session = await getServerSession(authOptions);
  const sessionUser = ((session || {}) as { user?: SessionUser }).user || {};

  if (!sessionUser.id || !isStaffRole(sessionUser.role)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { assetId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    const result = await withdrawCardBankAsset({
      assetId,
      quantity: cleanQuantity(body.quantity),
      nexValue: Math.max(0, cleanNumber(body.nexValue)),
      coinValue: Math.max(0, Math.floor(cleanNumber(body.coinValue))),
      note: cleanText(body.note),
      actor: {
        id: sessionUser.id,
        name: cleanText(sessionUser.name) || cleanText(sessionUser.lineId) || "NEXORA Staff",
      },
    });

    revalidatePath("/admin/card-bank");
    revalidatePath("/admin/card-bank/pawn");
    revalidatePath("/card-bank");
    publishCardBankEvent({
      ownerId: result.asset.ownerId,
      assetId: result.asset.id,
      action: "withdraw",
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Withdraw failed",
      },
      { status: 400 }
    );
  }
}
