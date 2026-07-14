import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/staff-auth";
import {
  ensureCardSetRedemptionSchema,
  expireStaleCardSetRedemptions,
  serializeCardSetRedemption,
  syncPendingCardSetRedemptionPricing,
  type CardSetRedemptionRecord,
} from "@/lib/card-set-redemptions";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
};

type RouteProps = {
  params: Promise<{ code: string }>;
};

async function findRedemption(code: string) {
  const rows = await prisma.$queryRawUnsafe<CardSetRedemptionRecord[]>(
    `
      SELECT
        r.*,
        u."name" AS "userName",
        u."displayName" AS "userDisplayName",
        u."image" AS "userImage",
        u."lineId" AS "userLineId"
      FROM "CardSetRedemption" r
      LEFT JOIN "User" u ON u."id" = r."userId"
      WHERE r."code" = $1
      LIMIT 1
    `,
    code
  );

  return rows[0] || null;
}

export async function GET(_req: Request, { params }: RouteProps) {
  try {
    const session = await getServerSession(authOptions);
    const userId = String(
      (session?.user as { id?: string } | undefined)?.id || ""
    ).trim();
    const role = String(
      (session?.user as { role?: string } | undefined)?.role || ""
    ).trim();
    const { code } = await params;
    const safeCode = decodeURIComponent(String(code || "").trim());

    if (!safeCode) {
      return NextResponse.json(
        { error: "Card set code is required" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    await ensureCardSetRedemptionSchema();
    await expireStaleCardSetRedemptions();
    await syncPendingCardSetRedemptionPricing();

    const redemption = await findRedemption(safeCode);
    if (!redemption) {
      return NextResponse.json(
        { error: "Card set redemption not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    if (
      redemption.userId !== userId &&
      !isStaffRole(role) &&
      !redemption.createdByAdminMode
    ) {
      return NextResponse.json(
        { error: "You do not have permission to view this redemption" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        redemption: serializeCardSetRedemption(redemption),
        syncedAt: Date.now(),
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("CARD_SET_DETAIL_ERROR", error);
    return NextResponse.json(
      { error: "Failed to load card set redemption" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
