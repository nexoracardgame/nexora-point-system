import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAuctionBid } from "@/lib/auction-store";
import { resolveUserIdentity } from "@/lib/user-identity";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type SessionUser = {
  id?: string;
  lineId?: string;
  name?: string | null;
  image?: string | null;
};

function getSessionUser(session: Awaited<ReturnType<typeof getServerSession>>) {
  return ((session || {}) as { user?: SessionUser }).user || ({} as SessionUser);
}

function getAuctionUserId(user: SessionUser, identityUserId: string) {
  return (
    String(user.id || "").trim() ||
    String(user.lineId || "").trim() ||
    String(identityUserId || "").trim()
  );
}

function parsePrice(value: unknown) {
  const numeric = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function routeError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(extra || {}),
    },
    { status }
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = getSessionUser(session);
    const identity = await resolveUserIdentity(sessionUser);
    const bidderId = getAuctionUserId(sessionUser, identity.userId);

    if (!bidderId) {
      return routeError("กรุณาเข้าสู่ระบบก่อนส่งบิท", 401);
    }

    const { id } = await params;
    const body = await req.json();
    const amount = parsePrice(body.amount);
    const message = String(body.message || "").trim();

    if (amount <= 0) {
      return routeError("กรุณากรอกราคาบิทให้ถูกต้อง");
    }

    const result = await createAuctionBid({
      auctionId: String(id || "").trim(),
      bidderId,
      bidderName: identity.name,
      bidderImage: identity.image,
      amount,
      message,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    const minimumBid = (error as Error & { minimumBid?: number })?.minimumBid;

    if (message === "AUCTION_BLACKLISTED") {
      return routeError("บัญชีนี้ถูกระงับสิทธิ์จากสนามประมูล", 403);
    }

    if (message === "OWNER_CANNOT_BID") {
      return routeError("เจ้าของห้องไม่สามารถบิทการ์ดตัวเองได้");
    }

    if (message === "AUCTION_NOT_STARTED") {
      return routeError("ห้องประมูลนี้ยังไม่ถึงเวลาเปิด");
    }

    if (message === "AUCTION_ENDED") {
      return routeError("ห้องประมูลนี้ปิดแล้ว");
    }

    if (message === "BID_TOO_LOW") {
      return routeError("ราคาบิทต่ำกว่าขั้นต่ำของห้องนี้", 400, {
        minimumBid,
      });
    }

    if (message === "AUCTION_NOT_FOUND") {
      return routeError("ไม่พบห้องประมูลนี้", 404);
    }

    console.error("AUCTION BID ERROR:", error);
    return routeError("ส่งบิทไม่สำเร็จ", 500);
  }
}

