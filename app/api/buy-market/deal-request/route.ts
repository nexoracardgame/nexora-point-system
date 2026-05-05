import { NextRequest, NextResponse } from "next/server";
import { createBuyDealRequest } from "@/lib/buy-market";
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

export async function POST(req: NextRequest) {
  try {
    const user = await getBuyMarketCurrentUser();
    if (!user.id) {
      return jsonNoStore({ error: "กรุณาเข้าสู่ระบบก่อนเสนอขายการ์ด" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const listingId = String(body?.listingId || "").trim();
    const offeredPrice = Number(body?.offeredPrice);

    if (!listingId || !Number.isFinite(offeredPrice) || offeredPrice <= 0) {
      return jsonNoStore({ error: "กรอกข้อมูลข้อเสนอขายให้ครบ" }, { status: 400 });
    }

    const deal = await createBuyDealRequest({
      listingId,
      sellerId: user.id,
      sellerName: user.name,
      sellerImage: user.image,
      offeredPrice,
    });

    return jsonNoStore({
      success: true,
      message: "ส่งข้อเสนอขายให้ผู้รับซื้อสำเร็จ",
      deal,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "buy-deal-exists"
        ? "คุณส่งข้อเสนอขายค้างอยู่กับโพสต์รับซื้อนี้แล้ว"
        : error instanceof Error && error.message === "self-buy-deal"
          ? "ไม่สามารถเสนอขายให้โพสต์รับซื้อของตัวเองได้"
          : "ส่งข้อเสนอขายไม่สำเร็จ";

    return jsonNoStore({ error: message }, { status: 400 });
  }
}
