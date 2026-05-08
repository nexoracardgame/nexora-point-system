import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { confirmAuctionWinner } from "@/lib/auction-store";
import { isAdminRole } from "@/lib/staff-auth";
import { resolveUserIdentity } from "@/lib/user-identity";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function routeError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const identity = await resolveUserIdentity(session?.user);
    const actorId = String(session?.user?.id || identity.userId || "").trim();
    const actorLineId = String(
      ((session?.user || {}) as { lineId?: string | null }).lineId || ""
    ).trim();

    if (!actorId) {
      return routeError("กรุณาเข้าสู่ระบบก่อน", 401);
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const winnerId = String(body?.winnerId || "").trim();

    const room = await confirmAuctionWinner({
      auctionId: String(id || "").trim(),
      winnerId,
      actorId,
      actorLineId,
      isAdmin: isAdminRole(String(session?.user?.role || "")),
    });

    return NextResponse.json({
      success: true,
      room,
    });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);

    if (message === "AUCTION_NOT_FOUND") {
      return routeError("ไม่พบห้องประมูลนี้", 404);
    }

    if (message === "AUCTION_OWNER_ONLY") {
      return routeError("เฉพาะเจ้าของห้องประมูลเท่านั้นที่ยืนยันผู้ชนะได้", 403);
    }

    if (message === "AUCTION_NOT_ENDED") {
      return routeError("ต้องรอให้ห้องประมูลสิ้นสุดเวลาก่อน", 400);
    }

    if (message === "MISSING_WINNER" || message === "WINNER_NOT_FOUND") {
      return routeError("ไม่พบผู้ชนะในกระดานประมูลนี้", 400);
    }

    if (
      message === "AUCTION_WINNER_WINDOW_EXPIRED" ||
      message === "AUCTION_ALREADY_CONFIRMED"
    ) {
      return routeError("สิทธิ์ของผู้ชนะคนนี้ไม่อยู่ในช่วงเวลาที่ระบบเปิดให้ยืนยันแล้ว", 400);
    }

    console.error("AUCTION CONFIRM WINNER ERROR:", error);
    return routeError("ยืนยันผู้ชนะไม่สำเร็จ", 500);
  }
}
