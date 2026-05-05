import { NextResponse } from "next/server";
import { getBuyMarketDealsForUser } from "@/lib/buy-market";
import { getBuyMarketCurrentUser } from "@/lib/buy-market-auth";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const user = await getBuyMarketCurrentUser();
    if (!user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const deals = await getBuyMarketDealsForUser(user.id);

    return NextResponse.json(deals, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET BUY DEALS ERROR:", error);
    return NextResponse.json(
      { error: "โหลดดีลรับซื้อไม่สำเร็จ" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
