import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getBoxMarketSessionUser,
  resolveBoxMarketUserId,
  type BoxMarketSessionUser,
} from "@/lib/box-market-auth";
import {
  createBoxMarketListing,
  getBoxMarketListings,
} from "@/lib/box-market-store";
import { resolveUserIdentity } from "@/lib/user-identity";
import type { BoxProductType } from "@/lib/box-market-types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type BoxMarketSession = {
  user?: BoxMarketSessionUser;
};

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...(init?.headers || {}),
    },
  });
}

function normalizeProductType(value: unknown): BoxProductType {
  return String(value || "").trim().toLowerCase() === "pack" ? "pack" : "box";
}

export async function GET() {
  const listings = await getBoxMarketListings();
  return jsonNoStore({ listings });
}

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as BoxMarketSession | null;
    const sessionUser = getBoxMarketSessionUser(session);
    const identity = await resolveUserIdentity({
      id: sessionUser.id || undefined,
      name: sessionUser.name,
      image: sessionUser.image,
    });
    const sellerId = await resolveBoxMarketUserId(sessionUser, identity);

    if (!sellerId) {
      return jsonNoStore({ error: "กรุณาเข้าสู่ระบบก่อนลงขาย" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || "").trim();
    const description = String(body?.description || "").trim();
    const productType = normalizeProductType(body?.productType);
    const price = Number(body?.price);
    const quantity = Math.max(1, Math.floor(Number(body?.quantity || 1)));
    const imageUrl = String(body?.imageUrl || "").trim() || null;

    if (title.length < 2) {
      return jsonNoStore(
        { error: "กรอกชื่อสินค้าให้ครบก่อนลงขาย" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(price) || price <= 0) {
      return jsonNoStore(
        { error: "กรอกราคาขายให้ถูกต้อง" },
        { status: 400 }
      );
    }

    const listing = await createBoxMarketListing({
      sellerId,
      sellerName: identity.name,
      sellerImage: identity.image,
      title,
      productType,
      description,
      price,
      quantity,
      imageUrl,
    });

    return jsonNoStore({ success: true, listing });
  } catch (error) {
    console.error("BOX MARKET CREATE ERROR:", error);
    return jsonNoStore(
      { error: "ลงขายกล่องสุ่มไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
