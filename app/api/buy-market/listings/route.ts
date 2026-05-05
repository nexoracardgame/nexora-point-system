import { NextRequest, NextResponse } from "next/server";
import {
  createBuyMarketListing,
  getBuyMarketListings,
  getBuyMarketListingsByBuyer,
} from "@/lib/buy-market";
import { getBuyMarketCurrentUser } from "@/lib/buy-market-auth";
import { resolveCardDisplayImage } from "@/lib/card-image";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...(init?.headers || {}),
    },
  });
}

function normalizeCardNo(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? String(Number(digits)).padStart(3, "0") : "";
}

export async function GET(req: NextRequest) {
  const scope = String(req.nextUrl.searchParams.get("scope") || "").trim();

  if (scope === "manage") {
    const user = await getBuyMarketCurrentUser();

    if (!user.id) {
      return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
    }

    const listings = await getBuyMarketListingsByBuyer(user.id);

    return jsonNoStore({
      listings,
      currentUser: {
        id: user.id,
        isAdmin: user.isAdmin,
      },
    });
  }

  const listings = await getBuyMarketListings();
  return jsonNoStore({ listings });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getBuyMarketCurrentUser();
    if (!user.id) {
      return jsonNoStore({ error: "กรุณาเข้าสู่ระบบก่อนสร้างโพสต์รับซื้อ" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const cardNo = normalizeCardNo(body?.cardNo);
    const offerPrice = Number(body?.offerPrice);
    const cardName = String(body?.cardName || "").trim() || null;
    const rarity = String(body?.rarity || "").trim() || null;
    const imageUrl =
      String(body?.imageUrl || "").trim() || resolveCardDisplayImage(cardNo, null);

    if (!cardNo) {
      return jsonNoStore({ error: "กรอกเลขการ์ดที่ต้องการรับซื้อก่อน" }, { status: 400 });
    }

    if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
      return jsonNoStore({ error: "กรอกราคารับซื้อให้ถูกต้อง" }, { status: 400 });
    }

    const listing = await createBuyMarketListing({
      cardNo,
      cardName,
      imageUrl,
      rarity,
      offerPrice,
      buyerId: user.id,
    });

    return jsonNoStore({ success: true, listing });
  } catch (error) {
    console.error("BUY MARKET CREATE ERROR:", error);
    return jsonNoStore({ error: "สร้างโพสต์รับซื้อไม่สำเร็จ" }, { status: 500 });
  }
}
