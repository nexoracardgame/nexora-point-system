export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMarketListingsBySeller } from "@/lib/market-listings";

type SessionUser = {
  id?: string;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = ((session?.user || {}) as SessionUser).id;

  if (!userId) {
    return NextResponse.json({ items: [] });
  }

  const items = await getMarketListingsBySeller(userId);
  return NextResponse.json({ items });
}
