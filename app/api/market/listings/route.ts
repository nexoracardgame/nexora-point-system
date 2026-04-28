import { NextResponse } from "next/server";
import { resolveCardDisplayImage } from "@/lib/card-image";
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
    .slice(0, 120)
    .map((item) => ({
      ...item,
      cardName:
        item.cardName || `Card #${String(item.cardNo || item.id).padStart(3, "0")}`,
      imageUrl: resolveCardDisplayImage(item.cardNo || item.id, item.imageUrl),
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
