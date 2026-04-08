import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const listing = await prisma.marketListing.findUnique({
    where: {
      id,
    },
  });

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