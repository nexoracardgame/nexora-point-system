import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMarketDealsForUser } from "@/lib/market-deals";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const currentUserId = String(
      (session?.user as { id?: string } | undefined)?.id || ""
    );
    const result = await getMarketDealsForUser(currentUserId);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET DEALS ERROR:", error);
    return NextResponse.json([], {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}
