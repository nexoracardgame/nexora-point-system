import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { applyCardBankPawnAction } from "@/lib/card-bank-store";
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

function cleanNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function asAction(value: unknown) {
  const action = cleanText(value).toLowerCase();
  if (action === "payment" || action === "renew" || action === "forfeit") {
    return action;
  }
  return null;
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/card-bank/assets/[assetId]/pawn-action">
) {
  const session = await getServerSession(authOptions);
  const sessionUser = ((session || {}) as { user?: SessionUser }).user || {};

  if (!sessionUser.id || !isStaffRole(sessionUser.role)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { assetId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = asAction(body.action);

  if (!action) {
    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  }

  try {
    const asset = await applyCardBankPawnAction({
      assetId,
      action,
      amountTHB: cleanNumber(body.amountTHB),
      extendDays: cleanNumber(body.extendDays),
      note: cleanText(body.note) || null,
      actor: {
        id: sessionUser.id,
        name: cleanText(sessionUser.name) || cleanText(sessionUser.lineId) || "NEXORA Staff",
      },
    });

    revalidatePath("/admin/card-bank");
    revalidatePath("/admin/card-bank/pawn");
    revalidatePath("/card-bank");
    publishCardBankEvent({
      ownerId: asset.ownerId,
      action: "deposit",
    });

    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Pawn action failed",
      },
      { status: 400 }
    );
  }
}
