import { NextRequest, NextResponse } from "next/server";
import {
  deleteBuyMarketListing,
  getBuyMarketListingById,
  updateBuyMarketListing,
} from "@/lib/buy-market";
import { getBuyMarketCurrentUser } from "@/lib/buy-market-auth";

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

async function getRouteId(
  ctx: { params: Promise<{ id: string }> }
) {
  const params = await ctx.params;
  return String(params?.id || "").trim();
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const listing = await getBuyMarketListingById(await getRouteId(ctx));
  if (!listing) {
    return jsonNoStore({ error: "ไม่พบโพสต์รับซื้อ" }, { status: 404 });
  }

  return jsonNoStore({ listing });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getBuyMarketCurrentUser();
    if (!user.id) {
      return jsonNoStore({ error: "กรุณาเข้าสู่ระบบก่อนแก้ไข" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const offerPrice = Number(body?.offerPrice);

    if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
      return jsonNoStore({ error: "กรอกราคารับซื้อใหม่ให้ถูกต้อง" }, { status: 400 });
    }

    const listing = await updateBuyMarketListing({
      id: await getRouteId(ctx),
      buyerId: user.id,
      offerPrice,
    });

    return jsonNoStore({ success: true, listing });
  } catch (error) {
    console.error("BUY MARKET UPDATE ERROR:", error);
    return jsonNoStore({ error: "แก้ไขโพสต์รับซื้อไม่สำเร็จ" }, { status: 403 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getBuyMarketCurrentUser();
    if (!user.id) {
      return jsonNoStore({ error: "กรุณาเข้าสู่ระบบก่อนลบ" }, { status: 401 });
    }

    const id = await getRouteId(ctx);
    await deleteBuyMarketListing({
      id,
      buyerId: user.id,
      isAdmin: user.isAdmin,
    });

    return jsonNoStore({ success: true, id });
  } catch (error) {
    console.error("BUY MARKET DELETE ERROR:", error);
    return jsonNoStore({ error: "ลบโพสต์รับซื้อไม่สำเร็จ" }, { status: 403 });
  }
}
