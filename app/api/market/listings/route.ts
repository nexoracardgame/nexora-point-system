import { NextResponse } from "next/server";
import { getActiveMarketListingFeed } from "@/lib/market-feed";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const fixed = await getActiveMarketListingFeed();

  return NextResponse.json(fixed, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
