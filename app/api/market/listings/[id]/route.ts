import { NextResponse } from "next/server";
import { getMarketListingById } from "@/lib/market-listings";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const listing = await getMarketListingById(id);

  if (!listing) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    ...listing,
    cardName:
      listing.cardName ||
      `Card #${String(listing.cardNo).padStart(3, "0")}`,
    imageUrl:
      listing.imageUrl ||
      `/cards/${String(listing.cardNo).padStart(3, "0")}.jpg`,
    rarity: listing.rarity || "Legendary",
  });
}
