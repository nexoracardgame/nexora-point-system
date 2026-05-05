import { NextRequest, NextResponse } from "next/server";
import { actOnBuyDeal } from "@/lib/buy-market";
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
      return jsonNoStore({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const dealId = String(body?.dealId || "").trim();
    const action = String(body?.action || "").trim().toLowerCase();

    if (!dealId || !["accept", "reject", "cancel"].includes(action)) {
      return jsonNoStore({ error: "ข้อมูลดีลไม่ครบ" }, { status: 400 });
    }

    const result = await actOnBuyDeal({
      dealId,
      action: action as "accept" | "reject" | "cancel",
      actorId: user.id,
    });

    return jsonNoStore(result);
  } catch (error) {
    console.error("BUY DEAL ACTION ERROR:", error);
    return jsonNoStore(
      { error: "จัดการดีลรับซื้อไม่สำเร็จ หรือคุณไม่มีสิทธิ์ทำรายการนี้" },
      { status: 403 }
    );
  }
}
