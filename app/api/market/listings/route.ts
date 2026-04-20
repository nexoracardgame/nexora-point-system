import { NextResponse } from "next/server";
import { getMarketListings } from "@/lib/market-listings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const listings = await getMarketListings();

  const fixed = listings
    .filter((item) => String(item.status || "").toLowerCase() !== "sold")
    .sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    )
    .slice(0, 24)
    .map((item) => ({
      ...item,
      cardName:
        item.cardName || `Card #${String(item.cardNo || item.id).padStart(3, "0")}`,
      imageUrl:
        item.imageUrl ||
        `/cards/${String(item.cardNo || item.id).padStart(3, "0")}.jpg`,
      rarity: item.rarity || "Legendary",
      sellerId: item.sellerId,
      sellerName: item.sellerName || "Unknown Seller",
      sellerImage: item.sellerImage || "/default-avatar.png",
    }));

  return NextResponse.json(fixed, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
