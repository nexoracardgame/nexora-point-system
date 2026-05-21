import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createAuctionRoom,
  getAuctionRooms,
  isAuctionBlacklisted,
} from "@/lib/auction-store";
import { decorateRarityWithFinish, normalizeMarketCardFinish } from "@/lib/card-finish";
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

function normalizeCardNo(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? digits.padStart(3, "0").slice(-3) : "";
}

function parsePrice(value: unknown) {
  const numeric = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function getAuctionUserId(user: SessionUser, identityUserId: string) {
  return (
    String(user.id || "").trim() ||
    String(user.lineId || "").trim() ||
    String(identityUserId || "").trim()
  );
}

function badRequest(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function GET() {
  try {
    const rooms = await getAuctionRooms();

    return NextResponse.json(
      {
        success: true,
        rooms,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("AUCTION LIST ERROR:", error);
    return badRequest("โหลดสนามประมูลไม่สำเร็จ", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = getSessionUser(session);
    const identity = await resolveUserIdentity(sessionUser);
    const sellerId = getAuctionUserId(sessionUser, identity.userId);

    if (!sellerId) {
      return badRequest("กรุณาเข้าสู่ระบบก่อนสร้างห้องประมูล", 401);
    }

    if (await isAuctionBlacklisted(sellerId)) {
      return badRequest("บัญชีนี้ถูกระงับสิทธิ์จากสนามประมูล", 403);
    }

    const body = await req.json();
    const cardNo = normalizeCardNo(body.cardNo);
    const cardName =
      String(body.cardName || "").trim() || `NEXORA Card #${cardNo}`;
    const finish = normalizeMarketCardFinish(cardNo, body.cardFinish);
    const rarity = decorateRarityWithFinish(
      cardNo,
      String(body.rarity || "Legendary").trim() || "Legendary",
      finish
    );
    const imageUrl = String(body.imageUrl || "").trim();
    const openingPrice = parsePrice(body.openingPrice);
    const minBidStep = parsePrice(body.minBidStep);
    const startsAt = new Date(String(body.startsAt || ""));
    const endsAt = new Date(String(body.endsAt || ""));

    if (!cardNo) {
      return badRequest("กรุณากรอกเลขการ์ดให้ถูกต้อง");
    }

    if (openingPrice <= 0) {
      return badRequest("กรุณากรอกราคาเปิดประมูลให้ถูกต้อง");
    }

    if (minBidStep <= 0) {
      return badRequest("กรุณากรอกบิทขั้นต่ำให้ถูกต้อง");
    }

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return badRequest("กรุณาตั้งวันและเวลาประมูลให้ครบ");
    }

    if (endsAt.getTime() <= startsAt.getTime()) {
      return badRequest("เวลาปิดประมูลต้องอยู่หลังเวลาเปิดประมูล");
    }

    const room = await createAuctionRoom({
      cardNo,
      cardName,
      imageUrl,
      rarity,
      openingPrice,
      minBidStep,
      startsAt,
      endsAt,
      sellerId,
      sellerName: identity.name,
      sellerImage: identity.image,
    });

    return NextResponse.json({
      success: true,
      room,
    });
  } catch (error) {
    console.error("AUCTION CREATE ERROR:", error);
    return badRequest("สร้างห้องประมูลไม่สำเร็จ", 500);
  }
}
