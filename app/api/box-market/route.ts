import { NextRequest, NextResponse } from "next/server";
import {
  getBoxMarketRequestUser,
  resolveBoxMarketUserId,
} from "@/lib/box-market-auth";
import {
  createBoxMarketListing,
  deleteBoxMarketListing,
  getBoxMarketListings,
  updateBoxMarketListingPrice,
} from "@/lib/box-market-store";
import type { BoxProductType } from "@/lib/box-market-types";

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

function normalizeProductType(value: unknown): BoxProductType {
  return String(value || "").trim().toLowerCase() === "pack" ? "pack" : "box";
}

function isBoxMarketAdminRole(value: unknown) {
  const role = String(value || "").trim().toLowerCase();
  return role === "admin" || role === "gm" || role === "superadmin";
}

async function getBoxMarketActor(req: NextRequest) {
  const sessionUser = await getBoxMarketRequestUser(req);
  const identity = {
    userId: String(sessionUser.id || "").trim(),
    name: String(sessionUser.name || "NEXORA User").trim(),
    image: String(sessionUser.image || "/avatar.png").trim(),
  };
  const userId = await resolveBoxMarketUserId(sessionUser, identity);

  return {
    sessionUser,
    identity,
    userId,
    isAdmin: isBoxMarketAdminRole(sessionUser.role),
  };
}

export async function GET() {
  const listings = await getBoxMarketListings();
  return jsonNoStore({ listings });
}

export async function POST(req: NextRequest) {
  try {
    const { identity, userId: sellerId } = await getBoxMarketActor(req);

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

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await getBoxMarketActor(req);

    if (!userId) {
      return jsonNoStore({ error: "กรุณาเข้าสู่ระบบก่อนแก้ไข" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const listingId = String(body?.listingId || "").trim();
    const price = Number(body?.price);

    if (!listingId) {
      return jsonNoStore({ error: "ไม่พบรายการสินค้า" }, { status: 400 });
    }

    if (!Number.isFinite(price) || price <= 0) {
      return jsonNoStore({ error: "กรอกราคาใหม่ให้ถูกต้อง" }, { status: 400 });
    }

    const listing = await updateBoxMarketListingPrice({
      listingId,
      actorId: userId,
      price,
    });

    return jsonNoStore({ success: true, listing });
  } catch (error) {
    console.error("BOX MARKET UPDATE ERROR:", error);
    return jsonNoStore(
      { error: "แก้ไขราคาไม่สำเร็จ หรือคุณไม่มีสิทธิ์แก้รายการนี้" },
      { status: 403 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId, isAdmin } = await getBoxMarketActor(req);

    if (!userId) {
      return jsonNoStore({ error: "กรุณาเข้าสู่ระบบก่อนลบสินค้า" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const listingId = String(body?.listingId || "").trim();

    if (!listingId) {
      return jsonNoStore({ error: "ไม่พบรายการสินค้า" }, { status: 400 });
    }

    await deleteBoxMarketListing({
      listingId,
      actorId: userId,
      isAdmin,
    });

    return jsonNoStore({ success: true, listingId });
  } catch (error) {
    console.error("BOX MARKET DELETE ERROR:", error);
    return jsonNoStore(
      { error: "ลบสินค้าไม่สำเร็จ หรือคุณไม่มีสิทธิ์ลบรายการนี้" },
      { status: 403 }
    );
  }
}
